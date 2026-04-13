'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Product } from '@/lib/types'
import { formatKRW, calculateVAT, calculateTotalWithVAT } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'

async function fetchOrderNumber(): Promise<string> {
  const res = await fetch('/api/orders/generate-number')
  const data = await res.json()
  return data.order_number
}

interface OrderLine {
  product_id: string
  product_name: string
  option_code: string
  quantity: number
}

interface DistributorRetailerProductSetting {
  id: string
  distributor_id: string
  product_id: string
  moq: number
  order_unit: number
}

function NewOrderForm() {
  const { profile } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [products, setProducts] = useState<Product[]>([])
  const [settingsMap, setSettingsMap] = useState<Record<string, { moq: number; order_unit: number }>>({})
  const [lines, setLines] = useState<OrderLine[]>([])
  const [shippingAddress, setShippingAddress] = useState('')
  const [desiredDate, setDesiredDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Current selector state
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedOption, setSelectedOption] = useState('')
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (!profile) return

    const fetchData = async () => {
      // Fetch active products
      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (productData) setProducts(productData)

      // Fetch distributor settings for MOQ/order_unit overrides
      if (profile.distributor_id) {
        const { data: settingsData } = await supabase
          .from('distributor_retailer_product_settings')
          .select('*')
          .eq('distributor_id', profile.distributor_id)

        if (settingsData) {
          const map: Record<string, { moq: number; order_unit: number }> = {}
          ;(settingsData as DistributorRetailerProductSetting[]).forEach(s => {
            map[s.product_id] = { moq: s.moq, order_unit: s.order_unit }
          })
          setSettingsMap(map)
        }
      }

      // Pre-fill shipping address from profile
      if (profile.address) setShippingAddress(profile.address)
    }

    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  // Pre-select product from URL query param
  useEffect(() => {
    const productId = searchParams.get('product_id')
    if (productId) {
      setSelectedProduct(productId)
    }
  }, [searchParams])

  // Reset quantity to MOQ when product changes OR when products/settings finish loading
  useEffect(() => {
    if (!selectedProduct || products.length === 0) return
    const product = products.find(p => p.id === selectedProduct)
    if (!product) return
    const override = settingsMap[selectedProduct]
    const moq = override?.moq ?? product.moq ?? 1
    setQuantity(moq)
    setSelectedOption('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, products, settingsMap])

  const currentProductObj = products.find(p => p.id === selectedProduct)
  const currentOverride = selectedProduct ? settingsMap[selectedProduct] : undefined
  const moq = currentOverride?.moq ?? currentProductObj?.moq ?? 1
  const orderUnit = currentOverride?.order_unit ?? currentProductObj?.order_unit ?? 1

  const adjustQuantity = (value: number): number => {
    const snapped = Math.round(value / orderUnit) * orderUnit
    return Math.max(moq, snapped)
  }

  const addLine = () => {
    if (!selectedProduct) return
    const product = products.find(p => p.id === selectedProduct)
    if (!product) return

    const optionName = selectedOption
      ? product.options?.find((o: { code: string; name: string }) => o.code === selectedOption)?.name || selectedOption
      : ''

    setLines(prev => [
      ...prev,
      {
        product_id: selectedProduct,
        product_name: `${product.name}${optionName ? ` (${optionName})` : ''}`,
        option_code: selectedOption,
        quantity,
      },
    ])

    setSelectedProduct('')
    setSelectedOption('')
    setQuantity(1)
  }

  const removeLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index))
  }

  const handleSaveDraft = async () => {
    if (!profile || lines.length === 0) return
    setSaving(true)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: await fetchOrderNumber(),
        retailer_id: profile.id,
        distributor_id: profile.distributor_id,
        status: 'DRAFT',
        shipping_address: shippingAddress || null,
        desired_date: desiredDate || null,
        note: note || null,
        retailer_total: 0,
        hq_total: 0,
      })
      .select()
      .single()

    if (orderError || !order) {
      alert('임시 저장에 실패했습니다.')
      setSaving(false)
      return
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      lines.map(l => ({
        order_id: order.id,
        product_id: l.product_id,
        option_code: l.option_code || null,
        quantity: l.quantity,
        retailer_unit_price: null,
        retailer_amount: null,
      }))
    )

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id)
      alert('품목 저장에 실패했습니다. 다시 시도해주세요.')
      setSaving(false)
      return
    }

    router.push('/retailer/orders')
  }

  const handleSubmit = async () => {
    if (!profile || lines.length === 0) return
    setSaving(true)

    // 1. Create order as DRAFT
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: await fetchOrderNumber(),
        retailer_id: profile.id,
        distributor_id: profile.distributor_id,
        status: 'DRAFT',
        shipping_address: shippingAddress || null,
        desired_date: desiredDate || null,
        note: note || null,
        retailer_total: 0,
        hq_total: 0,
      })
      .select()
      .single()

    if (orderError || !order) {
      alert('주문 생성에 실패했습니다.')
      setSaving(false)
      return
    }

    // 2. Insert items (no price fields)
    const { error: itemsError } = await supabase.from('order_items').insert(
      lines.map(l => ({
        order_id: order.id,
        product_id: l.product_id,
        option_code: l.option_code || null,
        quantity: l.quantity,
        retailer_unit_price: null,
        retailer_amount: null,
      }))
    )

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id)
      alert('주문 품목 저장에 실패했습니다. 다시 시도해주세요.')
      setSaving(false)
      return
    }

    // 3. Update status to SUBMITTED
    const { error: submitError } = await supabase
      .from('orders')
      .update({ status: 'SUBMITTED', submitted_at: new Date().toISOString() })
      .eq('id', order.id)

    if (submitError) {
      alert('견적 요청 제출에 실패했습니다. 다시 시도해주세요.')
      setSaving(false)
      return
    }

    router.push('/retailer/orders')
  }

  // Guard: restricted status
  if (profile?.status === 'restricted') {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">견적 요청</h1>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-8 text-center">
          <p className="text-orange-800 font-medium">주문이 제한된 상태입니다.</p>
          <p className="text-sm text-orange-600 mt-2">총판 또는 본사에 문의하세요.</p>
        </div>
      </div>
    )
  }

  // Guard: no distributor assigned
  if (profile && !profile.distributor_id) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">견적 요청</h1>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <p className="text-yellow-800 font-medium">총판이 배정되지 않았습니다.</p>
          <p className="text-sm text-yellow-600 mt-2">본사에 문의하여 총판 배정을 요청하세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">견적 요청</h1>
        <p className="text-sm text-gray-500 mt-1">상품과 수량을 선택하고 총판에 견적을 요청하세요</p>
      </div>

      {/* 상품 선택 섹션 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">상품 선택</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상품</label>
            <select
              value={selectedProduct}
              onChange={(e) => { setSelectedProduct(e.target.value) }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">선택</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {currentProductObj && currentProductObj.options?.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">옵션</label>
              <select
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">선택</option>
                {currentProductObj.options.map((opt: { code: string; name: string }) => (
                  <option key={opt.code} value={opt.code}>{opt.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              수량
              {currentProductObj && (
                <span className="ml-1.5 text-xs text-gray-400 font-normal">
                  MOQ: {moq} / 단위: {orderUnit}
                </span>
              )}
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setQuantity(q => adjustQuantity(q - orderUnit))}
                disabled={!selectedProduct || quantity <= moq}
                className="w-8 h-9 flex items-center justify-center border border-gray-300 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                −
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => {
                  const raw = parseInt(e.target.value) || moq
                  setQuantity(adjustQuantity(raw))
                }}
                min={moq}
                step={orderUnit}
                className="w-14 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center"
              />
              <button
                type="button"
                onClick={() => setQuantity(q => q + orderUnit)}
                disabled={!selectedProduct}
                className="w-8 h-9 flex items-center justify-center border border-gray-300 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={addLine}
            disabled={!selectedProduct}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            추가
          </button>
        </div>
      </div>

      {/* 견적 품목 목록 */}
      {lines.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">견적 품목</h2>

          {/* Desktop table */}
          <table className="w-full mb-4 hidden sm:table">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left text-xs font-medium text-gray-500">상품명</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500">수량</th>
                <th className="pb-2 text-center text-xs font-medium text-gray-500 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-3 text-sm text-gray-900">{line.product_name}</td>
                  <td className="py-3 text-right text-sm text-gray-600">{line.quantity}</td>
                  <td className="py-3 text-center">
                    <button
                      onClick={() => removeLine(i)}
                      className="text-red-500 text-xs hover:underline"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3 mb-4">
            {lines.map((line, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-900">{line.product_name}</span>
                  <button
                    onClick={() => removeLine(i)}
                    className="text-red-500 text-xs hover:underline ml-2 shrink-0"
                  >
                    삭제
                  </button>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  수량: {line.quantity}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 배송 정보 */}
      {lines.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">배송 정보</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">배송지</label>
              <input
                type="text"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="배송지 주소"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">희망 납기일</label>
              <input
                type="date"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="요청사항을 입력하세요"
            />
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      {lines.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-center"
          >
            {saving ? '처리 중...' : '견적 요청하기'}
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="px-8 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-center"
          >
            임시 저장
          </button>
        </div>
      )}
    </div>
  )
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">로딩 중...</div>}>
      <NewOrderForm />
    </Suspense>
  )
}
