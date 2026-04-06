'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Product, DistributorPriceQuote } from '@/lib/types'
import { formatKRW } from '@/lib/utils'

type ProductWithData = Product & {
  myPrice: number | null
  retailerMoq: number | null
  retailerUnit: number | null
  settingId: string | null
}

export default function DistributorProductsPage() {
  const { profile } = useAuth()
  const [products, setProducts] = useState<ProductWithData[]>([])
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMoq, setEditMoq] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (!profile) return
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const fetchData = async () => {
    if (!profile) return
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)

    const [prodRes, priceRes, settingsRes] = await Promise.all([
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
      supabase
        .from('distributor_retailer_product_settings')
        .select('*')
        .eq('distributor_id', profile.id),
    ])

    const quotes: DistributorPriceQuote[] = priceRes.data ?? []

    // product_id별로 가장 최신 유효 단가 한 건만 사용
    const priceMap = new Map<string, number>()
    for (const q of quotes) {
      if (!priceMap.has(q.product_id)) {
        priceMap.set(q.product_id, q.unit_price)
      }
    }

    // retailer settings map
    const settingsMap = new Map<string, { moq: number | null; order_unit: number | null; id: string }>()
    for (const s of (settingsRes.data ?? [])) {
      settingsMap.set(s.product_id, { moq: s.moq, order_unit: s.order_unit, id: s.id })
    }

    const merged: ProductWithData[] = (prodRes.data ?? []).map((p: Product) => {
      const setting = settingsMap.get(p.id)
      return {
        ...p,
        myPrice: priceMap.get(p.id) ?? null,
        retailerMoq: setting?.moq ?? null,
        retailerUnit: setting?.order_unit ?? null,
        settingId: setting?.id ?? null,
      }
    })

    setProducts(merged)
    setLoading(false)
  }

  const startEdit = (product: ProductWithData) => {
    setEditingId(product.id)
    setEditMoq(product.retailerMoq != null ? String(product.retailerMoq) : '')
    setEditUnit(product.retailerUnit != null ? String(product.retailerUnit) : '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditMoq('')
    setEditUnit('')
  }

  const saveEdit = async (productId: string) => {
    if (!profile) return
    const moqVal = editMoq.trim()
    const unitVal = editUnit.trim()

    if ((moqVal !== '' && isNaN(parseInt(moqVal))) || (unitVal !== '' && isNaN(parseInt(unitVal)))) {
      return
    }

    setSaving(true)
    const payload: Record<string, unknown> = {
      distributor_id: profile.id,
      product_id: productId,
    }
    if (moqVal !== '') payload.moq = parseInt(moqVal)
    if (unitVal !== '') payload.order_unit = parseInt(unitVal)

    await supabase
      .from('distributor_retailer_product_settings')
      .upsert(payload, { onConflict: 'distributor_id,product_id' })

    setSaving(false)
    setEditingId(null)
    setEditMoq('')
    setEditUnit('')
    await fetchData()
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">상품리스트</h1>
        <p className="text-sm text-gray-500 mt-1">취급 상품 및 본사 공급단가 안내 · 소매점 발주 설정 관리</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">로딩 중...</div>
        ) : products.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">등록된 상품이 없습니다.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-14">이미지</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상품명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">카테고리</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">본사 MOQ</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">소비자가</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">공급단가 (VAT별도)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 border-l border-gray-100">소매 MOQ</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">소매 발주단위</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">설정</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const isEditing = editingId === product.id
                    return (
                      <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                        {/* 이미지 */}
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

                        {/* 상품명 */}
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

                        {/* 카테고리 */}
                        <td className="px-4 py-3 text-sm text-gray-500">{product.category || '-'}</td>

                        {/* 본사 MOQ */}
                        <td className="px-4 py-3 text-center text-sm text-gray-600">{product.moq ?? 1}</td>

                        {/* 소비자가 */}
                        <td className="px-4 py-3 text-right text-sm text-gray-700">
                          {product.consumer_price != null ? (
                            formatKRW(product.consumer_price)
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>

                        {/* 공급단가 */}
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          {product.myPrice != null ? (
                            <span className="text-blue-700">{formatKRW(product.myPrice)}</span>
                          ) : (
                            <span className="text-gray-300">미등록</span>
                          )}
                        </td>

                        {/* 소매 MOQ */}
                        <td className="px-4 py-3 text-center text-sm border-l border-gray-100">
                          {isEditing ? (
                            <input
                              type="number"
                              min="1"
                              value={editMoq}
                              onChange={(e) => setEditMoq(e.target.value)}
                              placeholder="MOQ"
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : product.retailerMoq != null ? (
                            <span className="text-gray-800">{product.retailerMoq}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>

                        {/* 소매 발주단위 */}
                        <td className="px-4 py-3 text-center text-sm">
                          {isEditing ? (
                            <input
                              type="number"
                              min="1"
                              value={editUnit}
                              onChange={(e) => setEditUnit(e.target.value)}
                              placeholder="단위"
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : product.retailerUnit != null ? (
                            <span className="text-gray-800">{product.retailerUnit}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>

                        {/* 설정 버튼 */}
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => saveEdit(product.id)}
                                disabled={saving}
                                className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              >
                                {saving ? '저장 중' : '저장'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={saving}
                                className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(product)}
                              className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                            >
                              편집
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {products.map((product) => {
                const isEditing = editingId === product.id
                return (
                  <div key={product.id} className="p-4">
                    <div className="flex items-start gap-3">
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
                        <p className="text-xs text-gray-500 mt-0.5">
                          {product.category || '카테고리 없음'} · 본사 MOQ {product.moq ?? 1}
                        </p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {product.consumer_price != null && (
                            <span className="text-xs text-gray-500">
                              소비자가 {formatKRW(product.consumer_price)}
                            </span>
                          )}
                          <span className="text-xs font-medium">
                            {product.myPrice != null ? (
                              <span className="text-blue-700">공급가 {formatKRW(product.myPrice)}</span>
                            ) : (
                              <span className="text-gray-300">공급가 미등록</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Retailer settings row */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">소매 MOQ</span>
                            <input
                              type="number"
                              min="1"
                              value={editMoq}
                              onChange={(e) => setEditMoq(e.target.value)}
                              placeholder="-"
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500">발주단위</span>
                            <input
                              type="number"
                              min="1"
                              value={editUnit}
                              onChange={(e) => setEditUnit(e.target.value)}
                              placeholder="-"
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => saveEdit(product.id)}
                              disabled={saving}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {saving ? '저장 중' : '저장'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={saving}
                              className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-500">
                              소매 MOQ{' '}
                              <span className={product.retailerMoq != null ? 'text-gray-800 font-medium' : 'text-gray-300'}>
                                {product.retailerMoq != null ? product.retailerMoq : '-'}
                              </span>
                            </span>
                            <span className="text-gray-500">
                              발주단위{' '}
                              <span className={product.retailerUnit != null ? 'text-gray-800 font-medium' : 'text-gray-300'}>
                                {product.retailerUnit != null ? product.retailerUnit : '-'}
                              </span>
                            </span>
                          </div>
                          <button
                            onClick={() => startEdit(product)}
                            className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                          >
                            편집
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
