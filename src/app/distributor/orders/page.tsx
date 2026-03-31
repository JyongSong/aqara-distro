'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { formatKRW, formatDateTime, cn } from '@/lib/utils'
import Link from 'next/link'

export default function DistributorOrdersPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<(Order & { retailer: { company_name: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return

    const fetchOrders = async () => {
      setLoading(true)
      let query = supabase
        .from('orders')
        .select('*, retailer:users_profile!retailer_id(company_name)')
        .eq('distributor_id', profile.id)
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">발주 관리</h1>
        <p className="text-sm text-gray-500 mt-1">소매점 발주 승인 및 관리</p>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6">
        {['all', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SHIPPED', 'COMPLETED'].map((status) => (
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
          <div className="px-6 py-12 text-center text-gray-400 text-sm">해당하는 주문이 없습니다.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">주문번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">소매점</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">소매 금액</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">본사 금액</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">발주일</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500">처리</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900">{order.order_number}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{order.retailer?.company_name}</td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                      ORDER_STATUS_COLORS[order.status]
                    )}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-sm text-gray-900">{formatKRW(order.retailer_total)}</td>
                  <td className="px-6 py-3 text-right text-sm text-gray-500">
                    {order.hq_total ? formatKRW(order.hq_total) : '-'}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">{formatDateTime(order.created_at)}</td>
                  <td className="px-6 py-3 text-center">
                    <Link href={`/distributor/orders/${order.id}`} className="text-sm text-blue-600 hover:underline">
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
