'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Product } from '@/lib/types'
import { formatKRW, calculateVAT, calculateTotalWithVAT } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface OrderLine {
  product_id: string
  product_name: string
  option_code: string
  quantity: number
  unit_price: number
  amount: number
}

export default function DistributorNewOrderPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [products, setProducts] = useState<Product[]>([])
  const [lines, setLines] = useState<OrderLine[]>([])
  const [shippingAddress, setShippingAddress] = useState('')
  const [desiredDate, setDesiredDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedOption, setSelectedOption] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name')
      if (data) setProducts(data)
    }
    fetchProducts()
    if (profile?.address) setShippingAddress(profile.address)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  // 상품 변경 시 MOQ로 수량 초기화
  useEffect(() => {
    const product = products.find(p => p.id === selectedProduct)
    if (product) setQuantity(product.moq ?? 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct])

  // 상품/옵션 변경 시 공급단가 조회
  useEffect(() => {
    if (!selectedProduct || !profile) {
      setCurrentPrice(null)
      return
    }

    const fetchPrice = async () => {
      setPriceLoading(true)
      const today = new Date().toISOString().split('T')[0]

      let query = supabase
        .from('distributor_price_quotes')
        .select('unit_price')
        .eq('distributor_id', profile.id)
        .eq('product_id', selectedProduct)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order('effective_from', { ascending: false })
        .limit(1)

      if (selectedOption) {
        query = query.eq('option_code', selectedOption)
      } else {
        query = query.is('option_code', null)
      }

      const { data } = await query

      // 옵션 없는 가격으로 폴백
      if (!data || data.length === 0) {
        const { data: fallback } = await supabase
          .from('distributor_price_quotes')
          .select('unit_price')
          .eq('distributor_id', profile.id)
          .eq('product_id', selectedProduct)
          .is('option_code', null)
          .lte('effective_from', today)
          .or(`effective_to.is.null,effective_to.gte.${today}`)
          .order('effective_from', { ascending: false })
          .limit(1)
        setCurrentPrice(fallback?.[0]?.unit_price ?? null)
      } else {
        setCurrentPrice(data[0].unit_price)
      }
      setPriceLoading(false)
    }

    fetchPrice()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, selectedOption, profile])

  const currentProductObj = products.find(p => p.id === selectedProduct)
  const moq = currentProductObj?.moq ?? 1
  const orderUnit = currentProductObj?.order_unit ?? 1

  const adjustQuantity = (value: number): number => {
    const snapped = Math.round(value / orderUnit) * orderUnit
    return Math.max(moq, snapped)
  }

  const addLine = () => {
    if (!selectedProduct || !currentPrice) return
    if (quantity < moq) return

    const product = products.find(p => p.id === selectedProduct)
    if (!product) return

    const optionName = selectedOption
      ? product.options.find(o => o.code === selectedOption)?.name || selectedOption
      : ''

    setLines([
      ...lines,
      {
        product_id: selectedProduct,
        product_name: `${product.name}${optionName ? ` (${optionName})` : ''}`,
        option_code: selectedOption,
        quantity,
        unit_price: currentPrice,
        amount: currentPrice * quantity,
      },
    ])

    setSelectedProduct('')
    setSelectedOption('')
    setQuantity(1)
    setCurrentPrice(null)
  }

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index))
  }

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0)
  const vat = calculateVAT(subtotal)
  const total = calculateTotalWithVAT(subtotal)

  const handleSubmit = async () => {
    if (!profile || lines.length === 0) return
    setSaving(true)

    const res = await fetch('/api/orders/generate-number')
    const { order_number: orderNumber } = await res.json()

    // 1단계: DRAFT로 생성
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        retailer_id: profile.id,      // 총판 직발주: retailer_id = distributor_id
        distributor_id: profile.id,
        status: 'DRAFT',
        shipping_address: shippingAddress || null,
        desired_date: desiredDate || null,
        note: note || null,
        retailer_total: subtotal,
        hq_total: subtotal,           // 공급가 기준이므로 동일
      })
      .select()
      .single()

    if (orderError || !order) {
      alert('발주 생성에 실패했습니다.')
      setSaving(false)
      return
    }

    // 2단계: 품목 삽입
    const items = lines.map(line => ({
      order_id: order.id,
      product_id: line.product_id,
      option_code: line.option_code || null,
      quantity: line.quantity,
      retailer_unit_price: line.unit_price,
      retailer_amount: line.amount,
      hq_unit_price: line.unit_price,
      hq_amount: line.amount,
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(items)

    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id)
      alert('품목 저장에 실패했습니다. 다시 시도해주세요.')
      setSaving(false)
      return
    }

    // 3단계: SUBMITTED로 변경
    const { error: submitError } = await supabase
      .from('orders')
      .update({ status: 'SUBMITTED', submitted_at: new Date().toISOString() })
      .eq('id', order.id)

    if (submitError) {
      alert('발주 제출에 실패했습니다. 다시 시도해주세요.')
      setSaving(false)
      return
    }

    router.push('/distributor/orders')
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">본사 발주</h1>
        <p className="text-sm text-gray-500 mt-1">공급단가 기준으로 본사에 발주합니다</p>
      </div>

      {/* 상품 선택 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">상품 선택</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상품</label>
            <select
              value={selectedProduct}
              onChange={(e) => { setSelectedProduct(e.target.value); setSelectedOption('') }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">선택</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {currentProductObj && currentProductObj.options.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">옵션</label>
              <select
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">선택</option>
                {currentProductObj.options.map(opt => (
                  <option key={opt.code} value={opt.code}>{opt.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">공급단가</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700">
              {priceLoading ? '조회 중...' : currentPrice ? formatKRW(currentPrice) : '-'}
            </div>
          </div>

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
            disabled={!selectedProduct || !currentPrice}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            추가
          </button>
        </div>

        {!currentPrice && selectedProduct && !priceLoading && (
          <p className="text-sm text-red-500 mt-2">설정된 공급단가가 없습니다. 본사에 문의하세요.</p>
        )}
      </div>

      {/* 발주 품목 */}
      {lines.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">발주 품목</h2>

          <table className="w-full mb-4 hidden sm:table">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left text-xs font-medium text-gray-500">상품</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500">공급단가</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500">수량</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500">금액</th>
                <th className="pb-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-3 text-sm text-gray-900">{line.product_name}</td>
                  <td className="py-3 text-right text-sm text-gray-600">{formatKRW(line.unit_price)}</td>
                  <td className="py-3 text-right text-sm text-gray-600">{line.quantity}</td>
                  <td className="py-3 text-right text-sm font-medium text-gray-900">{formatKRW(line.amount)}</td>
                  <td className="py-3 text-center">
                    <button onClick={() => removeLine(i)} className="text-red-500 text-xs hover:underline">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 모바일 카드 */}
          <div className="sm:hidden space-y-3 mb-4">
            {lines.map((line, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{line.product_name}</span>
                  <button onClick={() => removeLine(i)} className="text-red-500 text-xs hover:underline ml-2">삭제</button>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{formatKRW(line.unit_price)} × {line.quantity}</span>
                  <span className="font-medium text-gray-900">{formatKRW(line.amount)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 합계 */}
          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">공급가액 (VAT 별도)</span>
              <span className="text-gray-900">{formatKRW(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">부가세 (10%)</span>
              <span className="text-gray-900">{formatKRW(vat)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span className="text-gray-900">합계</span>
              <span className="text-blue-600">{formatKRW(total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 배송 정보 */}
      {lines.length > 0 && !showPreview && (
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

      {/* 발주 버튼 */}
      {lines.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {!showPreview ? (
            <button
              onClick={() => setShowPreview(true)}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-center"
            >
              발주 미리보기
            </button>
          ) : (
            <>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-center"
              >
                {saving ? '발주 중...' : '발주 확정'}
              </button>
              <button
                onClick={() => setShowPreview(false)}
                className="px-8 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 text-center"
              >
                수정
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
