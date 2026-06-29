'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatKRW } from '@/lib/utils'
import { OrderStatus, ORDER_STATUS_LABELS } from '@/lib/types'

function toDateStr(d: Date) {
  const Y = d.getFullYear()
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const D = String(d.getDate()).padStart(2, '0')
  return `${Y}-${M}-${D}`
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

// 默认不包含 DRAFT 和 REJECTED 的有效状态
const DEFAULT_STATUSES: OrderStatus[] = [
  'SHIPPED',
  'DELIVERED',
  'COMPLETED'
]

// 所有的状态列表，用于过滤器
const ALL_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'SHIPPED', label: '출고완료' },
  { value: 'DELIVERED', label: '수령완료' },
  { value: 'COMPLETED', label: '완료' }
]

export default function HQPerformance() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const now = new Date()
  const todayStr = toDateStr(now)
  const monthStart = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
  const defaultFrom = toDateStr(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())) // 默认设置为最近 1 个月

  // 状态定义
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(todayStr)
  const [appliedDates, setAppliedDates] = useState({ from: defaultFrom, to: todayStr })
  const [selectedStatuses, setSelectedStatuses] = useState<OrderStatus[]>(DEFAULT_STATUSES)
  const [showStatusFilter, setShowStatusFilter] = useState(false)

  const [activeTab, setActiveTab] = useState<'distributor' | 'retailer'>('retailer')
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // 下钻相关状态
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailItems, setDetailItems] = useState<DetailItem[]>([])

  // 获取数据
  const loadOrders = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setSelectedMerchantId(null) // 重置选择的商家
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, status, created_at, shipped_at, hq_total, retailer_total, retailer_id, distributor_id, fulfillment_type,
          retailer:users_profile!retailer_id(id, company_name, contact_name, phone, address),
          distributor:users_profile!distributor_id(id, company_name, contact_name, phone, address)
        `)
        .in('status', selectedStatuses)
        .neq('fulfillment_type', 'distributor')
        .gte('shipped_at', appliedDates.from + 'T00:00:00')
        .lte('shipped_at', appliedDates.to + 'T23:59:59')

      if (error) {
        console.error('[performance] 주문 조회 실패:', error)
        return
      }
      setOrders(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [profile, supabase, appliedDates, selectedStatuses])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // 时间预设快捷键
  const applyPreset = useCallback((preset: 'today' | 'month' | '3months') => {
    const to = todayStr
    let from = todayStr
    if (preset === 'month') from = monthStart
    if (preset === '3months') from = defaultFrom
    setDateFrom(from)
    setDateTo(to)
    setAppliedDates({ from, to })
  }, [todayStr, monthStart, defaultFrom])

  // 计算顶部汇总 KPI
  const stats = useMemo(() => {
    let totalHqAmount = 0
    let totalRetailerAmount = 0
    const activeDistributors = new Set<string>()
    const activeRetailers = new Set<string>()

    orders.forEach(o => {
      totalHqAmount += o.hq_total || 0
      totalRetailerAmount += o.retailer_total || 0 // 소매 공급가 기준 합산
      if (o.distributor_id) activeDistributors.add(o.distributor_id)
      if (o.retailer_id) activeRetailers.add(o.retailer_id)
    })

    return {
      totalHqAmount,
      totalRetailerAmount,
      orderCount: orders.length,
      distributorCount: activeDistributors.size,
      retailerCount: activeRetailers.size
    }
  }, [orders])

  // 聚合生成总销商排行榜
  const distributorRankings = useMemo<RankingItem[]>(() => {
    const map: Record<string, RankingItem> = {}

    orders.forEach(o => {
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
  }, [orders])

  // 聚合生成零售商排行榜
  const retailerRankings = useMemo<RankingItem[]>(() => {
    const map: Record<string, RankingItem> = {}

    orders.forEach(o => {
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
      map[id].totalAmount += o.retailer_total || 0 // 소매 공급가 기준 합산
      map[id].orderCount += 1
    })

    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [orders])

  // 当前排行榜的最大金额，用于计算进度条占比
  const maxAmount = useMemo(() => {
    const currentList = activeTab === 'distributor' ? distributorRankings : retailerRankings
    if (currentList.length === 0) return 1
    return currentList[0].totalAmount || 1
  }, [activeTab, distributorRankings, retailerRankings])

  // 当前选择的商家对象信息
  const selectedMerchant = useMemo(() => {
    const currentList = activeTab === 'distributor' ? distributorRankings : retailerRankings
    return currentList.find(m => m.id === selectedMerchantId) || null
  }, [selectedMerchantId, activeTab, distributorRankings, retailerRankings])

  // 点击加载下钻的订购商品明细
  const loadDetailItems = useCallback(async (merchantId: string) => {
    setDetailLoading(true)
    setDetailItems([])
    try {
      // 找出当前商家在筛选条件下的所有订单 ID
      const merchantOrders = orders.filter(o => 
        activeTab === 'distributor' ? o.distributor_id === merchantId : o.retailer_id === merchantId
      )
      const orderIds = merchantOrders.map(o => o.id)

      if (orderIds.length === 0) {
        setDetailItems([])
        return
      }

      // 分批或一次性根据订单 ID 查询订单明细
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          quantity,
          option_code,
          product:products(name)
        `)
        .in('order_id', orderIds)

      if (error) {
        console.error('[performance] 상세 항목 조회 실패:', error)
        return
      }

      // 在前端按商品名称和选项聚合累计数量
      const aggregationMap: Record<string, { name: string; option: string | null; qty: number }> = {}
      ;(data ?? []).forEach((item: any) => {
        const prodName = item.product?.name ?? '알 수 없는 상품'
        const optCode = item.option_code || null
        const key = `${prodName}_${optCode ?? ''}`

        if (!aggregationMap[key]) {
          aggregationMap[key] = {
            name: prodName,
            option: optCode,
            qty: 0
          }
        }
        aggregationMap[key].qty += item.quantity || 0
      })

      // 转换为数组并按订购数量降序排列
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
  }, [orders, activeTab, supabase])

  // 当选择商家改变时触发加载
  useEffect(() => {
    if (selectedMerchantId) {
      loadDetailItems(selectedMerchantId)
    }
  }, [selectedMerchantId, loadDetailItems])

  // 处理状态复选框变更
  const toggleStatus = (status: OrderStatus) => {
    setSelectedStatuses(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status)
      } else {
        return [...prev, status]
      }
    })
  }

  // 全选或清空状态
  const selectAllStatuses = () => {
    setSelectedStatuses(ALL_STATUS_OPTIONS.map(o => o.value))
  }
  const clearAllStatuses = () => {
    setSelectedStatuses([])
  }

  const currentRankings = activeTab === 'distributor' ? distributorRankings : retailerRankings

  return (
    <div className="flex flex-col h-full">
      {/* 顶部标题 */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">실적 분석</h1>
          <p className="text-sm text-gray-500 mt-1">총판 및 소매점의 주문 실적 순위와 상세 구매 분석</p>
        </div>
      </div>

      {/* 1. 필터 및 기간 설정 영역 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* 기간 필터 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">조회 기간</span>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-xs">~</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => setAppliedDates({ from: dateFrom, to: dateTo })}
                className="ml-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                조회
              </button>
            </div>
            {/* 단축 버튼 */}
            <div className="flex gap-1 ml-2">
              {(['today', 'month', '3months'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  {p === 'today' ? '오늘' : p === 'month' ? '이번달' : '최근 3개월'}
                </button>
              ))}
            </div>
          </div>

          {/* 상태 필터 (Drop-down 복수 선택) */}
          <div className="relative">
            <button
              onClick={() => setShowStatusFilter(!showStatusFilter)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 bg-white hover:bg-gray-50 flex items-center gap-1.5 focus:outline-none"
            >
              <span>주문 상태 ({selectedStatuses.length}개 선택됨)</span>
              <span className="text-[10px] text-gray-400">▼</span>
            </button>

            {showStatusFilter && (
              <div className="absolute left-0 mt-1.5 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-30">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-700">상태 선택</span>
                  <div className="flex gap-2">
                    <button onClick={selectAllStatuses} className="text-[10px] text-blue-600 hover:underline">전체선택</button>
                    <button onClick={clearAllStatuses} className="text-[10px] text-gray-500 hover:underline">전체해제</button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {ALL_STATUS_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 hover:text-gray-900">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(opt.value)}
                        onChange={() => toggleStatus(opt.value)}
                        className="rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => {
                      setShowStatusFilter(false)
                      loadOrders()
                    }}
                    className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-medium rounded hover:bg-blue-700"
                  >
                    적용
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. 상단 요약 지표 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">본사 총 공급액 (출고 완료 기준)</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
            {loading ? '-' : formatKRW(stats.totalHqAmount)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">소매 총 주문액 (소매 공급가 기준)</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
            {loading ? '-' : formatKRW(stats.totalRetailerAmount)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">총 주문 건수</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
            {loading ? '-' : `${stats.orderCount} 건`}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">활동 거래처 수 (총판 / 소매점)</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
            {loading ? '-' : `${stats.distributorCount} / ${stats.retailerCount} 개`}
          </p>
        </div>
      </div>

      {/* 3. 하단 실적 랭킹 및 상세 내역 분할 뷰 */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
        {/* 왼쪽: 랭킹 리스트 (8/12) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          {/* 탭 헤더 */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => {
                setActiveTab('retailer')
                setSelectedMerchantId(null)
              }}
              className={`flex-1 py-3.5 text-center text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'retailer'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              소매점 실적 순위 (소매 공급 기준)
            </button>
            <button
              onClick={() => {
                setActiveTab('distributor')
                setSelectedMerchantId(null)
              }}
              className={`flex-1 py-3.5 text-center text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'distributor'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              총판 실적 순위 (본사 공급 기준)
            </button>
          </div>

          {/* 랭킹 내용 */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : currentRankings.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <span className="text-3xl mb-2">📊</span>
                <p className="text-sm">해당 기간 및 조건의 주문 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentRankings.map((item, index) => {
                  const percent = Math.round((item.totalAmount / maxAmount) * 100)
                  const isSelected = selectedMerchantId === item.id

                  // Medal badges for top 3
                  let medal = null
                  if (index === 0) medal = <span className="bg-yellow-50 text-yellow-700 font-bold px-2 py-0.5 rounded-full text-xs border border-yellow-200">🥇 1위</span>
                  else if (index === 1) medal = <span className="bg-gray-50 text-gray-600 font-bold px-2 py-0.5 rounded-full text-xs border border-gray-200">🥈 2위</span>
                  else if (index === 2) medal = <span className="bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-full text-xs border border-amber-200">🥉 3위</span>
                  else medal = <span className="text-xs text-gray-400 font-semibold px-1">{index + 1}위</span>

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedMerchantId(item.id)}
                      className={`group p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      {/* 좌측: 순위 및 상호명 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          {medal}
                          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                            {item.companyName}
                          </h3>
                        </div>
                        {/* 渐变百分比进度条 */}
                        <div className="flex items-center gap-3 w-full">
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                          <span className="text-[11px] font-bold text-gray-500 w-8 text-right">{percent}%</span>
                        </div>
                      </div>

                      {/* 우측: 매출/건수 */}
                      <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] text-gray-400 font-medium">주문 건수</p>
                          <p className="text-sm font-semibold text-gray-700">{item.orderCount} 건</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 font-medium">실적 합계</p>
                          <p className="text-base font-bold text-blue-700">{formatKRW(item.totalAmount)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 상세 내역 하단 분할 뷰 / 상세 팝업 (4/12) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700">📋 상세 실적 리포트</h2>
            {selectedMerchantId && (
              <button
                onClick={() => setSelectedMerchantId(null)}
                className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded border border-gray-200 bg-white"
              >
                닫기
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!selectedMerchantId ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-6">
                <span className="text-4xl mb-3">🔍</span>
                <h3 className="font-semibold text-gray-700 mb-1">거래처를 선택해 주세요</h3>
                <p className="text-xs max-w-[200px]">왼쪽 리스트에서 거래처를 선택하면 기간 내 상세 구매 상품 및 수량이 여기에 표시됩니다.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* 거래처 기본 정보 */}
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded">
                      {activeTab === 'distributor' ? '총판' : '소매점'}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium">거래처 상세</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900">{selectedMerchant?.companyName}</h3>
                  <div className="text-xs space-y-1 text-gray-600">
                    <p className="flex justify-between">
                      <span className="text-gray-400">담당자:</span>
                      <span className="font-medium text-gray-800">{selectedMerchant?.contactName || '-'}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-400">연락처:</span>
                      <span className="font-medium text-gray-800">{selectedMerchant?.phone || '-'}</span>
                    </p>
                    <p className="flex flex-col pt-1 border-t border-gray-200/50 mt-1">
                      <span className="text-gray-400 mb-0.5">주소:</span>
                      <span className="font-medium text-gray-700 leading-relaxed">{selectedMerchant?.address || '-'}</span>
                    </p>
                  </div>
                </div>

                {/* 구매 제품 분석 */}
                <div>
                  <h3 className="text-xs font-bold text-gray-600 mb-3 flex items-center gap-1.5">
                    📦 기간 내 품목별 누적 주문량
                    <span className="text-[10px] text-gray-400 font-normal">({appliedDates.from} ~ {appliedDates.to})</span>
                  </h3>

                  {detailLoading ? (
                    <div className="py-12 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : detailItems.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-xs border border-dashed border-gray-200 rounded-xl">
                      주문한 상품이 없습니다.
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 text-gray-500 font-semibold">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left">상품명</th>
                            <th scope="col" className="px-4 py-3 text-right">주문 수량</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-150 text-gray-700">
                          {detailItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3 text-left">
                                <div className="font-semibold text-gray-950">{item.productName}</div>
                                {item.optionCode && (
                                  <div className="text-[10px] text-gray-400 mt-0.5">옵션: {item.optionCode}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
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
  )
}
