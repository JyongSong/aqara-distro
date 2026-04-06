'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { formatDateTime, cn } from '@/lib/utils'
import Link from 'next/link'

type OrderWithItems = Order & { order_items: { quantity: number }[] | null }

const STATUS_FILTERS = [
  'all',
  'DRAFT',
  'SUBMITTED',
  'QUOTE_SENT',
  'ORDER_PLACED',
  'APPROVED',
  'REJECTED',
  'SHIPPED',
  'COMPLETED',
] as const

export default function RetailerOrdersPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const supabase = createClient()

  const fetchOrders = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    let query = supabase
      .from('orders')
      .select('*, order_items(quantity)')
      .eq('retailer_id', profile.id)
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query
    if (data) setOrders(data as OrderWithItems[])
    setLoading(false)
  }, [profile, statusFilter, supabase])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleSubmitQuote = async (orderId: string) => {
    await supabase.from('orders').update({
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
    }).eq('id', orderId)
    fetchOrders()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">견적 / 발주 관리</h1>
          <p className="text-sm text-gray-500 mt-1">견적 요청 및 발주 현황</p>
        </div>
        <Link
          href="/retailer/orders/new"
          className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + 견적 요청
        </Link>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_FILTERS.map((status) => (
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
          <div className="px-6 py-12 text-center text-gray-400 text-sm">내역이 없습니다.</div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full hidden sm:table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">주문번호</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">품목 수</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">요청일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">액션</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className={cn(
                      'border-b border-gray-50 hover:bg-gray-50',
                      order.status === 'QUOTE_SENT' && 'bg-orange-50 hover:bg-orange-100'
                    )}
                  >
                    <td className="px-6 py-3">
                      <Link
                        href={`/retailer/orders/${order.id}`}
                        className="text-sm font-mono text-blue-600 hover:underline"
                      >
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
                    <td className="px-6 py-3 text-right text-sm text-gray-600">
                      {order.order_items?.length ?? 0}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {formatDateTime(order.created_at)}
                    </td>
                    <td className="px-6 py-3">
                      {order.status === 'DRAFT' ? (
                        <button
                          onClick={() => handleSubmitQuote(order.id)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                        >
                          견적 요청하기
                        </button>
                      ) : order.status === 'QUOTE_SENT' ? (
                        <Link
                          href={`/retailer/orders/${order.id}`}
                          className="px-3 py-1.5 bg-orange-500 text-white rounded text-xs font-medium hover:bg-orange-600"
                        >
                          견적 확인
                        </Link>
                      ) : (
                        <Link
                          href={`/retailer/orders/${order.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          상세
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className={cn(
                    'p-4',
                    order.status === 'QUOTE_SENT' && 'bg-orange-50'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Link
                      href={`/retailer/orders/${order.id}`}
                      className="text-sm font-mono text-blue-600"
                    >
                      {order.order_number}
                    </Link>
                    <span className={cn(
                      'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                      ORDER_STATUS_COLORS[order.status]
                    )}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-gray-500">{formatDateTime(order.created_at)}</span>
                    <span className="text-gray-500">품목 {order.order_items?.length ?? 0}개</span>
                  </div>
                  <div className="mt-3">
                    {order.status === 'DRAFT' ? (
                      <button
                        onClick={() => handleSubmitQuote(order.id)}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                      >
                        견적 요청하기
                      </button>
                    ) : order.status === 'QUOTE_SENT' ? (
                      <Link
                        href={`/retailer/orders/${order.id}`}
                        className="block w-full px-3 py-2 bg-orange-500 text-white rounded text-sm font-medium text-center hover:bg-orange-600"
                      >
                        견적 확인
                      </Link>
                    ) : (
                      <Link
                        href={`/retailer/orders/${order.id}`}
                        className="block w-full px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm font-medium text-center hover:bg-gray-200"
                      >
                        상세
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
