import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/sms'
import { NextRequest, NextResponse } from 'next/server'

const APP_URL = 'https://aqara-distro.vercel.app'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      await Promise.all([
        sendSms(retailerPhone,
          `[Aqara] 발주가 본사에 접수되었습니다.\n주문번호: ${orderNumber}\n${itemsSummary}\n${APP_URL}`),
        ...(isSelfOrder ? [sendSms(distributorPhone,
          `[Aqara] 발주가 본사에 접수되었습니다.\n주문번호: ${orderNumber}\n${itemsSummary}\n${APP_URL}`)] : []),
      ])
      break

    case 'SHIPPED':
      await Promise.all([
        sendSms(retailerPhone,
          `[Aqara] 출고되었습니다.\n주문번호: ${orderNumber}\n${itemsSummary}\n빠른 시일 내에 배송될 예정입니다.\n${APP_URL}`),
        ...(isSelfOrder ? [sendSms(distributorPhone,
          `[Aqara] 출고되었습니다.\n주문번호: ${orderNumber}\n${itemsSummary}\n빠른 시일 내에 배송될 예정입니다.\n${APP_URL}`)] : []),
      ])
      break

    case 'DELIVERED':
      await Promise.all([
        sendSms(retailerPhone,
          `[Aqara] 상품이 수령 확인되었습니다.\n주문번호: ${orderNumber}\n${itemsSummary}\n${APP_URL}`),
        sendSms(hqPhone,
          `[Aqara] 배송 완료\n주문번호: ${orderNumber}\n${isSelfOrder ? `총판: ${distributorName}` : `소매점: ${retailerName}`}`),
        ...(isSelfOrder ? [sendSms(distributorPhone,
          `[Aqara] 상품이 수령 확인되었습니다.\n주문번호: ${orderNumber}\n${itemsSummary}\n${APP_URL}`)] : []),
      ])
      break
  }

  return NextResponse.json(updatedOrder)
}
