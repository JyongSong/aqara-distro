import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const merchantId = searchParams.get('merchantId')
  const role = searchParams.get('role') // 'distributor' | 'retailer'
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!merchantId || !role || !from || !to) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  // 大屏公开 API 使用 Service Role 绕过 RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. 找出在筛选日期与状态内的订单
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('id')
    .eq(role === 'distributor' ? 'distributor_id' : 'retailer_id', merchantId)
    .in('status', ['SHIPPED', 'DELIVERED', 'COMPLETED'])
    .neq('fulfillment_type', 'distributor')
    .gte('created_at', from + 'T00:00:00')
    .lte('created_at', to + 'T23:59:59')

  if (ordersErr || !orders) {
    console.error('[open/dashboard/detail] orders fetch error:', ordersErr)
    return NextResponse.json({ error: ordersErr?.message || 'Orders not found' }, { status: 500 })
  }

  const orderIds = orders.map(o => o.id)
  if (orderIds.length === 0) {
    return NextResponse.json([])
  }

  // 2. 查询这些订单的明细项
  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select('quantity, option_code, product:products(name)')
    .in('order_id', orderIds)

  if (itemsErr) {
    console.error('[open/dashboard/detail] order_items fetch error:', itemsErr)
    return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  // 3. 按商品名及选项做累加聚合
  const aggregationMap: Record<string, { productName: string; optionCode: string | null; quantity: number }> = {}

  ;(items ?? []).forEach((item: any) => {
    const prodName = item.product?.name ?? '알 수 없는 상품'
    const optCode = item.option_code || null
    const key = `${prodName}_${optCode ?? ''}`

    if (!aggregationMap[key]) {
      aggregationMap[key] = {
        productName: prodName,
        optionCode: optCode,
        quantity: 0
      }
    }
    aggregationMap[key].quantity += item.quantity || 0
  })

  // 按数量降序排列
  const sortedDetails = Object.values(aggregationMap).sort((a, b) => b.quantity - a.quantity)

  return NextResponse.json(sortedDetails)
}
