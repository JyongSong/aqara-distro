'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product } from '@/lib/types'
import { formatKRW } from '@/lib/utils'
import Link from 'next/link'

export default function RetailerProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true })

      if (data) setProducts(data)
      setLoading(false)
    }

    fetchProducts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">상품 리스트</h1>
        <p className="text-sm text-gray-500 mt-1">취급 상품 안내</p>
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
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">소비자가</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">견적요청</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">발주요청</th>
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
                        <a
                          href={product.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {product.name}
                        </a>
                      ) : (
                        product.name
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{product.category || '-'}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {product.consumer_price != null ? (
                        formatKRW(product.consumer_price)
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/retailer/orders/new?product_id=${product.id}`}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                      >
                        견적 요청
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/retailer/orders/new-direct?product_id=${product.id}`}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700"
                      >
                        발주 요청
                      </Link>
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
                      <a
                        href={product.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {product.name}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{product.name}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">{product.category || '카테고리 없음'}</p>
                    {product.consumer_price != null && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        소비자가 {formatKRW(product.consumer_price)}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Link
                        href={`/retailer/orders/new?product_id=${product.id}`}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                      >
                        견적 요청
                      </Link>
                      <Link
                        href={`/retailer/orders/new-direct?product_id=${product.id}`}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700"
                      >
                        발주 요청
                      </Link>
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
