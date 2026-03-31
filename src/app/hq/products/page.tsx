'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, ProductOption } from '@/lib/types'

export default function HQProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // 폼 상태
  const [form, setForm] = useState({
    product_code: '',
    name: '',
    category: '',
    options: [] as ProductOption[],
    is_active: true,
  })
  const [newOption, setNewOption] = useState({ code: '', name: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchProducts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchProducts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setProducts(data)
    setLoading(false)
  }

  const resetForm = () => {
    setForm({ product_code: '', name: '', category: '', options: [], is_active: true })
    setNewOption({ code: '', name: '' })
    setEditingProduct(null)
    setShowForm(false)
  }

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setForm({
      product_code: product.product_code,
      name: product.name,
      category: product.category || '',
      options: product.options || [],
      is_active: product.is_active,
    })
    setShowForm(true)
  }

  const addOption = () => {
    if (!newOption.code || !newOption.name) return
    setForm({ ...form, options: [...form.options, { ...newOption }] })
    setNewOption({ code: '', name: '' })
  }

  const removeOption = (index: number) => {
    setForm({ ...form, options: form.options.filter((_, i) => i !== index) })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      product_code: form.product_code,
      name: form.name,
      category: form.category || null,
      options: form.options,
      is_active: form.is_active,
    }

    if (editingProduct) {
      await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProduct.id)
    } else {
      await supabase.from('products').insert(payload)
    }

    setSaving(false)
    resetForm()
    fetchProducts()
  }

  const toggleActive = async (product: Product) => {
    await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id)
    fetchProducts()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">상품 관리</h1>
          <p className="text-sm text-gray-500 mt-1">상품 등록 및 옵션 관리</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + 상품 등록
        </button>
      </div>

      {/* 상품 등록/수정 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingProduct ? '상품 수정' : '새 상품 등록'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상품코드</label>
                <input
                  type="text"
                  value={form.product_code}
                  onChange={(e) => setForm({ ...form, product_code: e.target.value })}
                  required
                  disabled={!!editingProduct}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                  placeholder="예: DL-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상품명</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="예: 스마트 도어락 L100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="예: 도어락"
                />
              </div>
            </div>

            {/* 옵션 관리 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">옵션</label>
              {form.options.length > 0 && (
                <div className="space-y-1 mb-2">
                  {form.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 bg-gray-100 rounded text-gray-700">{opt.code}</span>
                      <span className="text-gray-600">{opt.name}</span>
                      <button type="button" onClick={() => removeOption(i)} className="text-red-500 hover:text-red-700 text-xs">
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newOption.code}
                  onChange={(e) => setNewOption({ ...newOption, code: e.target.value })}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="옵션코드"
                />
                <input
                  type="text"
                  value={newOption.name}
                  onChange={(e) => setNewOption({ ...newOption, name: e.target.value })}
                  className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="옵션명"
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                >
                  추가
                </button>
              </div>
            </div>

            {/* 활성 상태 */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">활성 상태</span>
            </label>

            {/* 버튼 */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : editingProduct ? '수정' : '등록'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 상품 목록 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">상품 목록</h2>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">로딩 중...</div>
        ) : products.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">등록된 상품이 없습니다.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">상품코드</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">상품명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">카테고리</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">옵션</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500">상태</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500">관리</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-mono text-gray-900">{product.product_code}</td>
                  <td className="px-6 py-3 text-sm text-gray-900">{product.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{product.category || '-'}</td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(product.options || []).map((opt, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                          {opt.name}
                        </span>
                      ))}
                      {(!product.options || product.options.length === 0) && (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {product.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(product)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => toggleActive(product)}
                        className="text-sm text-gray-500 hover:underline"
                      >
                        {product.is_active ? '비활성화' : '활성화'}
                      </button>
                    </div>
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
