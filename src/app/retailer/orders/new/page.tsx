'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Product } from '@/lib/types'
import { formatKRW, generateOrderNumber, calculateVAT, calculateTotalWithVAT } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface OrderLine {
  product_id: string
  product_name: string
  option_code: string
  quantity: number
  unit_price: number
  amount: number
}

export default function NewOrderPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [lines, setLines] = useState<OrderLine[]>([])
  const [shippingAddress, setShippingAddress] = useState('')
  const [desiredDate, setDesiredDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // 현재 선택 중인 품목
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
        .order('name')
      if (data) setProducts(data)
    }
    fetchProducts()

    if (profile?.address) setShippingAddress(profile.address)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  // 상품/옵션 변경 시 단가 조회
  useEffect(() => {
    if (!selectedProduct || !profile) {
      setCurrentPrice(null)
      return
    }

    const fetchPrice = async () => {
      setPriceLoading(true)
      const today = new Date().toISOString().split('T')[0]

      let query = supabase
        .from('retailer_price_quotes')
        .select('unit_price')
        .eq('retailer_id', profile.id)
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

      // 옵션 없는 가격도 시도
      if (!data || data.length === 0) {
        const { data: fallback } = await supabase
          .from('retailer_price_quotes')
          .select('unit_price')
          .eq('retailer_id', profile.id)
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

  const addLine = () => {
    if (!selectedProduct || !currentPrice || quantity < 1) return

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

    const orderNumber = generateOrderNumber()

    // 주문 생성
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        retailer_id: profile.id,
        distributor_id: profile.distributor_id,
        status: 'SUBMITTED',
        shipping_address: shippingAddress || null,
        desired_date: desiredDate || null,
        note: note || null,
        retailer_total: subtotal,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (orderError || !order) {
      alert('주문 생성에 실패했습니다.')
      setSaving(false)
      return
    }

    // 주문 상세 생성
    const items = lines.map(line => ({
      order_id: order.id,
      product_id: line.product_id,
      option_code: line.option_code || null,
      quantity: line.quantity,
      retailer_unit_price: line.unit_price,
      retailer_amount: line.amount,
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(items)

    if (itemsError) {
      alert('주문 상세 생성에 실패했습니다.')
      setSaving(false)
      return
    }

    router.push(`/retailer/orders/${order.id}`)
  }

  // 제재 상태 확인
  if (profile?.status === 'restricted') {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">새 발주 작성</h1>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-8 text-center">
          <p className="text-orange-800 font-medium">주문이 제한된 상태입니다.</p>
          <p className="text-sm text-orange-600 mt-2">총판 또는 본사에 문의하세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">새 발주 작성</h1>
        <p className="text-sm text-gray-500 mt-1">상품을 선택하고 수량을 입력하세요</p>
      </div>

      {/* 상품 추가 섹션 */}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">단가</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700">
              {priceLoading ? '조회 중...' : currentPrice ? formatKRW(currentPrice) : '-'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
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
          <p className="text-sm text-red-500 mt-2">설정된 단가가 없습니다. 총판에 문의하세요.</p>
        )}
      </div>

      {/* 발주 품목 목록 */}
      {lines.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">발주 품목</h2>

          {/* Desktop table */}
          <table className="w-full mb-4 hidden sm:table">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left text-xs font-medium text-gray-500">상품</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500">단가</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500">수량</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500">금액</th>
                <th className="pb-2 text-center text-xs font-medium text-gray-500 w-16"></th>
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

          {/* Mobile cards */}
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
              <span className="text-gray-500">공급가액</span>
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
