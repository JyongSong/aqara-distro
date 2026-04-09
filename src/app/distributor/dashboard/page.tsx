'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { formatDateTime, cn } from '@/lib/utils'
import Link from 'next/link'

function getDisplayLabel(order: Order): string {
  if (order.status === 'SUBMITTED' && (order.order_type === 'direct' || order.note?.includes('[직발주]'))) {
    return '발주 요청'
  }
  return ORDER_STATUS_LABELS[order.status]
}

type OrderWithRetailer = Order & {
  retailer: { company_name: string } | null
  order_items: { quantity: number }[]
}

export default function DistributorDashboard() {
  const { profile } = useAuth()
  const [pendingOrders, setPendingOrders] = useState<OrderWithRetailer[]>([])
  const [stats, setStats] = useState({
    orderPlacedCount: 0,
    retailSaleQty: 0,
    selfOrderQty: 0,
  })
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!profile) return

    const fetchData = async () => {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      // 최근 견적/발주 현황 (소매 주문 전체, 최신 10건)
      const { data: placedOrders } = await supabase
        .from('orders')
        .select('*, retailer:users_profile!retailer_id(company_name), order_items(quantity)')
        .eq('distributor_id', profile.id)
        .neq('retailer_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (placedOrders) setPendingOrders(placedOrders as OrderWithRetailer[])

      // 발주확정 대기 카운트
      const { count: orderPlacedCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('distributor_id', profile.id)
        .eq('status', 'ORDER_PLACED')
        .neq('retailer_id', profile.id)

      // 소매 판매수량 (이번달, APPROVED+, retailer != self)
      const RETAIL_STATUSES = ['APPROVED', 'HQ_RECEIVED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED']
      const { data: retailOrders } = await supabase
        .from('orders')
        .select('order_items(quantity)')
        .eq('distributor_id', profile.id)
        .in('status', RETAIL_STATUSES)
        .neq('retailer_id', profile.id)
        .gte('created_at', startOfMonth.toISOString())

      const retailSaleQty = (retailOrders ?? []).reduce(
        (sum: number, o: { order_items: { quantity: number }[] | null }) =>
          sum + ((o.order_items ?? []).reduce((s: number, i: { quantity: number }) => s + i.quantity, 0)),
        0
      )

      // 본사 발주수량 (이번달, retailer == self)
      const { data: selfOrders } = await supabase
        .from('orders')
        .select('order_items(quantity)')
        .eq('distributor_id', profile.id)
        .eq('retailer_id', profile.id)
        .gte('created_at', startOfMonth.toISOString())

      const selfOrderQty = (selfOrders ?? []).reduce(
        (sum: number, o: { order_items: { quantity: number }[] | null }) =>
          sum + ((o.order_items ?? []).reduce((s: number, i: { quantity: number }) => s + i.quantity, 0)),
        0
      )

      setStats({
        orderPlacedCount: orderPlacedCount || 0,
        retailSaleQty,
        selfOrderQty,
      })
    }

    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const now = new Date()
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`

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
        {/* 발주확정 대기 */}
        <div className="bg-white rounded-xl border border-violet-200 p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-gray-500">발주확정 대기</p>
          <p className="text-2xl sm:text-3xl font-bold text-violet-600 mt-2">{stats.orderPlacedCount}</p>
          <p className="text-xs text-gray-400 mt-1">건</p>
        </div>
        {/* 소매 판매수량 */}
        <div className="bg-white rounded-xl border border-blue-200 p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-gray-500">소매 판매수량</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-2">{stats.retailSaleQty}</p>
          <p className="text-xs text-gray-400 mt-1">{monthLabel} · EA</p>
        </div>
        {/* 본사 발주수량 */}
        <div className="bg-white rounded-xl border border-emerald-200 p-4 sm:p-6">
          <p className="text-xs sm:text-sm text-gray-500">본사 발주수량</p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-2">{stats.selfOrderQty}</p>
          <p className="text-xs text-gray-400 mt-1">{monthLabel} · EA</p>
        </div>
      </div>

      {/* 견적/발주 현황 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">견적/발주 현황</h2>
            {stats.orderPlacedCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                발주확정 {stats.orderPlacedCount}건
              </span>
            )}
          </div>
          <Link href="/distributor/orders" className="text-sm text-blue-600 hover:underline">
            전체 보기
          </Link>
        </div>

        {pendingOrders.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            견적/발주 내역이 없습니다.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full hidden sm:table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">주문번호</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">소매점</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">수량</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">요청일</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((order) => {
                  const qty = (order.order_items ?? []).reduce((s, i) => s + i.quantity, 0)
                  return (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-mono text-gray-900">{order.order_number}</td>
                      <td className="px-6 py-3 text-sm text-gray-900">
                        {order.retailer?.company_name ?? '-'}
                      </td>
                      <td className="px-6 py-3">
                        <span className={cn(
                          'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                          ORDER_STATUS_COLORS[order.status]
                        )}>
                          {getDisplayLabel(order)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-gray-900">{qty}EA</td>
                      <td className="px-6 py-3 text-sm text-gray-500">
                        {formatDateTime(order.created_at)}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <Link
                          href={`/distributor/orders/${order.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          상세
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {pendingOrders.map((order) => {
                const qty = (order.order_items ?? []).reduce((s, i) => s + i.quantity, 0)
                return (
                  <Link key={order.id} href={`/distributor/orders/${order.id}`} className="block p-4 space-y-2 active:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono text-blue-600">{order.order_number}</span>
                      <span className={cn(
                        'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                        ORDER_STATUS_COLORS[order.status]
                      )}>
                        {getDisplayLabel(order)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{order.retailer?.company_name ?? '-'}</span>
                      <span className="text-gray-900 font-medium">{qty}EA</span>
                    </div>
                    <div className="text-xs text-gray-400">{formatDateTime(order.created_at)}</div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
