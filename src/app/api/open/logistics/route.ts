import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // PREPARING 상태이고 fulfillment_type이 distributor가 아닌 주문 조회
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      shipping_address,
      created_at,
      retailer:users_profile!retailer_id(company_name, phone),
      order_items(
        quantity,
        product:products(name, product_code)
      )
    `)
    .eq('status', 'PREPARING')
    .neq('fulfillment_type', 'distributor')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // JS에서 K100 또는 L100 포함 주문만 필터링
  type RawItem = {
    quantity: number
    product: { name: string; product_code: string } | null
  }

  type RawOrder = {
    id: string
    order_number: string
    shipping_address: string | null
    created_at: string
    retailer: { company_name: string; phone: string | null } | null
    order_items: RawItem[]
  }

  const filtered = ((orders ?? []) as unknown as RawOrder[]).filter((order) =>
    order.order_items.some((item) => {
      const code = item.product?.product_code ?? ''
      return /K100/i.test(code) || /L100/i.test(code)
    })
  )

  // 응답 형태 정제
  const result = filtered.map((order) => {
    const items = order.order_items as RawItem[]

    const k100Qty = items
      .filter((i) => /K100/i.test(i.product?.product_code ?? ''))
      .reduce((sum, i) => sum + i.quantity, 0)

    const l100Qty = items
      .filter((i) => /L100/i.test(i.product?.product_code ?? ''))
      .reduce((sum, i) => sum + i.quantity, 0)

    return {
      id: order.id,
      order_number: order.order_number,
      retailer_name: (order.retailer as { company_name: string; phone: string | null } | null)?.company_name ?? '알 수 없음',
      retailer_phone: (order.retailer as { company_name: string; phone: string | null } | null)?.phone ?? null,
      k100_qty: k100Qty,
      l100_qty: l100Qty,
      // K100: 5개/박스, L100: 4개/박스
      k100_boxes: k100Qty > 0 ? Math.ceil(k100Qty / 5) : 0,
      l100_boxes: l100Qty > 0 ? Math.ceil(l100Qty / 4) : 0,
      created_at: order.created_at,
    }
  })

  return NextResponse.json(result)
}
