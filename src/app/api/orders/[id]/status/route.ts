import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/sms'
import { NextRequest, NextResponse } from 'next/server'

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
      distributor:users_profile!distributor_id(company_name, phone)
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
  const orderNumber   = order.order_number
  const retailerName  = order.retailer?.company_name  ?? ''
  const distributorName = order.distributor?.company_name ?? ''
  const retailerPhone = order.retailer?.phone
  const distributorPhone = order.distributor?.phone
  const hqPhone       = process.env.HQ_NOTIFY_PHONE
  const isSelfOrder   = order.retailer_id === order.distributor_id

  switch (newStatus) {
    case 'SUBMITTED':
      if (isSelfOrder) {
        await sendSms(hqPhone,
          `[Aqara] 총판 직발주 요청\n주문번호: ${orderNumber}\n총판: ${distributorName}\n주문관리에서 확인해 주세요.`)
      } else {
        await sendSms(distributorPhone,
          `[Aqara] 새 발주 요청\n주문번호: ${orderNumber}\n소매점: ${retailerName}\n발주관리에서 확인해 주세요.`)
      }
      break

    case 'APPROVED':
      await sendSms(hqPhone,
        `[Aqara] 새 발주 승인\n주문번호: ${orderNumber}\n총판: ${distributorName}\n주문관리에서 확인해 주세요.`)
      break

    case 'HQ_RECEIVED':
      await Promise.all([
        sendSms(retailerPhone, `[Aqara] 발주가 본사에 접수되었습니다.\n주문번호: ${orderNumber}`),
        ...(isSelfOrder ? [sendSms(distributorPhone, `[Aqara] 발주가 본사에 접수되었습니다.\n주문번호: ${orderNumber}`)] : []),
      ])
      break

    case 'SHIPPED':
      await Promise.all([
        sendSms(retailerPhone, `[Aqara] 출고되었습니다.\n주문번호: ${orderNumber}\n빠른 시일 내에 배송될 예정입니다.`),
        ...(isSelfOrder ? [sendSms(distributorPhone, `[Aqara] 출고되었습니다.\n주문번호: ${orderNumber}\n빠른 시일 내에 배송될 예정입니다.`)] : []),
      ])
      break

    case 'DELIVERED':
      await Promise.all([
        sendSms(retailerPhone, `[Aqara] 상품이 수령 확인되었습니다.\n주문번호: ${orderNumber}`),
        sendSms(hqPhone, `[Aqara] 배송 완료\n주문번호: ${orderNumber}\n${isSelfOrder ? `총판: ${distributorName}` : `소매점: ${retailerName}`}`),
        ...(isSelfOrder ? [sendSms(distributorPhone, `[Aqara] 상품이 수령 확인되었습니다.\n주문번호: ${orderNumber}`)] : []),
      ])
      break
  }

  return NextResponse.json(updatedOrder)
}
