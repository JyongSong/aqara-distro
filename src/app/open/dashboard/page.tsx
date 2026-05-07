'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatKRW } from '@/lib/utils'

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

  useEffect(() => { fetchStats(dateFrom, dateTo) }, [])   // 최초 로드

  const applyPreset = (preset: 'today' | 'month' | '3months') => {
    const { from, to } = getPreset(preset)
    setDateFrom(from); setDateTo(to)
    fetchStats(from, to)
  }

  const handleSearch = () => fetchStats(dateFrom, dateTo)

  const now = new Date()
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`

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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 shrink-0">
              매출현황
              <span className="ml-1.5 text-xs font-normal text-gray-400">(본사 공급가 · 출고완료 기준)</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <div className="flex items-center gap-1.5">
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
                <button
                  onClick={handleSearch}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                >
                  조회
                </button>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-xs text-blue-500 font-medium mb-1">
                기간 매출
                <span className="text-gray-400 font-normal ml-1">
                  ({stats?.dateFrom ?? dateFrom} ~ {stats?.dateTo ?? dateTo})
                </span>
              </p>
              <p className="text-2xl font-bold text-blue-700">
                {loading ? '-' : formatKRW(stats?.periodSales ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-5">
              <p className="text-xs text-violet-500 font-medium mb-1">
                당월 매출 <span className="text-gray-400 font-normal">({monthLabel})</span>
              </p>
              <p className="text-2xl font-bold text-violet-700">
                {loading ? '-' : formatKRW(stats?.monthSales ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
              <p className="text-xs text-rose-500 font-medium mb-1">당일 매출 <span className="text-gray-400 font-normal">(오늘)</span></p>
              <p className="text-2xl font-bold text-rose-700">
                {loading ? '-' : formatKRW(stats?.todaySales ?? 0)}
              </p>
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
