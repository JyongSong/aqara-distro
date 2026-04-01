'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function HQDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingShipment: 0,
    products: 0,
    distributors: 0,
  })
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return

    const fetchData = async () => {
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })

      const { count: pendingShipment } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['APPROVED', 'HQ_RECEIVED', 'PREPARING'])

      const { count: products } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      const { count: distributors } = await supabase
        .from('users_profile')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'distributor')

      setStats({
        totalOrders: totalOrders || 0,
        pendingShipment: pendingShipment || 0,
        products: products || 0,
        distributors: distributors || 0,
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

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">전체 주문</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalOrders}</p>
        </div>
        <div className="bg-white rounded-xl border border-orange-200 p-6">
          <p className="text-sm text-gray-500">출고 대기</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">{stats.pendingShipment}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">등록 상품</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.products}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">총판 수</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.distributors}</p>
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
