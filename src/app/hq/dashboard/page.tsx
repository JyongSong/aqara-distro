'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatKRW } from '@/lib/utils'
import Link from 'next/link'

function toDateStr(d: Date) {
  const Y = d.getFullYear()
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const D = String(d.getDate()).padStart(2, '0')
  return `${Y}-${M}-${D}`
}

type ShippedOrder = {
  id: string
  status: string
  shipped_at: string | null
  hq_total: number | null
  retailer_total: number | null
  retailer_id: string | null
  distributor_id: string | null
  retailer?: {
    id: string
    company_name: string
    contact_name: string | null
    phone: string | null
    address: string | null
  } | null
  distributor?: {
    id: string
    company_name: string
    contact_name: string | null
    phone: string | null
    address: string | null
  } | null
}

interface RankingItem {
  id: string
  companyName: string
  contactName: string | null
  phone: string | null
  address: string | null
  totalAmount: number
  orderCount: number
}

interface DetailItem {
  productName: string
  optionCode: string | null
  quantity: number
}

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

  // 기간 조회 기본값: 최근 1개월
  const defaultFrom = toDateStr(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()))
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo,   setDateTo]   = useState(todayStr)
  const [applied,  setApplied]  = useState({ from: defaultFrom, to: todayStr })

  // 실적 분석 전용 기간 조회 상태 (매출현황과 분리)
  const [perfDateFrom, setPerfDateFrom] = useState(defaultFrom)
  const [perfDateTo,   setPerfDateTo]   = useState(todayStr)
  const [perfApplied,  setPerfApplied]  = useState({ from: defaultFrom, to: todayStr })

  const [topStats, setTopStats] = useState({
    totalOrders: 0, pendingShipment: 0, activeRetailers: 0,
  })
  const [allOrders, setAllOrders] = useState<ShippedOrder[]>([])
  const [loading, setLoading] = useState(true)

  // 실적 분석(랭킹 및 하단 내역) 관련 상태
  const [performanceTab, setPerformanceTab] = useState<'retailer' | 'distributor'>('retailer')
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailItems, setDetailItems] = useState<DetailItem[]>([])

  useEffect(() => {
    if (!profile) return
    const load = async () => {
      try {
        const [
          { count: totalOrders },
          { count: pendingShipment },
          { count: activeRetailers },
          { data: shipped },
        ] = await Promise.all([
          supabase.from('orders').select('*', { count: 'exact', head: true }),
          supabase.from('orders').select('*', { count: 'exact', head: true })
            .in('status', ['APPROVED', 'HQ_RECEIVED', 'PREPARING'])
            .neq('fulfillment_type', 'distributor'),
          supabase.from('users_profile').select('*', { count: 'exact', head: true }).eq('role', 'retailer').eq('status', 'active'),
          supabase.from('orders').select(`
            id, status, shipped_at, hq_total, retailer_total, retailer_id, distributor_id,
            retailer:users_profile!retailer_id(id, company_name, contact_name, phone, address),
            distributor:users_profile!distributor_id(id, company_name, contact_name, phone, address)
          `)
            .in('status', ['SHIPPED', 'DELIVERED', 'COMPLETED'])
            .neq('fulfillment_type', 'distributor'),
        ])
        setTopStats({
          totalOrders: totalOrders || 0,
          pendingShipment: pendingShipment || 0,
          activeRetailers: activeRetailers || 0,
        })
        setAllOrders((shipped as any[]) ?? [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile, supabase])

  // 매출 계산 (출고완료 기준)
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

  // 실적 분석 기간 필터링 적용된 주문 데이터 (전용 필터 perfApplied 사용)
  const filteredOrders = useMemo(() => {
    const toEnd = perfApplied.to + 'T23:59:59'
    return allOrders.filter(o => o.shipped_at && o.shipped_at >= perfApplied.from && o.shipped_at <= toEnd)
  }, [allOrders, perfApplied])

  // 聚合 생성 소매점 실적 순위 (본사 공급가 hq_total 기준)
  const retailerRankings = useMemo<RankingItem[]>(() => {
    const map: Record<string, RankingItem> = {}
    filteredOrders.forEach(o => {
      const ret = o.retailer
      if (!ret) return
      const id = ret.id
      if (!map[id]) {
        map[id] = {
          id,
          companyName: ret.company_name,
          contactName: ret.contact_name,
          phone: ret.phone,
          address: ret.address,
          totalAmount: 0,
          orderCount: 0
        }
      }
      map[id].totalAmount += o.hq_total || 0
      map[id].orderCount += 1
    })
    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [filteredOrders])

  // 聚合 생성 총판 실적 순위 (본사 공급가 hq_total 기준)
  const distributorRankings = useMemo<RankingItem[]>(() => {
    const map: Record<string, RankingItem> = {}
    filteredOrders.forEach(o => {
      const dist = o.distributor
      if (!dist) return
      const id = dist.id
      if (!map[id]) {
        map[id] = {
          id,
          companyName: dist.company_name,
          contactName: dist.contact_name,
          phone: dist.phone,
          address: dist.address,
          totalAmount: 0,
          orderCount: 0
        }
      }
      map[id].totalAmount += o.hq_total || 0
      map[id].orderCount += 1
    })
    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [filteredOrders])

  const maxAmount = useMemo(() => {
    const currentList = performanceTab === 'retailer' ? retailerRankings : distributorRankings
    if (currentList.length === 0) return 1
    return currentList[0].totalAmount || 1
  }, [performanceTab, distributorRankings, retailerRankings])

  const selectedMerchant = useMemo(() => {
    const currentList = performanceTab === 'retailer' ? retailerRankings : distributorRankings
    return currentList.find(m => m.id === selectedMerchantId) || null
  }, [selectedMerchantId, performanceTab, distributorRankings, retailerRankings])

  // 소매점/총판의 상세 품목별 구매 합계 비동기 로드
  const loadDetailItems = useCallback(async (merchantId: string) => {
    setDetailLoading(true)
    setDetailItems([])
    try {
      const merchantOrders = filteredOrders.filter(o => 
        performanceTab === 'distributor' ? o.distributor_id === merchantId : o.retailer_id === merchantId
      )
      const orderIds = merchantOrders.map(o => o.id)
      if (orderIds.length === 0) return

      const { data, error } = await supabase
        .from('order_items')
        .select('quantity, option_code, product:products(name)')
        .in('order_id', orderIds)

      if (error) {
        console.error('[dashboard] 상세 항목 로드 실패:', error)
        return
      }

      const aggregationMap: Record<string, { name: string; option: string | null; qty: number }> = {}
      ;(data ?? []).forEach((item: any) => {
        const prodName = item.product?.name ?? '알 수 없는 상품'
        const optCode = item.option_code || null
        const key = `${prodName}_${optCode ?? ''}`

        if (!aggregationMap[key]) {
          aggregationMap[key] = { name: prodName, option: optCode, qty: 0 }
        }
        aggregationMap[key].qty += item.quantity || 0
      })

      const sortedDetails = Object.values(aggregationMap)
        .map(a => ({
          productName: a.name,
          optionCode: a.option,
          quantity: a.qty
        }))
        .sort((a, b) => b.quantity - a.quantity)

      setDetailItems(sortedDetails)
    } finally {
      setDetailLoading(false)
    }
  }, [filteredOrders, performanceTab, supabase])

  useEffect(() => {
    if (selectedMerchantId) {
      loadDetailItems(selectedMerchantId)
    }
  }, [selectedMerchantId, loadDetailItems])

  const applyPreset = useCallback((preset: 'today' | 'month' | '3months') => {
    const to = todayStr
    let from = todayStr
    if (preset === 'month')    from = monthStart
    if (preset === '3months')  from = defaultFrom
    setDateFrom(from); setDateTo(to)
    setApplied({ from, to })
  }, [todayStr, monthStart, defaultFrom])

  // 실적 분석용 전용 단축 기능
  const applyPerfPreset = useCallback((preset: 'today' | 'month' | '1month') => {
    const to = todayStr
    let from = todayStr
    if (preset === 'month')   from = monthStart
    if (preset === '1month')  from = defaultFrom
    setPerfDateFrom(from); setPerfDateTo(to)
    setPerfApplied({ from, to })
    setSelectedMerchantId(null)
  }, [todayStr, monthStart, defaultFrom])

  const handleSearch = () => {
    setApplied({ from: dateFrom, to: dateTo })
    setSelectedMerchantId(null)
  }

  const currentRankings = performanceTab === 'retailer' ? retailerRankings : distributorRankings

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">본사 대시보드</h1>
          <p className="text-sm text-gray-500 mt-1">실시간 운영 현황 및 매출 분석</p>
        </div>
      </div>

      {/* 상단 운영 카드 (3개 카드로 슬림화 및 링크 추가) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/hq/orders" className="group block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-400 hover:shadow-sm transition-all">
          <p className="text-xs text-gray-500 font-semibold group-hover:text-blue-600 transition-colors">전체 주문 ↗</p>
          <p className="text-2xl font-bold mt-1.5 text-gray-900">{topStats.totalOrders} 건</p>
        </Link>
        <Link href="/hq/orders" className="group block bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-400 hover:shadow-sm transition-all">
          <p className="text-xs text-gray-500 font-semibold group-hover:text-orange-600 transition-colors">출고 대기 ↗</p>
          <p className="text-2xl font-bold mt-1.5 text-orange-600">{topStats.pendingShipment} 건</p>
        </Link>
        <div className="bg-white rounded-xl border border-emerald-200 p-5 shadow-sm">
          <p className="text-xs text-gray-500 font-semibold">정상 소매점</p>
          <p className="text-2xl font-bold mt-1.5 text-emerald-600">{topStats.activeRetailers} 개점</p>
        </div>
      </div>

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
                className="px-2 py-1.5 border border-blue-200 rounded-lg text-xs text-gray-700 bg-white focus:outline-none" />
              <span className="text-gray-400 text-xs">~</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-2 py-1.5 border border-blue-200 rounded-lg text-xs text-gray-700 bg-white focus:outline-none" />
              <button onClick={handleSearch}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors">
                조회
              </button>
            </div>
            <div className="flex gap-1 ml-auto">
              {(['today', 'month', '3months'] as const).map(p => (
                <button key={p} onClick={() => applyPreset(p)}
                  className="px-2 py-1 text-xs rounded-lg border border-blue-200 bg-white text-blue-600 hover:bg-blue-100 transition-colors">
                  {p === 'today' ? '오늘' : p === 'month' ? '이번달' : '최근1개월'}
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

      {/* 4. 실적 분석 (매출현황 아래에 새로 추가된 섹션) */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 border-b border-gray-200 gap-2">
          <h2 className="text-base font-bold text-gray-900">📈 실적 분석 (본사 공급가 기준)</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <input type="date" value={perfDateFrom} onChange={e => setPerfDateFrom(e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-700 bg-white focus:outline-none" />
              <span className="text-gray-400 text-xs">~</span>
              <input type="date" value={perfDateTo} onChange={e => setPerfDateTo(e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-700 bg-white focus:outline-none" />
              <button onClick={() => {
                setPerfApplied({ from: perfDateFrom, to: perfDateTo })
                setSelectedMerchantId(null)
              }}
                className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors">
                조회
              </button>
            </div>
            <div className="flex gap-1">
              {(['today', 'month', '1month'] as const).map(p => (
                <button key={p} onClick={() => applyPerfPreset(p)}
                  className="px-2 py-1 text-xs rounded-lg border border-gray-200 bg-white text-blue-600 hover:bg-gray-100 transition-colors">
                  {p === 'today' ? '오늘' : p === 'month' ? '이번달' : '최근1개월'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 랭킹 리스트 (7/12) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden shadow-sm">
            {/* 탭 헤더 */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setPerformanceTab('retailer')
                  setSelectedMerchantId(null)
                }}
                className={`flex-1 py-3 text-center text-xs sm:text-sm font-bold border-b-2 transition-all ${
                  performanceTab === 'retailer'
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                소매점 실적 순위
              </button>
              <button
                onClick={() => {
                  setPerformanceTab('distributor')
                  setSelectedMerchantId(null)
                }}
                className={`flex-1 py-3 text-center text-xs sm:text-sm font-bold border-b-2 transition-all ${
                  performanceTab === 'distributor'
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                총판 실적 순위
              </button>
            </div>

            {/* 랭킹 목록 */}
            <div className="p-4 max-h-[420px] overflow-y-auto space-y-2.5">
              {loading ? (
                <div className="py-20 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : currentRankings.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-gray-400">
                  <span className="text-2xl mb-1">📊</span>
                  <p className="text-xs">이 기간에 집계된 실적이 없습니다.</p>
                </div>
              ) : (
                currentRankings.map((item, index) => {
                  const percent = Math.round((item.totalAmount / maxAmount) * 100)
                  const isSelected = selectedMerchantId === item.id

                  let medal = null
                  if (index === 0) medal = <span className="bg-yellow-50 text-yellow-700 font-bold px-2 py-0.5 rounded-full text-[10px] border border-yellow-200">🥇 1위</span>
                  else if (index === 1) medal = <span className="bg-gray-50 text-gray-600 font-bold px-2 py-0.5 rounded-full text-[10px] border border-gray-200">🥈 2위</span>
                  else if (index === 2) medal = <span className="bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-full text-[10px] border border-amber-200">🥉 3위</span>
                  else medal = <span className="text-xs text-gray-400 font-bold px-1">{index + 1}위</span>

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedMerchantId(item.id)}
                      className={`group p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {medal}
                          <h4 className="text-xs sm:text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                            {item.companyName}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-150 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}></div>
                          </div>
                          <span className="text-[10px] font-semibold text-gray-400 w-6 text-right">{percent}%</span>
                        </div>
                      </div>

                      <div className="text-right whitespace-nowrap pl-2">
                        <p className="text-[11px] font-bold text-blue-700">{formatKRW(item.totalAmount)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{item.orderCount} 건</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* 품목별 하향식(Drill-down) 리포트 (5/12) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden shadow-sm">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-700">📋 품목별 상세 리포트</h3>
              {selectedMerchantId && (
                <button
                  onClick={() => setSelectedMerchantId(null)}
                  className="text-gray-400 hover:text-gray-600 text-[10px] px-2 py-0.5 rounded border border-gray-200 bg-white"
                >
                  닫기
                </button>
              )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto min-h-[300px]">
              {!selectedMerchantId ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center py-12">
                  <span className="text-3xl mb-2">🔍</span>
                  <h4 className="text-xs font-bold text-gray-700 mb-0.5">거래처를 선택해 주세요</h4>
                  <p className="text-[11px] max-w-[180px] leading-relaxed">왼쪽의 소매점/총판 중 하나를 누르시면 이곳에 구매 상세 리포트가 노출됩니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 거래처 미니 프로필 */}
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-gray-900">{selectedMerchant?.companyName}</span>
                      <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.25 rounded">
                        {performanceTab === 'retailer' ? '소매점' : '총판'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 flex justify-between">
                      <span className="text-gray-400">담당자:</span>
                      <span>{selectedMerchant?.contactName || '-'}</span>
                    </p>
                    <p className="text-[11px] text-gray-600 flex justify-between">
                      <span className="text-gray-400">연락처:</span>
                      <span>{selectedMerchant?.phone || '-'}</span>
                    </p>
                  </div>

                  {/* 수량 누적표 */}
                  <div>
                    <h4 className="text-[11px] font-bold text-gray-500 mb-2">📦 품목별 누적 출고량</h4>
                    {detailLoading ? (
                      <div className="py-8 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      </div>
                    ) : detailItems.length === 0 ? (
                      <p className="text-xs text-gray-400 py-6 text-center">출고된 품목이 없습니다.</p>
                    ) : (
                      <div className="border border-gray-150 rounded-lg overflow-hidden text-[11px] shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-55 text-gray-500 font-bold">
                            <tr>
                              <th className="px-3 py-2 text-left">품목명</th>
                              <th className="px-3 py-2 text-right">출고수량</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100 text-gray-700">
                            {detailItems.map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/40">
                                <td className="px-3 py-2 text-left">
                                  <div className="font-semibold text-gray-950">{item.productName}</div>
                                  {item.optionCode && (
                                    <div className="text-[9px] text-gray-400">옵션: {item.optionCode}</div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-gray-900 whitespace-nowrap">
                                  {item.quantity} 개
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
