'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { formatKRW, formatDateTime, cn } from '@/lib/utils'
import Link from 'next/link'

export default function RetailerOrdersPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return

    const fetchOrders = async () => {
      setLoading(true)
      let query = supabase
        .from('orders')
        .select('*')
        .eq('retailer_id', profile.id)
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data } = await query
      if (data) setOrders(data)
      setLoading(false)
    }

    fetchOrders()
  }, [profile, statusFilter, supabase])

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">발주 목록</h1>
          <p className="text-sm text-gray-500 mt-1">나의 발주 내역을 확인합니다</p>
        </div>
        <Link
          href="/retailer/orders/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + 새 발주
        </Link>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6">
        {['all', 'SUBMITTED', 'APPROVED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {status === 'all' ? '전체' : ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS]}
          </button>
        ))}
      </div>

      {/* 주문 목록 */}
      <div className="bg-white rounded-xl border border-gray-200">
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">로딩 중...</div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">발주 내역이 없습니다.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">주문번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">공급가액</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">발주일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">희망납기</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
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
                  <td className="px-6 py-3 text-right text-sm text-gray-900">{formatKRW(order.retailer_total)}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{formatDateTime(order.created_at)}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{order.desired_date || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
