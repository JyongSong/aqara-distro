'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product, ProductOption } from '@/lib/types'
import { formatKRW } from '@/lib/utils'

export default function HQProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  // 폼 상태
  const [form, setForm] = useState({
    product_code: '',
    name: '',
    category: '',
    options: [] as ProductOption[],
    is_active: true,
    moq: 1,
    order_unit: 1,
    consumer_price: '',
    product_url: '',
    erp_code: '',
  })
  const [newOption, setNewOption] = useState({ code: '', name: '' })
  const [saving, setSaving] = useState(false)

  // 이미지 상태
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

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

  const revokeBlobUrl = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }

  const resetForm = () => {
    setForm({ product_code: '', name: '', category: '', options: [], is_active: true, moq: 1, order_unit: 1, consumer_price: '', product_url: '', erp_code: '' })
    setNewOption({ code: '', name: '' })
    setEditingProduct(null)
    setShowForm(false)
    setImageFile(null)
    revokeBlobUrl()
    setImagePreview(null)
  }

  const openEdit = (product: Product) => {
    setEditingProduct(product)
    setForm({
      product_code: product.product_code,
      name: product.name,
      category: product.category || '',
      options: product.options || [],
      is_active: product.is_active,
      moq: product.moq ?? 1,
      order_unit: product.order_unit ?? 1,
      consumer_price: product.consumer_price != null ? String(product.consumer_price) : '',
      product_url: product.product_url || '',
      erp_code: product.erp_code || '',
    })
    setImageFile(null)
    revokeBlobUrl()
    setImagePreview(product.image_url || null)
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    revokeBlobUrl()
    const blobUrl = URL.createObjectURL(file)
    blobUrlRef.current = blobUrl
    setImagePreview(blobUrl)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    let image_url = editingProduct?.image_url ?? null

    // 새 이미지 파일이 있으면 Storage에 업로드
    if (imageFile) {
      const ext = imageFile.name.split('.').pop() || 'jpg'
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, imageFile, { upsert: false })

      if (uploadError) {
        alert('이미지 업로드에 실패했습니다. 다시 시도해주세요.')
        setSaving(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(uploadData.path)

      image_url = publicUrl
    }

    const payload = {
      product_code: form.product_code,
      name: form.name,
      category: form.category || null,
      options: form.options,
      is_active: form.is_active,
      moq: form.moq,
      order_unit: form.order_unit,
      image_url,
      consumer_price: form.consumer_price ? parseInt(form.consumer_price) : null,
      product_url: form.product_url || null,
      erp_code: form.erp_code || null,
    }

    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProduct.id)
      if (error) {
        alert('상품 수정에 실패했습니다.')
        setSaving(false)
        return
      }
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) {
        alert('상품 등록에 실패했습니다.')
        setSaving(false)
        return
      }
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
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

            {/* MOQ + 발주 단위 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  최소 발주 수량 (MOQ)
                </label>
                <input
                  type="number"
                  value={form.moq}
                  onChange={(e) => setForm({ ...form, moq: Math.max(1, parseInt(e.target.value) || 1) })}
                  min="1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  발주 단위 <span className="text-gray-400 font-normal">(예: 5 → 5개씩 증감)</span>
                </label>
                <input
                  type="number"
                  value={form.order_unit}
                  onChange={(e) => setForm({ ...form, order_unit: Math.max(1, parseInt(e.target.value) || 1) })}
                  min="1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* 소비자가 + ERP 코드 + 상품 링크 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  소비자가 (원) <span className="text-gray-400 font-normal text-xs">VAT 포함</span>
                </label>
                <input
                  type="number"
                  value={form.consumer_price}
                  onChange={(e) => setForm({ ...form, consumer_price: e.target.value })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="예: 150000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ERP 코드
                </label>
                <input
                  type="text"
                  value={form.erp_code}
                  onChange={(e) => setForm({ ...form, erp_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="예: AQ-DL100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상품 링크 URL
                </label>
                <input
                  type="url"
                  value={form.product_url}
                  onChange={(e) => setForm({ ...form, product_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="https://example.com/product/..."
                />
              </div>
            </div>

            {/* 상품 이미지 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">상품 이미지</label>
              <div className="flex items-start gap-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="상품 미리보기"
                    className="w-24 h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-gray-400 text-center leading-tight">이미지<br/>없음</span>
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP 권장 · 정사각형 이미지</p>
                </div>
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
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newOption.code}
                  onChange={(e) => setNewOption({ ...newOption, code: e.target.value })}
                  className="w-28 sm:w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="옵션코드"
                />
                <input
                  type="text"
                  value={newOption.name}
                  onChange={(e) => setNewOption({ ...newOption, name: e.target.value })}
                  className="flex-1 min-w-[8rem] px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
          <>
            {/* Desktop table */}
            <table className="w-full hidden lg:table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-14">이미지</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상품코드</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">상품명</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">카테고리</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">옵션</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">MOQ/단위</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">소비자가</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">ERP 코드</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">상태</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">관리</th>
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
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{product.product_code}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {product.product_url ? (
                        <a href={product.product_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline">{product.name}</a>
                      ) : product.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{product.category || '-'}</td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-center text-xs text-gray-600">
                      <span className="block">MOQ: {product.moq ?? 1}</span>
                      <span className="block text-gray-400">단위: {product.order_unit ?? 1}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {product.consumer_price != null ? formatKRW(product.consumer_price) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-left text-sm font-mono text-gray-500">
                      {product.erp_code || <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {product.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
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
                    <div className="flex items-start justify-between gap-2">
                      {product.product_url ? (
                        <a href={product.product_url} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline">{product.name}</a>
                      ) : (
                        <span className="text-sm font-medium text-gray-900">{product.name}</span>
                      )}
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                        product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {product.is_active ? '활성' : '비활성'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">
                      {product.product_code}{product.category ? ` · ${product.category}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      MOQ: {product.moq ?? 1} / 단위: {product.order_unit ?? 1}
                      {product.consumer_price != null && (
                        <span className="ml-2 text-gray-500">소비자가: {formatKRW(product.consumer_price)}</span>
                      )}
                      {product.erp_code && (
                        <span className="ml-2 font-mono text-gray-500">ERP: {product.erp_code}</span>
                      )}
                    </p>
                    {(product.options || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(product.options || []).map((opt, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                            {opt.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => openEdit(product)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => toggleActive(product)}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        {product.is_active ? '비활성화' : '활성화'}
                      </button>
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
