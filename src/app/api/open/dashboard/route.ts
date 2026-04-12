import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

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
  const totalSales = orders.reduce((s, o) => s + (o.hq_total || 0), 0)
  const monthSales = orders
    .filter(o => o.shipped_at && o.shipped_at >= monthStart)
    .reduce((s, o) => s + (o.hq_total || 0), 0)
  const todaySales = orders
    .filter(o => o.shipped_at && o.shipped_at >= todayStart)
    .reduce((s, o) => s + (o.hq_total || 0), 0)

  return NextResponse.json({
    totalOrders: totalOrders || 0,
    pendingShipment: pendingShipment || 0,
    products: products || 0,
    distributors: distributors || 0,
    activeRetailers: activeRetailers || 0,
    totalSales,
    monthSales,
    todaySales,
    updatedAt: now.toISOString(),
  })
}
