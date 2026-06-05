import { createAdminClient } from '@/lib/supabase/admin'
import { getErpTrackingNumber } from '@/lib/erp'
import { sendSms } from '@/lib/sms'
import { NextRequest, NextResponse } from 'next/server'

const APP_URL = 'https://aqara-distro.vercel.app'
const CARRIER  = '한진택배'

// ERP에 송장번호가 생기면 자동으로 SHIPPED 처리
const STATUSES_TO_CHECK = ['APPROVED', 'HQ_RECEIVED', 'PREPARING', 'SHIPPED']

export async function GET(request: NextRequest) {
  // Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더를 자동 추가
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // tracking_number가 없는 진행 중 주문 조회
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, retailer_id, distributor_id,
      retailer:users_profile!retailer_id(company_name, phone),
      distributor:users_profile!distributor_id(company_name, phone),
      items:order_items(quantity, product:products(name))
    `)
    .in('status', STATUSES_TO_CHECK)
    .is('tracking_number', null)

  if (error) {
    console.error('[cron/sync-shipments] DB 조회 실패:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const synced: { order_number: string; tracking_no: string }[] = []

  for (const order of orders ?? []) {
    const trackingNo = await getErpTrackingNumber(order.order_number)
    if (!trackingNo) continue

    const wasAlreadyShipped = order.status === 'SHIPPED'

    // 상태 업데이트
    const updatePayload: Record<string, unknown> = {
      tracking_number: trackingNo,
    }
    if (!wasAlreadyShipped) {
      updatePayload.status = 'SHIPPED'
      updatePayload.shipped_at = new Date().toISOString()
    }

    const { error: updateErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id)

    if (updateErr) {
      console.error(`[cron] 업데이트 실패 ${order.order_number}:`, updateErr)
      continue
    }

    // 복수 송장은 첫 번째만 SMS에 표시
    const firstTracking = trackingNo.split('\n')[0]

    // 이미 SHIPPED 상태였던 주문은 SMS를 중복 발송하지 않음
    if (wasAlreadyShipped) {
      synced.push({ order_number: order.order_number, tracking_no: firstTracking })
      console.log(`[cron] SHIPPED 송장번호 업데이트 완료 (SMS 미발송): ${order.order_number}`)
      continue
    }

    // SMS 발송
    const isSelfOrder    = order.retailer_id === order.distributor_id
    const orderNumber    = order.order_number
    const retailerName   = (order.retailer as { company_name?: string } | null)?.company_name  ?? ''
    const retailerPhone  = (order.retailer  as { phone?: string } | null)?.phone
    const distributorPhone = (order.distributor as { phone?: string } | null)?.phone

    type ItemRow = { quantity: number; product?: { name: string }[] | null }
    const itemsSummary = ((order.items ?? []) as ItemRow[])
      .map(i => `${i.product?.[0]?.name ?? '상품'} x${i.quantity}`)
      .join('\n')

    const trackingLine  = `송장번호: ${firstTracking}\n택배사: ${CARRIER}\n`

    await Promise.all([
      sendSms(retailerPhone,
        `[Aqara] 출고되었습니다.\n주문번호: ${orderNumber}\n${itemsSummary}\n${trackingLine}빠른 시일 내에 배송될 예정입니다.\n${APP_URL}`),
      !isSelfOrder && distributorPhone
        ? sendSms(distributorPhone,
            `[Aqara] 출고 완료\n주문번호: ${orderNumber}\n소매점: ${retailerName}\n${trackingLine}${APP_URL}`)
        : Promise.resolve(),
    ])

    synced.push({ order_number: orderNumber, tracking_no: firstTracking })
    console.log(`[cron] SHIPPED 처리: ${orderNumber} / ${firstTracking}`)
  }

  return NextResponse.json({
    checked: (orders ?? []).length,
    synced:  synced.length,
    results: synced,
  })
}
