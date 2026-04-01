'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { formatKRW, formatDateTime, cn } from '@/lib/utils'
import Link from 'next/link'

export default function DistributorDashboard() {
  const { profile } = useAuth()
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [stats, setStats] = useState({ pending: 0, approved: 0, total: 0 })
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return

    const fetchData = async () => {
      // 승인 대기 주문
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('distributor_id', profile.id)
        .eq('status', 'SUBMITTED')
        .order('created_at', { ascending: false })
        .limit(10)

      if (orders) setPendingOrders(orders)

      // 통계
      const { count: pending } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('distributor_id', profile.id)
        .eq('status', 'SUBMITTED')

      const { count: approved } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('distributor_id', profile.id)
        .in('status', ['APPROVED', 'HQ_RECEIVED', 'PREPARING', 'SHIPPED'])

      const { count: total } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('distributor_id', profile.id)

      setStats({
        pending: pending || 0,
        approved: approved || 0,
        total: total || 0,
      })
    }

    fetchData()
  }, [profile, supabase])

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">총판 대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">
          {profile?.company_name} 발주 관리 현황
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl border border-orange-200 p-6">
          <p className="text-sm text-gray-500">승인 대기</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">진행 중</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.approved}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">전체 주문</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
        </div>
      </div>

      {/* 승인 대기 목록 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">승인 대기 발주</h2>
          <Link href="/distributor/orders" className="text-sm text-blue-600 hover:underline">
            전체 보기
          </Link>
        </div>
        {pendingOrders.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            승인 대기 중인 발주가 없습니다.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">주문번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">소매 금액</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">발주일</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500">처리</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900">{order.order_number}</td>
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
                  <td className="px-6 py-3 text-center">
                    <Link
                      href={`/distributor/orders/${order.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      상세
                    </Link>
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
