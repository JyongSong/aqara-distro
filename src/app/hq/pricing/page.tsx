'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DistributorPriceQuote, Product, UserProfile } from '@/lib/types'
import { formatKRW, formatDate } from '@/lib/utils'

export default function HQPricingPage() {
  const [quotes, setQuotes] = useState<(DistributorPriceQuote & { product: Product; distributor_profile: UserProfile })[]>([])
  const [distributors, setDistributors] = useState<UserProfile[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const [form, setForm] = useState({
    distributor_id: '',
    product_id: '',
    option_code: '',
    unit_price: '',
    effective_from: '',
    effective_to: '',
  })

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  useEffect(() => {
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = async () => {
    setLoading(true)

    const [quotesRes, distRes, prodRes] = await Promise.all([
      supabase
        .from('distributor_price_quotes')
        .select('*, product:products(*), distributor_profile:users_profile!distributor_id(*)')
        .order('created_at', { ascending: false }),
      supabase
        .from('users_profile')
        .select('*')
        .eq('role', 'distributor'),
      supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name'),
    ])

    if (quotesRes.data) setQuotes(quotesRes.data)
    if (distRes.data) setDistributors(distRes.data)
    if (prodRes.data) setProducts(prodRes.data)
    setLoading(false)
  }

  const handleProductChange = (productId: string) => {
    setForm({ ...form, product_id: productId, option_code: '' })
    const product = products.find(p => p.id === productId)
    setSelectedProduct(product || null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    await supabase.from('distributor_price_quotes').insert({
      distributor_id: form.distributor_id,
      product_id: form.product_id,
      option_code: form.option_code || null,
      unit_price: parseInt(form.unit_price),
      effective_from: form.effective_from,
      effective_to: form.effective_to || null,
    })

    setSaving(false)
    setShowForm(false)
    setForm({ distributor_id: '', product_id: '', option_code: '', unit_price: '', effective_from: '', effective_to: '' })
    setSelectedProduct(null)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 단가를 삭제하시겠습니까?')) return
    await supabase.from('distributor_price_quotes').delete().eq('id', id)
    fetchData()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">총판 공급단가 관리</h1>
          <p className="text-sm text-gray-500 mt-1">본사 → 총판 공급단가 설정 (VAT 별도)</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + 단가 등록
        </button>
      </div>

      {/* 등록 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">총판 공급단가 등록</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">총판</label>
                <select
                  value={form.distributor_id}
                  onChange={(e) => setForm({ ...form, distributor_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">선택하세요</option>
                  {distributors.map(d => (
                    <option key={d.id} value={d.id}>{d.company_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상품</label>
                <select
                  value={form.product_id}
                  onChange={(e) => handleProductChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">선택하세요</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.product_code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {selectedProduct && selectedProduct.options.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">옵션</label>
                  <select
                    value={form.option_code}
                    onChange={(e) => setForm({ ...form, option_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">전체 (옵션 없음)</option>
                    {selectedProduct.options.map(opt => (
                      <option key={opt.code} value={opt.code}>{opt.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">공급단가 (원)</label>
                <input
                  type="number"
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                  required
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                <input
                  type="date"
                  value={form.effective_from}
                  onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">종료일 (선택)</label>
                <input
                  type="date"
                  value={form.effective_to}
                  onChange={(e) => setForm({ ...form, effective_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? '저장 중...' : '등록'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 단가 목록 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">등록된 공급단가</h2>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">로딩 중...</div>
        ) : quotes.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">등록된 단가가 없습니다.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">총판</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">상품</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">옵션</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">공급단가</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">적용기간</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500">관리</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900">{q.distributor_profile?.company_name}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{q.product?.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{q.option_code || '-'}</td>
                  <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">{formatKRW(q.unit_price)}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {formatDate(q.effective_from)} ~ {q.effective_to ? formatDate(q.effective_to) : '무기한'}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <button onClick={() => handleDelete(q.id)} className="text-sm text-red-500 hover:underline">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
