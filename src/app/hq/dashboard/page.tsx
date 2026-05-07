'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatKRW } from '@/lib/utils'
import Link from 'next/link'

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }

function getPreset(preset: 'today' | 'month' | '3months') {
  const today = new Date()
  const to = toDateStr(today)
  if (preset === 'today') return { from: to, to }
  if (preset === 'month') return { from: toDateStr(new Date(today.getFullYear(), today.getMonth(), 1)), to }
  const d = new Date(today); d.setMonth(d.getMonth() - 3)
  return { from: toDateStr(d), to }
}

type ShippedOrder = { hq_total: number | null; shipped_at: string | null }

export default function HQDashboard() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const defaults = getPreset('3months')
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo,   setDateTo]   = useState(defaults.to)

  const [topStats, setTopStats] = useState({
    totalOrders: 0, pendingShipment: 0,
    products: 0, distributors: 0, activeRetailers: 0,
  })
  const [allOrders, setAllOrders] = useState<ShippedOrder[]>([])
  const [loading, setLoading] = useState(true)

  // 상단 카드 + 전체 출고 주문 로드 (한 번만)
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

  // 날짜 필터 계산 (client-side)
  const now = new Date()
  const todayStart  = toDateStr(now)
  const monthStart  = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
  const rangeFrom   = dateFrom
  const rangeTo     = dateTo + 'T23:59:59'

  const periodSales = allOrders
    .filter(o => o.shipped_at && o.shipped_at >= rangeFrom && o.shipped_at <= rangeTo)
    .reduce((s, o) => s + (o.hq_total || 0), 0)
  const monthSales = allOrders
    .filter(o => o.shipped_at && o.shipped_at >= monthStart)
    .reduce((s, o) => s + (o.hq_total || 0), 0)
  const todaySales = allOrders
    .filter(o => o.shipped_at && o.shipped_at >= todayStart)
    .reduce((s, o) => s + (o.hq_total || 0), 0)

  const applyPreset = useCallback((preset: 'today' | 'month' | '3months') => {
    const { from, to } = getPreset(preset)
    setDateFrom(from); setDateTo(to)
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">본사 대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">전체 현황 요약</p>
      </div>

      {/* 상단 운영 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <p className="text-xs text-gray-500">전체 주문</p>
          <p className="text-2xl font-bold text-gray-900 mt-1.5">{topStats.totalOrders}</p>
        </div>
        <div className="bg-white rounded-xl border border-orange-200 p-4 sm:p-5">
          <p className="text-xs text-gray-500">출고 대기</p>
          <p className="text-2xl font-bold text-orange-600 mt-1.5">{topStats.pendingShipment}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <p className="text-xs text-gray-500">등록 상품</p>
          <p className="text-2xl font-bold text-blue-600 mt-1.5">{topStats.products}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <p className="text-xs text-gray-500">총판 수</p>
          <p className="text-2xl font-bold text-green-600 mt-1.5">{topStats.distributors}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-4 sm:p-5">
          <p className="text-xs text-gray-500">정상 소매점</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1.5">{topStats.activeRetailers}</p>
        </div>
      </div>

      {/* 매출현황 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 shrink-0">매출현황
            <span className="ml-1.5 text-xs font-normal text-gray-400">(본사 공급가 · 출고완료 기준)</span>
          </h2>
          {/* 날짜 선택 */}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <div className="flex items-center gap-1.5 text-sm">
              <input
                type="date" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-lg text-xs text-gray-700"
              />
              <span className="text-gray-400 text-xs">~</span>
              <input
                type="date" value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-lg text-xs text-gray-700"
              />
            </div>
            <div className="flex gap-1">
              {(['today', 'month', '3months'] as const).map(p => (
                <button key={p} onClick={() => applyPreset(p)}
                  className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300">
                  {p === 'today' ? '오늘' : p === 'month' ? '이번달' : '최근3개월'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs text-blue-500 font-medium mb-1">
              기간 매출 <span className="text-gray-400 font-normal">({dateFrom} ~ {dateTo})</span>
            </p>
            <p className="text-xl font-bold text-blue-700">
              {loading ? '-' : formatKRW(periodSales)}
            </p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-xs text-violet-500 font-medium mb-1">당월 매출</p>
            <p className="text-xl font-bold text-violet-700">
              {loading ? '-' : formatKRW(monthSales)}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs text-rose-500 font-medium mb-1">당일 매출</p>
            <p className="text-xl font-bold text-rose-700">
              {loading ? '-' : formatKRW(todaySales)}
            </p>
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
