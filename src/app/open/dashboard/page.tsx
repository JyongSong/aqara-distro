'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatKRW } from '@/lib/utils'

type MonthEntry = { label: string; sales: number }

type Stats = {
  totalOrders: number
  pendingShipment: number
  products: number
  distributors: number
  activeRetailers: number
  periodSales: number
  monthSales: number
  todaySales: number
  dateFrom: string
  dateTo: string
  recent3Months: MonthEntry[]
  updatedAt: string
}

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }

function getPreset(preset: 'today' | 'month' | '3months') {
  const today = new Date()
  const to = toDateStr(today)
  if (preset === 'today') return { from: to, to }
  if (preset === 'month') return { from: toDateStr(new Date(today.getFullYear(), today.getMonth(), 1)), to }
  const d = new Date(today); d.setMonth(d.getMonth() - 3)
  return { from: toDateStr(d), to }
}

export default function OpenDashboardPage() {
  const defaults = getPreset('3months')
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo,   setDateTo]   = useState(defaults.to)
  const [applied,  setApplied]  = useState({ from: defaults.from, to: defaults.to })
  const [stats,    setStats]    = useState<Stats | null>(null)
  const [loading,  setLoading]  = useState(true)

  const fetchStats = useCallback(async (from: string, to: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/open/dashboard?from=${from}&to=${to}`)
      const data = await res.json()
      setStats(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats(defaults.from, defaults.to) }, [])   // 최초 로드

  const applyPreset = (preset: 'today' | 'month' | '3months') => {
    const { from, to } = getPreset(preset)
    setDateFrom(from); setDateTo(to)
    setApplied({ from, to })
    fetchStats(from, to)
  }

  const handleSearch = () => {
    setApplied({ from: dateFrom, to: dateTo })
    fetchStats(dateFrom, dateTo)
  }

  const now = new Date()
  const monthLabel = `${now.getMonth() + 1}월`

  // 클라이언트에서 레이블 고정 (HQ 대시보드와 동일 방식)
  const recent3Months = [1, 2, 3].map(i => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = `${d.getMonth() + 1}월`
    const entry = stats?.recent3Months?.find(m => m.label === label)
    return { label, sales: entry?.sales ?? 0 }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Aqara Life</h1>
            <p className="text-sm text-gray-500 mt-0.5">유통 현황 대시보드</p>
          </div>
          <p className="text-xs text-gray-400">
            {loading ? '로딩 중...' : stats ? `${new Date(stats.updatedAt).toLocaleString('ko-KR')} 기준` : ''}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* 매출현황 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">
            매출현황
            <span className="ml-1.5 text-xs font-normal text-gray-400">(본사 공급가 · 출고완료 기준)</span>
          </h2>

          {/* 1행: 당월 + 당일 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs text-violet-500 font-medium mb-1">
                당월 매출
                <span className="ml-1 text-gray-400 font-normal">({monthLabel})</span>
              </p>
              <p className="text-xl sm:text-2xl font-bold text-violet-700">
                {loading ? '-' : formatKRW(stats?.monthSales ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs text-rose-500 font-medium mb-1">당일 매출 <span className="text-gray-400 font-normal">(오늘)</span></p>
              <p className="text-xl sm:text-2xl font-bold text-rose-700">
                {loading ? '-' : formatKRW(stats?.todaySales ?? 0)}
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
                <button onClick={handleSearch}
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
              {loading ? '-' : formatKRW(stats?.periodSales ?? 0)}
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

        {/* 운영 현황 */}
        {stats && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-3">운영 현황</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500">전체 주문</p>
                <p className="text-2xl font-bold text-gray-900 mt-1.5">{stats.totalOrders.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">건</p>
              </div>
              <div className="bg-white rounded-xl border border-orange-200 p-5">
                <p className="text-xs text-gray-500">출고 대기</p>
                <p className="text-2xl font-bold text-orange-600 mt-1.5">{stats.pendingShipment.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">건</p>
              </div>
              <div className="bg-white rounded-xl border border-green-200 p-5">
                <p className="text-xs text-gray-500">총판 수</p>
                <p className="text-2xl font-bold text-green-600 mt-1.5">{stats.distributors.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">개사</p>
              </div>
              <div className="bg-white rounded-xl border border-emerald-200 p-5">
                <p className="text-xs text-gray-500">정상 소매점</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1.5">{stats.activeRetailers.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">개점</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="text-center py-6 text-xs text-gray-300">
        © 2026 Aqara Life. All rights reserved.
      </div>
    </div>
  )
}
