'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatKRW } from '@/lib/utils'
import Link from 'next/link'

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }

type ShippedOrder = { hq_total: number | null; shipped_at: string | null }

function sumOrders(orders: ShippedOrder[], from: string, to: string) {
  return orders
    .filter(o => o.shipped_at && o.shipped_at >= from && o.shipped_at <= to)
    .reduce((s, o) => s + (o.hq_total || 0), 0)
}

export default function HQDashboard() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const now = new Date()
  const todayStr    = toDateStr(now)
  const monthStart  = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1))

  // 기간 조회 기본값: 최근 3개월
  const defaultFrom = toDateStr(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()))
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo,   setDateTo]   = useState(todayStr)
  const [applied,  setApplied]  = useState({ from: defaultFrom, to: todayStr })

  const [topStats, setTopStats] = useState({
    totalOrders: 0, pendingShipment: 0,
    products: 0, distributors: 0, activeRetailers: 0,
  })
  const [allOrders, setAllOrders] = useState<ShippedOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      try {
        const [
          { count: totalOrders },
          { count: pendingShipment },
          { count: products },
          { count: distributors },
          { count: activeRetailers },
          { data: shipped },
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
        setTopStats({
          totalOrders: totalOrders || 0,
          pendingShipment: pendingShipment || 0,
          products: products || 0,
          distributors: distributors || 0,
          activeRetailers: activeRetailers || 0,
        })
        setAllOrders(shipped ?? [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile, supabase])

  // 계산
  const monthSales  = sumOrders(allOrders, monthStart, todayStr + 'T23:59:59')
  const todaySales  = sumOrders(allOrders, todayStr, todayStr + 'T23:59:59')
  const periodSales = sumOrders(allOrders, applied.from, applied.to + 'T23:59:59')

  // 최근 3개월 (이번달 제외, 역순)
  const recent3Months = [1, 2, 3].map(i => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const from = toDateStr(d)
    const to   = toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)) + 'T23:59:59'
    return {
      label: `${d.getMonth() + 1}월`,
      sales: sumOrders(allOrders, from, to),
    }
  })

  const applyPreset = useCallback((preset: 'today' | 'month' | '3months') => {
    const to = todayStr
    let from = todayStr
    if (preset === 'month')    from = monthStart
    if (preset === '3months')  from = defaultFrom
    setDateFrom(from); setDateTo(to)
    setApplied({ from, to })
  }, [todayStr, monthStart, defaultFrom])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">본사 대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">전체 현황 요약</p>
      </div>

      {/* 상단 운영 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        {[
          { label: '전체 주문',  value: topStats.totalOrders,    color: 'text-gray-900',   border: 'border-gray-200' },
          { label: '출고 대기',  value: topStats.pendingShipment, color: 'text-orange-600', border: 'border-orange-200' },
          { label: '등록 상품',  value: topStats.products,       color: 'text-blue-600',   border: 'border-gray-200' },
          { label: '총판 수',    value: topStats.distributors,   color: 'text-green-600',  border: 'border-gray-200' },
          { label: '정상 소매점', value: topStats.activeRetailers, color: 'text-emerald-600', border: 'border-emerald-200' },
        ].map(c => (
          <div key={c.label} className={`bg-white rounded-xl border ${c.border} p-4 sm:p-5`}>
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-2xl font-bold mt-1.5 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* 매출현황 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">
          매출현황
          <span className="ml-1.5 text-xs font-normal text-gray-400">(본사 공급가 · 출고완료 기준)</span>
        </h2>

        {/* 1행: 당월 + 당일 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-xs text-violet-500 font-medium mb-1">
              당월 매출
              <span className="ml-1 text-gray-400 font-normal">({now.getMonth() + 1}월)</span>
            </p>
            <p className="text-xl sm:text-2xl font-bold text-violet-700">
              {loading ? '-' : formatKRW(monthSales)}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs text-rose-500 font-medium mb-1">당일 매출 <span className="text-gray-400 font-normal">(오늘)</span></p>
            <p className="text-xl sm:text-2xl font-bold text-rose-700">
              {loading ? '-' : formatKRW(todaySales)}
            </p>
          </div>
        </div>

        {/* 2행: 기간 조회 */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-medium text-blue-600">기간 조회</span>
            <div className="flex items-center gap-1.5">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-2 py-1 border border-blue-200 rounded-lg text-xs text-gray-700 bg-white" />
              <span className="text-gray-400 text-xs">~</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-2 py-1 border border-blue-200 rounded-lg text-xs text-gray-700 bg-white" />
              <button onClick={() => setApplied({ from: dateFrom, to: dateTo })}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                조회
              </button>
            </div>
            <div className="flex gap-1 ml-auto">
              {(['today', 'month', '3months'] as const).map(p => (
                <button key={p} onClick={() => applyPreset(p)}
                  className="px-2 py-1 text-xs rounded-lg border border-blue-200 bg-white text-blue-600 hover:bg-blue-100">
                  {p === 'today' ? '오늘' : p === 'month' ? '이번달' : '최근3개월'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-blue-400 mb-1">{applied.from} ~ {applied.to}</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-700">
            {loading ? '-' : formatKRW(periodSales)}
          </p>
        </div>

        {/* 3행: 최근 3개월 개별 */}
        <div>
          <p className="text-xs text-gray-400 mb-2">최근 3개월</p>
          <div className="grid grid-cols-3 gap-3">
            {recent3Months.map(m => (
              <div key={m.label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs text-gray-500 font-medium mb-1">{m.label}</p>
                <p className="text-base sm:text-lg font-bold text-gray-700">
                  {loading ? '-' : formatKRW(m.sales)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 빠른 링크 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/hq/orders" className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 transition-colors">
          <h3 className="font-semibold text-gray-900">주문 관리</h3>
          <p className="text-sm text-gray-500 mt-1">전체 주문 현황 확인 및 출고 처리</p>
        </Link>
        <Link href="/hq/products" className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 transition-colors">
          <h3 className="font-semibold text-gray-900">상품 관리</h3>
          <p className="text-sm text-gray-500 mt-1">상품 등록, 수정, 옵션 관리</p>
        </Link>
        <Link href="/hq/pricing" className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 transition-colors">
          <h3 className="font-semibold text-gray-900">단가 관리</h3>
          <p className="text-sm text-gray-500 mt-1">총판별 공급단가 설정</p>
        </Link>
      </div>
    </div>
  )
}
