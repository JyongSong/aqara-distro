'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { formatKRW, formatDateTime, cn } from '@/lib/utils'
import Link from 'next/link'

export default function HQOrdersPage() {
  const [orders, setOrders] = useState<(Order & {
    retailer: { company_name: string }
    distributor: { company_name: string }
  })[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [processing, setProcessing] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchOrders()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const fetchOrders = async () => {
    setLoading(true)
    let query = supabase
      .from('orders')
      .select('*, retailer:users_profile!retailer_id(company_name), distributor:users_profile!distributor_id(company_name)')
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query
    if (data) setOrders(data)
    setLoading(false)
  }

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setProcessing(orderId)

    const updateData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'HQ_RECEIVED') updateData.status = 'HQ_RECEIVED'
    if (newStatus === 'PREPARING') updateData.status = 'PREPARING'
    if (newStatus === 'SHIPPED') {
      updateData.shipped_at = new Date().toISOString()
    }

    await supabase.from('orders').update(updateData).eq('id', orderId)
    setProcessing(null)
    fetchOrders()
  }

  const getNextAction = (status: string): { label: string; nextStatus: string; color: string } | null => {
    switch (status) {
      case 'APPROVED':
        return { label: '본사 접수', nextStatus: 'HQ_RECEIVED', color: 'bg-purple-600 hover:bg-purple-700' }
      case 'HQ_RECEIVED':
        return { label: '출고 준비', nextStatus: 'PREPARING', color: 'bg-yellow-600 hover:bg-yellow-700' }
      case 'PREPARING':
        return { label: '출고 완료', nextStatus: 'SHIPPED', color: 'bg-indigo-600 hover:bg-indigo-700' }
      case 'DELIVERED':
        return { label: '거래 완료', nextStatus: 'COMPLETED', color: 'bg-emerald-600 hover:bg-emerald-700' }
      default:
        return null
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
        <p className="text-sm text-gray-500 mt-1">전체 주문 현황 확인 및 출고 처리</p>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'SUBMITTED', 'APPROVED', 'HQ_RECEIVED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].map((status) => (
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">주문번호</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">소매점</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">총판</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">소매금액</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">본사금액</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">발주일</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">처리</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const action = getNextAction(order.status)
                return (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/hq/orders/${order.id}`} className="text-sm font-mono text-blue-600 hover:underline">
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{order.retailer?.company_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{order.distributor?.company_name}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                        ORDER_STATUS_COLORS[order.status]
                      )}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">{formatKRW(order.retailer_total)}</td>
                    <td className="px-4 py-3 text-right text-sm text-blue-600">
                      {order.hq_total ? formatKRW(order.hq_total) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(order.created_at)}</td>
                    <td className="px-4 py-3 text-center">
                      {action && (
                        <button
                          onClick={() => handleStatusChange(order.id, action.nextStatus)}
                          disabled={processing === order.id}
                          className={cn(
                            'px-3 py-1 text-white rounded text-xs font-medium disabled:opacity-50',
                            action.color
                          )}
                        >
                          {processing === order.id ? '...' : action.label}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
