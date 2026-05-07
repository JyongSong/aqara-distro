import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const now = new Date()

  const defaultFrom = toDateStr(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()))
  const defaultTo   = toDateStr(now)

  const dateFrom = searchParams.get('from') || defaultFrom
  const dateTo   = searchParams.get('to')   || defaultTo

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const todayStart = toDateStr(now)
  const monthStart = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
  const rangeEnd   = dateTo + 'T23:59:59'

  type ShippedOrder = { hq_total: number | null; shipped_at: string | null }

  const [
    { count: totalOrders },
    { count: pendingShipment },
    { count: products },
    { count: distributors },
    { count: activeRetailers },
    { data: shippedOrders },
  ] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true })
      .in('status', ['APPROVED', 'HQ_RECEIVED', 'PREPARING'])
      .neq('fulfillment_type', 'distributor'),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('users_profile').select('*', { count: 'exact', head: true }).eq('role', 'distributor'),
    supabase.from('users_profile').select('*', { count: 'exact', head: true }).eq('role', 'retailer').eq('status', 'active'),
    supabase.from('orders').select('hq_total, shipped_at')
      .in('status', ['SHIPPED', 'DELIVERED', 'COMPLETED'])
      .neq('fulfillment_type', 'distributor'),
  ])

  const orders: ShippedOrder[] = shippedOrders ?? []

  const periodSales = orders
    .filter(o => o.shipped_at && o.shipped_at >= dateFrom && o.shipped_at <= rangeEnd)
    .reduce((s, o) => s + (o.hq_total || 0), 0)
  const monthSales = orders
    .filter(o => o.shipped_at && o.shipped_at >= monthStart)
    .reduce((s, o) => s + (o.hq_total || 0), 0)
  const todaySales = orders
    .filter(o => o.shipped_at && o.shipped_at >= todayStart)
    .reduce((s, o) => s + (o.hq_total || 0), 0)

  const recent3Months = [1, 2, 3].map(i => {
    const d    = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const from = toDateStr(d)
    const to   = toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)) + 'T23:59:59'
    const sales = orders
      .filter(o => o.shipped_at && o.shipped_at >= from && o.shipped_at <= to)
      .reduce((s, o) => s + (o.hq_total || 0), 0)
    return { label: `${d.getMonth() + 1}월`, sales }
  })

  return NextResponse.json({
    totalOrders:    totalOrders    || 0,
    pendingShipment:pendingShipment|| 0,
    products:       products       || 0,
    distributors:   distributors   || 0,
    activeRetailers:activeRetailers|| 0,
    periodSales,
    monthSales,
    todaySales,
    dateFrom,
    dateTo,
    recent3Months,
    updatedAt: now.toISOString(),
  })
}
