'use client'

import { useEffect, useState } from 'react'
import { formatKRW } from '@/lib/utils'

type Stats = {
  totalOrders: number
  pendingShipment: number
  products: number
  distributors: number
  activeRetailers: number
  totalSales: number
  monthSales: number
  todaySales: number
  updatedAt: string
}

export default function OpenDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const res = await fetch('/api/open/dashboard')
      const data = await res.json()
      setStats(data)
      setLoading(false)
    }
    fetchStats()
  }, [])

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
          <div className="text-right">
            <p className="text-xs text-gray-400">
              {loading ? '로딩 중...' : stats ? `${new Date(stats.updatedAt).toLocaleString('ko-KR')} 기준` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">데이터를 불러오는 중...</div>
        ) : !stats ? (
          <div className="text-center py-20 text-gray-400 text-sm">데이터를 불러올 수 없습니다.</div>
        ) : (
          <>
            {/* 매출 통계 */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 mb-3">매출 현황 (본사 공급가 기준, 부가세 별도)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-blue-200 p-6">
                  <p className="text-xs text-blue-500 font-medium mb-1">누적 총매출</p>
                  <p className="text-2xl font-bold text-blue-700">{formatKRW(stats.totalSales)}</p>
                </div>
                <div className="bg-white rounded-xl border border-violet-200 p-6">
                  <p className="text-xs text-violet-500 font-medium mb-1">당월 매출 <span className="text-gray-400 font-normal">({monthLabel})</span></p>
                  <p className="text-2xl font-bold text-violet-700">{formatKRW(stats.monthSales)}</p>
                </div>
                <div className="bg-white rounded-xl border border-rose-200 p-6">
                  <p className="text-xs text-rose-500 font-medium mb-1">당일 매출 <span className="text-gray-400 font-normal">(오늘)</span></p>
                  <p className="text-2xl font-bold text-rose-700">{formatKRW(stats.todaySales)}</p>
                </div>
              </div>
            </div>

            {/* 운영 현황 */}
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
          </>
        )}
      </div>

      <div className="text-center py-6 text-xs text-gray-300">
        © 2026 Aqara Life. All rights reserved.
      </div>
    </div>
  )
}
