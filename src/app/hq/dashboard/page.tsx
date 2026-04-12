'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatKRW } from '@/lib/utils'
import Link from 'next/link'

export default function HQDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingShipment: 0,
    products: 0,
    distributors: 0,
    activeRetailers: 0,
    totalSales: 0,
    monthSales: 0,
    todaySales: 0,
  })
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!profile) return

    const fetchData = async () => {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      type ShippedOrder = { hq_total: number | null; shipped_at: string | null }

      const [
        { count: totalOrders },
        { count: pendingShipment },
        { count: products },
        { count: distributors },
        { count: activeRetailers },
        { data: shippedOrders },
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        // 출고대기: 총판출고 주문 제외 (fulfillment_type 컬럼으로 필터)
        supabase.from('orders').select('*', { count: 'exact', head: true })
          .in('status', ['APPROVED', 'HQ_RECEIVED', 'PREPARING'])
          .neq('fulfillment_type', 'distributor'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('users_profile').select('*', { count: 'exact', head: true }).eq('role', 'distributor'),
        supabase.from('users_profile').select('*', { count: 'exact', head: true }).eq('role', 'retailer').eq('status', 'active'),
        // 매출: 총판출고 주문 제외
        // 본사 매출 = hq_total 기준, 출고완료/수령완료/완료 포함
        supabase.from('orders').select('hq_total, shipped_at')
          .in('status', ['SHIPPED', 'DELIVERED', 'COMPLETED'])
          .neq('fulfillment_type', 'distributor'),
      ])

      const orders: ShippedOrder[] = shippedOrders ?? []
      const totalSales = orders.reduce((s: number, o: ShippedOrder) => s + (o.hq_total || 0), 0)
      const monthSales = orders
        .filter((o: ShippedOrder) => o.shipped_at && o.shipped_at >= monthStart)
        .reduce((s: number, o: ShippedOrder) => s + (o.hq_total || 0), 0)
      const todaySales = orders
        .filter((o: ShippedOrder) => o.shipped_at && o.shipped_at >= todayStart)
        .reduce((s: number, o: ShippedOrder) => s + (o.hq_total || 0), 0)

      setStats({
        totalOrders: totalOrders || 0,
        pendingShipment: pendingShipment || 0,
        products: products || 0,
        distributors: distributors || 0,
        activeRetailers: activeRetailers || 0,
        totalSales,
        monthSales,
        todaySales,
      })
    }

    fetchData()
  }, [profile, supabase])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">본사 대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">전체 현황 요약</p>
      </div>

      {/* 통계 카드 - 상단 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500">전체 주문</p>
          <p className="text-2xl font-bold text-gray-900 mt-1.5">{stats.totalOrders}</p>
        </div>
        <div className="bg-white rounded-xl border border-orange-200 p-5">
          <p className="text-xs text-gray-500">출고 대기</p>
          <p className="text-2xl font-bold text-orange-600 mt-1.5">{stats.pendingShipment}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500">등록 상품</p>
          <p className="text-2xl font-bold text-blue-600 mt-1.5">{stats.products}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500">총판 수</p>
          <p className="text-2xl font-bold text-green-600 mt-1.5">{stats.distributors}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 p-5">
          <p className="text-xs text-gray-500">정상 소매점</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1.5">{stats.activeRetailers}</p>
        </div>
      </div>

      {/* 매출 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-8">
        <div className="bg-white rounded-xl border border-blue-200 p-5">
          <p className="text-xs text-blue-500 font-medium mb-1">누적 총매출 <span className="text-gray-400 font-normal">(출고완료)</span></p>
          <p className="text-xl font-bold text-blue-700">{formatKRW(stats.totalSales)}</p>
        </div>
        <div className="bg-white rounded-xl border border-violet-200 p-5">
          <p className="text-xs text-violet-500 font-medium mb-1">당월 매출 <span className="text-gray-400 font-normal">(출고완료)</span></p>
          <p className="text-xl font-bold text-violet-700">{formatKRW(stats.monthSales)}</p>
        </div>
        <div className="bg-white rounded-xl border border-rose-200 p-5">
          <p className="text-xs text-rose-500 font-medium mb-1">당일 매출 <span className="text-gray-400 font-normal">(출고완료)</span></p>
          <p className="text-xl font-bold text-rose-700">{formatKRW(stats.todaySales)}</p>
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
