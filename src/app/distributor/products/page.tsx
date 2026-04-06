'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Product, DistributorPriceQuote } from '@/lib/types'
import { formatKRW } from '@/lib/utils'

type ProductWithPrice = Product & { myPrice: number | null }

export default function DistributorProductsPage() {
  const { profile } = useAuth()
  const [products, setProducts] = useState<ProductWithPrice[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return

    const fetchData = async () => {
      setLoading(true)
      const today = new Date().toISOString().slice(0, 10)

      const [prodRes, priceRes] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('category', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('distributor_price_quotes')
          .select('*')
          .eq('distributor_id', profile.id)
          .lte('effective_from', today)
          .or(`effective_to.is.null,effective_to.gte.${today}`)
          .order('effective_from', { ascending: false }),
      ])

      const quotes: DistributorPriceQuote[] = priceRes.data ?? []

      // product_id별로 가장 최신 유효 단가 한 건만 사용 (option_code 없는 것 우선)
      const priceMap = new Map<string, number>()
      for (const q of quotes) {
        if (!priceMap.has(q.product_id)) {
          priceMap.set(q.product_id, q.unit_price)
        }
      }

      const merged: ProductWithPrice[] = (prodRes.data ?? []).map((p: Product) => ({
        ...p,
        myPrice: priceMap.get(p.id) ?? null,
      }))

      setProducts(merged)
      setLoading(false)
    }

    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">상품리스트</h1>
        <p className="text-sm text-gray-500 mt-1">취급 상품 및 본사 공급단가 안내</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">로딩 중...</div>
        ) : products.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">등록된 상품이 없습니다.</div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full hidden lg:table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-14">이미지</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상품명</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">카테고리</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">MOQ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">소비자가</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">공급단가 (VAT별도)</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-10 h-10 object-cover rounded-lg border border-gray-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <span className="text-gray-300 text-xs">없음</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {product.product_url ? (
                        <a href={product.product_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline">{product.name}</a>
                      ) : product.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{product.category || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{product.moq ?? 1}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {product.consumer_price != null
                        ? formatKRW(product.consumer_price)
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      {product.myPrice != null
                        ? <span className="text-blue-700">{formatKRW(product.myPrice)}</span>
                        : <span className="text-gray-300">미등록</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {products.map((product) => (
                <div key={product.id} className="p-4 flex items-start gap-3">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-300 text-xs">없음</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {product.product_url ? (
                      <a href={product.product_url} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline">{product.name}</a>
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{product.name}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">
                      {product.category || '카테고리 없음'} · MOQ {product.moq ?? 1}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {product.consumer_price != null && (
                        <span className="text-xs text-gray-500">
                          소비자가 {formatKRW(product.consumer_price)}
                        </span>
                      )}
                      <span className="text-xs font-medium">
                        {product.myPrice != null
                          ? <span className="text-blue-700">공급가 {formatKRW(product.myPrice)}</span>
                          : <span className="text-gray-300">공급가 미등록</span>}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
