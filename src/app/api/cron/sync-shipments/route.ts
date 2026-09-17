import { createAdminClient } from '@/lib/supabase/admin'
import { getErpTrackingNumber } from '@/lib/erp'
import { sendSms } from '@/lib/sms'
import { getActiveBoxTypes, getRequiredBoxTypes, hasRequiredBoxIds, type BoxIds } from '@/lib/box-ids'
import { NextRequest, NextResponse } from 'next/server'

const APP_URL = 'https://aqara-distro.vercel.app'
const CARRIER  = '한진택배'

// ERP에 송장번호가 생기면 자동으로 SHIPPED 처리
// 단, 설정에서 활성화된 품목(K100/L100)이 포함된 주문은 해당 품목의 박스 ID까지 등록되어야 SHIPPED 처리
const STATUSES_TO_CHECK = ['APPROVED', 'HQ_RECEIVED', 'PREPARING', 'SHIPPED']

export async function GET(request: NextRequest) {
  // Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더를 자동 추가
  // CRON_SECRET 미설정 시 `Bearer undefined` 로 통과되는 것을 막기 위해 존재 여부를 먼저 검사
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/sync-shipments] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const activeBoxTypes = await getActiveBoxTypes(supabase)

  // 송장번호가 없거나, 송장번호는 있지만 박스 ID 대기로 아직 출고 처리되지 않은 주문 조회
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, retailer_id, distributor_id, fulfillment_type, tracking_number, box_ids,
      retailer:users_profile!retailer_id(company_name, phone),
      distributor:users_profile!distributor_id(company_name, phone),
      items:order_items(quantity, product:products(name, product_code))
    `)
    .in('status', STATUSES_TO_CHECK)
    .or('tracking_number.is.null,status.neq.SHIPPED')

  if (error) {
    console.error('[cron/sync-shipments] DB 조회 실패:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type ItemRow = { quantity: number; product?: { name: string; product_code: string | null } | null }

  const synced: { order_number: string; tracking_no: string }[] = []

  for (const order of orders ?? []) {
    const storedTracking = order.tracking_number as string | null
    const trackingNo = storedTracking ?? await getErpTrackingNumber(order.order_number)
    if (!trackingNo) continue

    const wasAlreadyShipped = order.status === 'SHIPPED'
    const items = (order.items ?? []) as unknown as ItemRow[]

    // 물류(HQ 출고) 주문은 활성화된 품목(K100/L100)의 박스 ID가 모두 등록되어야 출고 처리
    const requiredBoxTypes = order.fulfillment_type === 'distributor'
      ? []
      : getRequiredBoxTypes(activeBoxTypes, items.map(i => i.product?.product_code ?? ''))
    const canShip = !wasAlreadyShipped && hasRequiredBoxIds(order.box_ids as BoxIds | null, requiredBoxTypes)

    // 상태 업데이트
    const updatePayload: Record<string, unknown> = {}
    if (!storedTracking) updatePayload.tracking_number = trackingNo
    if (canShip) {
      updatePayload.status = 'SHIPPED'
      updatePayload.shipped_at = new Date().toISOString()
    }
    if (Object.keys(updatePayload).length === 0) continue

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

    // 이미 SHIPPED 상태였거나 박스 ID 대기 중인 주문은 SMS를 발송하지 않음
    if (!canShip) {
      console.log(wasAlreadyShipped
        ? `[cron] SHIPPED 송장번호 업데이트 완료 (SMS 미발송): ${order.order_number}`
        : `[cron] 송장번호 저장, 박스 ID 대기 (${requiredBoxTypes.join('/')}): ${order.order_number}`)
      if (wasAlreadyShipped) synced.push({ order_number: order.order_number, tracking_no: firstTracking })
      continue
    }

    // SMS 발송
    const isSelfOrder    = order.retailer_id === order.distributor_id
    const orderNumber    = order.order_number
    const retailerName   = (order.retailer as { company_name?: string } | null)?.company_name  ?? ''
    const retailerPhone  = (order.retailer  as { phone?: string } | null)?.phone
    const distributorPhone = (order.distributor as { phone?: string } | null)?.phone

    const itemsSummary = items
      .map(i => `${i.product?.name ?? '상품'} x${i.quantity}`)
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
