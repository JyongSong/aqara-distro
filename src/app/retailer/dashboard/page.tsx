'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { formatKRW, formatDateTime, cn } from '@/lib/utils'
import Link from 'next/link'

export default function RetailerDashboard() {
  const { profile } = useAuth()
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, shipped: 0 })
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return

    const fetchData = async () => {
      // 최근 주문
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('retailer_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (orders) setRecentOrders(orders)

      // 통계
      const { count: total } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('retailer_id', profile.id)

      const { count: pending } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('retailer_id', profile.id)
        .in('status', ['SUBMITTED', 'APPROVED', 'HQ_RECEIVED', 'PREPARING'])

      const { count: shipped } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('retailer_id', profile.id)
        .eq('status', 'SHIPPED')

      setStats({
        total: total || 0,
        pending: pending || 0,
        shipped: shipped || 0,
      })
    }

    fetchData()
  }, [profile, supabase])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">
          {profile?.company_name} 발주 현황
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">전체 발주</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">진행 중</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">출고 완료</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.shipped}</p>
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="mb-8">
        <Link
          href="/retailer/orders/new"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + 새 발주 작성
        </Link>
      </div>

      {/* 최근 주문 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">최근 발주</h2>
        </div>
        {recentOrders.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            아직 발주 내역이 없습니다.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">주문번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">금액</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">일시</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <Link href={`/retailer/orders/${order.id}`} className="text-sm text-blue-600 hover:underline">
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                      ORDER_STATUS_COLORS[order.status]
                    )}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-sm text-gray-900">
                    {formatKRW(order.retailer_total)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {formatDateTime(order.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
