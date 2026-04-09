'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { formatKRW, formatDateTime, cn } from '@/lib/utils'
import Link from 'next/link'

type Tab = 'retailer' | 'hq'

function getDisplayLabel(order: Order): string {
  if (order.status === 'SUBMITTED' && (order.order_type === 'direct' || order.note?.startsWith('[직발주]'))) {
    return '발주 요청'
  }
  return ORDER_STATUS_LABELS[order.status]
}

export default function DistributorOrdersPage() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('retailer')
  const [orders, setOrders] = useState<(Order & { retailer: { company_name: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    setStatusFilter('all')
  }, [tab])

  useEffect(() => {
    if (!profile) return

    const fetchOrders = async () => {
      setLoading(true)
      let query = supabase
        .from('orders')
        .select('*, retailer:users_profile!retailer_id(company_name)')
        .eq('distributor_id', profile.id)
        .order('created_at', { ascending: false })

      // 탭 구분: 총판 직발주 = retailer_id === distributor_id
      if (tab === 'retailer') {
        query = query.neq('retailer_id', profile.id)
      } else {
        query = query.eq('retailer_id', profile.id)
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data } = await query
      if (data) setOrders(data)
      setLoading(false)
    }

    fetchOrders()
  }, [profile, tab, statusFilter, supabase])

  const statusOptions = tab === 'retailer'
    ? ['all', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SHIPPED', 'COMPLETED']
    : ['all', 'SUBMITTED', 'HQ_RECEIVED', 'PREPARING', 'SHIPPED', 'COMPLETED']

  return (
    <div>
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">발주 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tab === 'retailer' ? '소매점 발주 승인 및 관리' : '본사 발주 현황'}
          </p>
        </div>
        {tab === 'hq' && (
          <Link
            href="/distributor/orders/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + 본사 발주
          </Link>
        )}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('retailer')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'retailer'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          소매점 주문
        </button>
        <button
          onClick={() => setTab('hq')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            tab === 'hq'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          본사 발주
        </button>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {statusOptions.map((status) => (
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
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            {tab === 'hq' ? (
              <div className="space-y-3">
                <p>본사 발주 내역이 없습니다.</p>
                <Link
                  href="/distributor/orders/new"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  본사 발주하기
                </Link>
              </div>
            ) : '해당하는 주문이 없습니다.'}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full hidden lg:table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">주문번호</th>
                  {tab === 'retailer' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">소매점</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">
                    {tab === 'retailer' ? '소매 금액' : '공급금액'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">본사 금액</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">발주일</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500">상세</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-900">{order.order_number}</td>
                    {tab === 'retailer' && (
                      <td className="px-6 py-3 text-sm text-gray-900">{order.retailer?.company_name}</td>
                    )}
                    <td className="px-6 py-3">
                      <span className={cn(
                        'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                        ORDER_STATUS_COLORS[order.status]
                      )}>
                        {getDisplayLabel(order)}
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

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {orders.map((order) => (
                <Link key={order.id} href={`/distributor/orders/${order.id}`} className="block p-4 active:bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{order.order_number}</span>
                    <span className={cn(
                      'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                      ORDER_STATUS_COLORS[order.status]
                    )}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  {tab === 'retailer' && (
                    <div className="text-sm text-gray-500 mb-1">{order.retailer?.company_name}</div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{formatDateTime(order.created_at)}</span>
                    <span className="font-medium text-gray-900">{formatKRW(order.retailer_total)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
