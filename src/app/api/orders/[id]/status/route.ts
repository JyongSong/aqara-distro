import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, ALL_ROLES } from '@/lib/api-auth'
import { sendSms } from '@/lib/sms'
import { getErpTrackingNumber } from '@/lib/erp'
import { NextRequest, NextResponse } from 'next/server'
import type { OrderStatus, UserRole } from '@/lib/types'

const APP_URL = 'https://aqara-distro.vercel.app'

/**
 * 역할별로 지시할 수 있는 상태.
 * 현재 화면에서 실제로 호출하는 값만 허용한다(최소 권한).
 *   retailer    발주/견적 제출, 발주 확정, 수령 확인
 *   distributor 본사 직발주 제출, 견적 발송, 승인, 총판 출고 진행
 *   hq          접수 → 출고 준비 → 출고 → 거래 완료
 */
const ALLOWED_STATUSES: Record<UserRole, readonly OrderStatus[]> = {
  retailer:    ['SUBMITTED', 'ORDER_PLACED', 'DELIVERED'],
  distributor: ['SUBMITTED', 'QUOTE_SENT', 'APPROVED', 'HQ_RECEIVED', 'PREPARING', 'SHIPPED'],
  hq:          ['HQ_RECEIVED', 'PREPARING', 'SHIPPED', 'COMPLETED'],
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await requireRole(ALL_ROLES)
  if (authError) return authError

  const { id } = await params

  let body: { newStatus: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const { newStatus } = body
  if (!newStatus) {
    return NextResponse.json({ error: 'newStatus required' }, { status: 400 })
  }

  if (!ALLOWED_STATUSES[user.role].includes(newStatus as OrderStatus)) {
    return NextResponse.json({ error: '허용되지 않은 상태 변경입니다.' }, { status: 403 })
  }

  const supabase = createAdminClient()

  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select(`
      *,
      retailer:users_profile!retailer_id(company_name, phone),
      distributor:users_profile!distributor_id(company_name, phone),
      items:order_items(quantity, product:products(name))
    `)
    .eq('id', id)
    .single()

  if (fetchError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // 본인이 당사자인 주문만 변경 가능 (hq 는 전체 주문 처리)
  if (user.role === 'retailer' && order.retailer_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }
  if (user.role === 'distributor' && order.distributor_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  // 타임스탬프 설정
  const updateData: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'SHIPPED')    updateData.shipped_at   = new Date().toISOString()
  if (newStatus === 'DELIVERED')  updateData.delivered_at = new Date().toISOString()
  if (newStatus === 'SUBMITTED')  updateData.submitted_at = new Date().toISOString()

  const { data: updatedOrder, error: updateError } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // SMS 발송 (fire-and-forget)
  const orderNumber     = order.order_number
  const retailerName    = order.retailer?.company_name  ?? ''
  const distributorName = order.distributor?.company_name ?? ''
  const retailerPhone   = order.retailer?.phone
  const distributorPhone = order.distributor?.phone
  const hqPhone         = process.env.HQ_NOTIFY_PHONE
  const isSelfOrder     = order.retailer_id === order.distributor_id

  // 상품 목록 요약 (상품명 x수량)
  type ItemRow = { quantity: number; product?: { name: string } | null }
  const itemsSummary = ((order.items ?? []) as ItemRow[])
    .map(item => `${item.product?.name ?? '상품'} x${item.quantity}`)
    .join('\n')

  switch (newStatus) {
    case 'SUBMITTED':
      if (isSelfOrder) {
        await sendSms(hqPhone,
          `[Aqara] 총판 직발주 요청\n주문번호: ${orderNumber}\n총판: ${distributorName}\n주문관리에서 확인해 주세요.`)
      } else if (order.order_type === 'quote') {
        await sendSms(distributorPhone,
          `[Aqara] 새 견적 요청\n주문번호: ${orderNumber}\n소매점: ${retailerName}\n견적을 확인해 주세요.\n${APP_URL}`)
      } else {
        await sendSms(distributorPhone,
          `[Aqara] 새 발주 요청\n주문번호: ${orderNumber}\n소매점: ${retailerName}\n발주관리에서 확인해 주세요.\n${APP_URL}`)
      }
      break

    case 'QUOTE_SENT':
      await sendSms(retailerPhone,
        `[Aqara] 견적이 도착했습니다.\n주문번호: ${orderNumber}\n${itemsSummary}\n${APP_URL}`)
      break

    case 'ORDER_PLACED':
      await sendSms(distributorPhone,
        `[Aqara] 발주가 확정되었습니다.\n주문번호: ${orderNumber}\n소매점: ${retailerName}\n발주관리에서 확인해 주세요.\n${APP_URL}`)
      break

    case 'APPROVED':
      await sendSms(hqPhone,
        `[Aqara] 새 발주 승인\n주문번호: ${orderNumber}\n총판: ${distributorName}\n주문관리에서 확인해 주세요.`)
      break

    case 'HQ_RECEIVED':
      await sendSms(retailerPhone,
        `[Aqara] 발주가 본사에 접수되었습니다.\n주문번호: ${orderNumber}\n${itemsSummary}\n${APP_URL}`)
      break

    case 'SHIPPED': {
      // 송장번호: Supabase 저장값 우선, 없으면 ERP 실시간 조회
      let trackingNo: string | null = order.tracking_number ?? null
      if (!trackingNo) {
        trackingNo = await getErpTrackingNumber(orderNumber)
        if (trackingNo) {
          // ERP에서 조회 성공 시 Supabase에도 저장
          await supabase.from('orders').update({ tracking_number: trackingNo }).eq('id', id)
        }
      }
      // 복수 송장이면 첫 번째만 SMS에 포함
      const firstTracking = trackingNo ? trackingNo.split('\n')[0] : null
      const trackingLine  = firstTracking
        ? `송장번호: ${firstTracking}\n택배사: 한진택배\n`
        : ''

      await Promise.all([
        sendSms(retailerPhone,
          `[Aqara] 출고되었습니다.\n주문번호: ${orderNumber}\n${itemsSummary}\n${trackingLine}빠른 시일 내에 배송될 예정입니다.\n${APP_URL}`),
        !isSelfOrder && distributorPhone
          ? sendSms(distributorPhone,
              `[Aqara] 출고 완료\n주문번호: ${orderNumber}\n소매점: ${retailerName}\n${trackingLine}${APP_URL}`)
          : Promise.resolve(),
      ])
      break
    }

    case 'DELIVERED':
      await Promise.all([
        sendSms(retailerPhone,
          `[Aqara] 상품이 수령 확인되었습니다.\n주문번호: ${orderNumber}\n${itemsSummary}\n${APP_URL}`),
        sendSms(hqPhone,
          `[Aqara] 배송 완료\n주문번호: ${orderNumber}\n${isSelfOrder ? `총판: ${distributorName}` : `소매점: ${retailerName}`}`),
      ])
      break
  }

  return NextResponse.json(updatedOrder)
}
