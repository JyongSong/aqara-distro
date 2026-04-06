'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderItem, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { formatKRW, formatDateTime, formatDate, calculateVAT, calculateTotalWithVAT, cn, escapeHtml, numberToKorean } from '@/lib/utils'
import Link from 'next/link'
import { use } from 'react'

type OrderWithRetailer = Order & { retailer: { company_name: string } }
type OrderItemWithProduct = OrderItem & {
  product: { name: string; product_code: string; product_url: string | null; consumer_price: number | null }
}

export default function DistributorOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { profile } = useAuth()
  const [order, setOrder] = useState<OrderWithRetailer | null>(null)
  const [items, setItems] = useState<OrderItemWithProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({})
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return

    const fetchOrder = async () => {
      setLoading(true)
      const { data: orderData } = await supabase
        .from('orders')
        .select('*, retailer:users_profile!retailer_id(company_name)')
        .eq('id', id)
        .single()

      if (orderData) setOrder(orderData)

      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*, product:products(name, product_code, product_url, consumer_price)')
        .eq('order_id', id)

      if (itemsData) setItems(itemsData)
      setLoading(false)
    }

    fetchOrder()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, id])

  // ── SUBMITTED: send quote ──────────────────────────────────────────────────

  const handleSendQuote = async () => {
    if (!order || !profile) return

    const allFilled = items.every(item => {
      const val = parseInt(priceInputs[item.id] || '0')
      return val > 0
    })
    if (!allFilled) {
      alert('모든 상품의 단가를 입력해 주세요.')
      return
    }

    setProcessing(true)

    const updates = items.map(item => ({
      id: item.id,
      retailer_unit_price: parseInt(priceInputs[item.id] || '0'),
      retailer_amount: parseInt(priceInputs[item.id] || '0') * item.quantity,
    }))
    const retailerTotal = updates.reduce((sum, u) => sum + u.retailer_amount, 0)

    for (const u of updates) {
      await supabase.from('order_items').update({
        retailer_unit_price: u.retailer_unit_price,
        retailer_amount: u.retailer_amount,
      }).eq('id', u.id)
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 14)

    const { error } = await supabase.from('orders').update({
      status: 'QUOTE_SENT',
      retailer_total: retailerTotal,
      quote_expires_at: expiresAt.toISOString(),
    }).eq('id', order.id)

    if (error) {
      alert('견적 발송에 실패했습니다. 다시 시도해 주세요.')
      setProcessing(false)
      return
    }

    setOrder({
      ...order,
      status: 'QUOTE_SENT',
      retailer_total: retailerTotal,
      quote_expires_at: expiresAt.toISOString(),
    })
    setItems(items.map(item => {
      const u = updates.find(x => x.id === item.id)
      return u ? { ...item, retailer_unit_price: u.retailer_unit_price, retailer_amount: u.retailer_amount } : item
    }))
    setProcessing(false)
  }

  // ── ORDER_PLACED: approve ──────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!order || !profile) return
    setProcessing(true)

    const today = new Date().toISOString().split('T')[0]
    let hqTotal = 0
    const updates: { id: string; hq_unit_price: number; hq_amount: number }[] = []

    for (const item of items) {
      const { data: prices } = await supabase
        .from('distributor_price_quotes')
        .select('unit_price')
        .eq('distributor_id', profile.id)
        .eq('product_id', item.product_id)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order('effective_from', { ascending: false })
        .limit(1)

      const hqPrice = prices?.[0]?.unit_price || 0
      const hqAmount = hqPrice * item.quantity
      hqTotal += hqAmount

      updates.push({ id: item.id, hq_unit_price: hqPrice, hq_amount: hqAmount })
    }

    for (const update of updates) {
      await supabase
        .from('order_items')
        .update({ hq_unit_price: update.hq_unit_price, hq_amount: update.hq_amount })
        .eq('id', update.id)
    }

    const { error } = await supabase
      .from('orders')
      .update({
        status: 'APPROVED',
        hq_total: hqTotal,
        approved_at: new Date().toISOString(),
        approved_by: profile.id,
      })
      .eq('id', order.id)

    if (error) {
      alert('승인 처리에 실패했습니다. 다시 시도해 주세요.')
      setProcessing(false)
      return
    }

    setOrder({ ...order, status: 'APPROVED', hq_total: hqTotal, approved_at: new Date().toISOString() })
    setItems(items.map(item => {
      const u = updates.find(x => x.id === item.id)
      return u ? { ...item, hq_unit_price: u.hq_unit_price, hq_amount: u.hq_amount } : item
    }))
    setProcessing(false)
  }

  // ── ORDER_PLACED: reject ───────────────────────────────────────────────────

  const handleReject = async () => {
    if (!order) return
    setProcessing(true)

    const { error } = await supabase
      .from('orders')
      .update({
        status: 'REJECTED',
        note: rejectReason ? `[반려사유] ${rejectReason}` : order.note,
      })
      .eq('id', order.id)

    if (error) {
      alert('반려 처리에 실패했습니다. 다시 시도해 주세요.')
      setProcessing(false)
      return
    }

    setOrder({ ...order, status: 'REJECTED' })
    setProcessing(false)
  }

  // ── Print ──────────────────────────────────────────────────────────────────

  const printStatement = (type: 'retailer' | 'hq') => {
    const w = window.open('', '_blank', 'width=800,height=600')
    if (!w || !order) return

    const isRetailer = type === 'retailer'
    const title = isRetailer ? '거래명세서 (소매용)' : '거래명세서 (본사 정산용)'
    const subtotal = isRetailer ? order.retailer_total : (order.hq_total || 0)
    const vatAmt = calculateVAT(subtotal)
    const totalAmt = calculateTotalWithVAT(subtotal)

    const rows = items.map(item => {
      const price = isRetailer ? (item.retailer_unit_price || 0) : (item.hq_unit_price || 0)
      const amount = isRetailer ? (item.retailer_amount || 0) : (item.hq_amount || 0)
      return `
        <tr>
          <td style="border:1px solid #ccc;padding:6px">${escapeHtml(item.product?.name || '')}</td>
          <td style="border:1px solid #ccc;padding:6px;text-align:center">${escapeHtml(item.option_code || '-')}</td>
          <td style="border:1px solid #ccc;padding:6px;text-align:right">${item.quantity}</td>
          <td style="border:1px solid #ccc;padding:6px;text-align:right">${formatKRW(price)}</td>
          <td style="border:1px solid #ccc;padding:6px;text-align:right">${formatKRW(amount)}</td>
        </tr>
      `
    }).join('')

    w.document.write(`
      <html><head><title>${escapeHtml(title)} - ${escapeHtml(order.order_number)}</title>
      <style>body{font-family:'Malgun Gothic',sans-serif;margin:40px;font-size:13px}
      table{border-collapse:collapse;width:100%}
      h1{text-align:center;margin-bottom:24px;font-size:20px}
      .totals{margin-top:16px;text-align:right}
      @media print{body{margin:20mm}}</style></head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p><strong>주문번호:</strong> ${escapeHtml(order.order_number)} &nbsp; <strong>소매점:</strong> ${escapeHtml(order.retailer?.company_name || '')}</p>
        <p style="margin-bottom:16px"><strong>발주일:</strong> ${formatDateTime(order.created_at)}</p>
        <table>
          <thead><tr>
            <th style="border:1px solid #ccc;padding:6px;background:#f5f5f5">상품</th>
            <th style="border:1px solid #ccc;padding:6px;background:#f5f5f5">옵션</th>
            <th style="border:1px solid #ccc;padding:6px;background:#f5f5f5">수량</th>
            <th style="border:1px solid #ccc;padding:6px;background:#f5f5f5">단가</th>
            <th style="border:1px solid #ccc;padding:6px;background:#f5f5f5">금액</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          <p>공급가액: ${formatKRW(subtotal)}</p>
          <p>부가세 (10%): ${formatKRW(vatAmt)}</p>
          <p><strong>합계: ${formatKRW(totalAmt)}</strong></p>
          <p style="font-size:12px;color:#666;margin-top:4px">금 ${numberToKorean(totalAmt)}원정</p>
        </div>
        <script>window.onload=function(){window.print()}</script>
      </body></html>
    `)
    w.document.close()
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  if (loading) return <div className="text-gray-400 text-sm">로딩 중...</div>
  if (!order) return <div className="text-gray-400 text-sm">주문을 찾을 수 없습니다.</div>

  const retailerVat = calculateVAT(order.retailer_total)
  const retailerTotalWithVat = calculateTotalWithVAT(order.retailer_total)
  const hqVat = order.hq_total ? calculateVAT(order.hq_total) : 0
  const hqTotalWithVat = order.hq_total ? calculateTotalWithVAT(order.hq_total) : 0

  // Live totals for SUBMITTED price input
  const liveSubtotal = items.reduce((sum, item) => {
    const price = parseInt(priceInputs[item.id] || '0')
    return sum + price * item.quantity
  }, 0)

  const isReadOnly = !['SUBMITTED', 'ORDER_PLACED'].includes(order.status)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Back link */}
      <div className="mb-6">
        <Link href="/distributor/orders" className="text-sm text-blue-600 hover:underline">
          &larr; 목록으로
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{order.order_number}</h1>
        <span className={cn(
          'inline-flex px-3 py-1 rounded-full text-sm font-medium',
          ORDER_STATUS_COLORS[order.status]
        )}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* ── SUBMITTED: quote entry UI ── */}
      {order.status === 'SUBMITTED' && (
        <>
          {/* Order info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 mb-3">견적 요청 정보</h2>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">소매점</dt>
                <dd className="text-gray-900 font-medium">{order.retailer?.company_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">요청일</dt>
                <dd className="text-gray-900">{formatDateTime(order.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">희망납기</dt>
                <dd className="text-gray-900">{order.desired_date ? formatDate(order.desired_date) : '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">배송지</dt>
                <dd className="text-gray-900">{order.shipping_address || '-'}</dd>
              </div>
              {order.note && (
                <div className="flex justify-between col-span-2">
                  <dt className="text-gray-500">비고</dt>
                  <dd className="text-gray-900">{order.note}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Price input table */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">단가 입력</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">상품명</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">옵션</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">수량</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">단가 입력</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">금액</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const unitPrice = parseInt(priceInputs[item.id] || '0')
                  const lineAmount = unitPrice * item.quantity
                  return (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="py-3 text-sm text-gray-900">
                        {item.product?.product_url ? (
                          <a href={item.product.product_url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:underline">{item.product.name}</a>
                        ) : item.product?.name}
                      </td>
                      <td className="py-3 text-sm text-gray-500">{item.option_code || '-'}</td>
                      <td className="py-3 text-right text-sm text-gray-600">{item.quantity}</td>
                      <td className="py-3 text-right">
                        <div className="relative inline-flex items-center">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={priceInputs[item.id] ? Number(priceInputs[item.id]).toLocaleString('ko-KR') : ''}
                            onChange={e => {
                              const raw = e.target.value.replace(/[^0-9]/g, '')
                              setPriceInputs(prev => ({ ...prev, [item.id]: raw }))
                            }}
                            className="w-44 pl-3 pr-9 py-2 border-2 border-gray-300 rounded-lg text-sm text-right font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 bg-white"
                            placeholder="0"
                          />
                          <span className="absolute right-3 text-xs text-gray-400 pointer-events-none select-none">원</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-sm font-medium text-gray-900">
                        {lineAmount > 0 ? formatKRW(lineAmount) : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Live total */}
            <div className="border-t border-gray-200 pt-4 mt-4 flex justify-end">
              <div className="space-y-1 text-sm min-w-48">
                <div className="flex justify-between text-gray-500">
                  <span>공급가액</span>
                  <span>{formatKRW(liveSubtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>부가세 (10%)</span>
                  <span>{formatKRW(calculateVAT(liveSubtotal))}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-1 mt-1">
                  <span>합계</span>
                  <span>{formatKRW(calculateTotalWithVAT(liveSubtotal))}</span>
                </div>
                {liveSubtotal > 0 && (
                  <div className="text-right text-xs text-gray-400 mt-1">
                    금 {numberToKorean(calculateTotalWithVAT(liveSubtotal))}원정
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Send quote button */}
          <div className="flex justify-end">
            <button
              onClick={handleSendQuote}
              disabled={processing || liveSubtotal === 0}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? '처리 중...' : '견적 발송하기'}
            </button>
          </div>
        </>
      )}

      {/* ── QUOTE_SENT: read-only quote view ── */}
      {order.status === 'QUOTE_SENT' && (
        <>
          {/* Info + validity */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-500 mb-3">견적 정보</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">소매점</dt>
                  <dd className="text-gray-900 font-medium">{order.retailer?.company_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">요청일</dt>
                  <dd className="text-gray-900">{formatDateTime(order.created_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">배송지</dt>
                  <dd className="text-gray-900">{order.shipping_address || '-'}</dd>
                </div>
                {order.note && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">비고</dt>
                    <dd className="text-gray-900">{order.note}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="bg-white rounded-xl border border-orange-200 bg-orange-50 p-6">
              <h2 className="text-sm font-semibold text-orange-600 mb-3">견적 유효 기간</h2>
              <p className="text-2xl font-bold text-orange-700">
                {order.quote_expires_at ? formatDate(order.quote_expires_at) : '-'}
              </p>
              <p className="text-xs text-orange-500 mt-1">소매점의 발주 확정을 기다리는 중입니다.</p>
              <div className="mt-4 pt-4 border-t border-orange-200">
                <p className="text-xs text-gray-500 mb-1">견적 금액 (VAT 포함)</p>
                <p className="text-xl font-bold text-gray-900">{formatKRW(retailerTotalWithVat)}</p>
              </div>
            </div>
          </div>

          {/* Quote items read-only */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">견적 품목</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">상품명</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">옵션</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">수량</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">단가</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">금액</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="py-3 text-sm text-gray-900">
                      {item.product?.product_url ? (
                        <a href={item.product.product_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline">{item.product.name}</a>
                      ) : item.product?.name}
                    </td>
                    <td className="py-3 text-sm text-gray-500">{item.option_code || '-'}</td>
                    <td className="py-3 text-right text-sm text-gray-600">{item.quantity}</td>
                    <td className="py-3 text-right text-sm text-gray-600">
                      {item.retailer_unit_price != null ? formatKRW(item.retailer_unit_price) : '-'}
                    </td>
                    <td className="py-3 text-right text-sm font-medium text-gray-900">
                      {item.retailer_amount != null ? formatKRW(item.retailer_amount) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-200 pt-4 mt-4 flex justify-end">
              <div className="space-y-1 text-sm min-w-48">
                <div className="flex justify-between text-gray-500">
                  <span>공급가액</span>
                  <span>{formatKRW(order.retailer_total)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>부가세 (10%)</span>
                  <span>{formatKRW(retailerVat)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-1 mt-1">
                  <span>합계</span>
                  <span>{formatKRW(retailerTotalWithVat)}</span>
                </div>
                <div className="text-right text-xs text-gray-400 mt-1">
                  금 {numberToKorean(retailerTotalWithVat)}원정
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── ORDER_PLACED: approve / reject ── */}
      {order.status === 'ORDER_PLACED' && (
        <>
          {/* Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 mb-3">발주 정보</h2>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">소매점</dt>
                <dd className="text-gray-900 font-medium">{order.retailer?.company_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">요청일</dt>
                <dd className="text-gray-900">{formatDateTime(order.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">희망납기</dt>
                <dd className="text-gray-900">{order.desired_date ? formatDate(order.desired_date) : '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">배송지</dt>
                <dd className="text-gray-900">{order.shipping_address || '-'}</dd>
              </div>
              {order.note && (
                <div className="flex justify-between col-span-2">
                  <dt className="text-gray-500">비고</dt>
                  <dd className="text-gray-900">{order.note}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Items with confirmed prices */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">발주 품목</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">상품명</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">옵션</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">수량</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">단가</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">금액</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="py-3 text-sm text-gray-900">
                      {item.product?.product_url ? (
                        <a href={item.product.product_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline">{item.product.name}</a>
                      ) : item.product?.name}
                    </td>
                    <td className="py-3 text-sm text-gray-500">{item.option_code || '-'}</td>
                    <td className="py-3 text-right text-sm text-gray-600">{item.quantity}</td>
                    <td className="py-3 text-right text-sm text-gray-600">
                      {item.retailer_unit_price != null ? formatKRW(item.retailer_unit_price) : '-'}
                    </td>
                    <td className="py-3 text-right text-sm font-medium text-gray-900">
                      {item.retailer_amount != null ? formatKRW(item.retailer_amount) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-200 pt-4 mt-4 flex justify-end">
              <div className="space-y-1 text-sm min-w-48">
                <div className="flex justify-between text-gray-500">
                  <span>공급가액</span>
                  <span>{formatKRW(order.retailer_total)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>부가세 (10%)</span>
                  <span>{formatKRW(retailerVat)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-1 mt-1">
                  <span>합계</span>
                  <span>{formatKRW(retailerTotalWithVat)}</span>
                </div>
                <div className="text-right text-xs text-gray-400 mt-1">
                  금 {numberToKorean(retailerTotalWithVat)}원정
                </div>
              </div>
            </div>
          </div>

          {/* Approve / reject actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">발주 처리</h2>

            {showRejectInput && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">반려 사유</label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="반려 사유를 입력하세요"
                  autoFocus
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleApprove}
                disabled={processing}
                className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {processing && !showRejectInput ? '처리 중...' : '승인'}
              </button>

              {!showRejectInput ? (
                <button
                  onClick={() => setShowRejectInput(true)}
                  disabled={processing}
                  className="px-8 py-3 bg-red-50 text-red-600 border border-red-300 rounded-lg font-medium hover:bg-red-100 disabled:opacity-50"
                >
                  반려
                </button>
              ) : (
                <>
                  <button
                    onClick={handleReject}
                    disabled={processing}
                    className="px-8 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {processing ? '처리 중...' : '반려 확인'}
                  </button>
                  <button
                    onClick={() => { setShowRejectInput(false); setRejectReason('') }}
                    disabled={processing}
                    className="px-4 py-3 text-gray-500 hover:text-gray-700 text-sm disabled:opacity-50"
                  >
                    취소
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── APPROVED and beyond: read-only with print ── */}
      {isReadOnly && (
        <>
          {/* Order info */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-500 mb-3">주문 정보</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">소매점</dt>
                  <dd className="text-gray-900 font-medium">{order.retailer?.company_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">발주일</dt>
                  <dd className="text-gray-900">{formatDateTime(order.created_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">희망납기</dt>
                  <dd className="text-gray-900">{order.desired_date ? formatDate(order.desired_date) : '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">배송지</dt>
                  <dd className="text-gray-900">{order.shipping_address || '-'}</dd>
                </div>
                {order.note && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">비고</dt>
                    <dd className="text-gray-900">{order.note}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Price summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-500 mb-3">가격 요약</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">소매 발주 금액 (VAT 포함)</p>
                  <p className="text-xl font-bold text-gray-900">{formatKRW(retailerTotalWithVat)}</p>
                </div>
                {order.hq_total != null && order.hq_total > 0 && (
                  <>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">본사 공급 금액 (VAT 포함)</p>
                      <p className="text-xl font-bold text-blue-600">{formatKRW(hqTotalWithVat)}</p>
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-xs text-gray-400 mb-1">예상 마진</p>
                      <p className="text-lg font-bold text-green-600">{formatKRW(retailerTotalWithVat - hqTotalWithVat)}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">주문 품목</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">상품</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">옵션</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">수량</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">소매단가</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">소매금액</th>
                  {order.hq_total != null && order.hq_total > 0 && (
                    <>
                      <th className="pb-2 text-right text-xs font-medium text-gray-500">본사단가</th>
                      <th className="pb-2 text-right text-xs font-medium text-gray-500">본사금액</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="py-3 text-sm text-gray-900">
                      {item.product?.product_url ? (
                        <a href={item.product.product_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline">{item.product.name}</a>
                      ) : item.product?.name}
                    </td>
                    <td className="py-3 text-sm text-gray-500">{item.option_code || '-'}</td>
                    <td className="py-3 text-right text-sm text-gray-600">{item.quantity}</td>
                    <td className="py-3 text-right text-sm text-gray-600">
                      {item.retailer_unit_price != null ? formatKRW(item.retailer_unit_price) : '-'}
                    </td>
                    <td className="py-3 text-right text-sm font-medium text-gray-900">
                      {item.retailer_amount != null ? formatKRW(item.retailer_amount) : '-'}
                    </td>
                    {order.hq_total != null && order.hq_total > 0 && (
                      <>
                        <td className="py-3 text-right text-sm text-blue-600">
                          {item.hq_unit_price ? formatKRW(item.hq_unit_price) : '-'}
                        </td>
                        <td className="py-3 text-right text-sm font-medium text-blue-600">
                          {item.hq_amount ? formatKRW(item.hq_amount) : '-'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-gray-200 pt-4 mt-4 grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-400">소매 기준</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">공급가액</span>
                  <span>{formatKRW(order.retailer_total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">부가세</span>
                  <span>{formatKRW(retailerVat)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>합계</span>
                  <span>{formatKRW(retailerTotalWithVat)}</span>
                </div>
                <div className="text-right text-xs text-gray-400 mt-0.5">
                  금 {numberToKorean(retailerTotalWithVat)}원정
                </div>
              </div>
              {order.hq_total != null && order.hq_total > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-blue-400">본사 기준</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">공급가액</span>
                    <span className="text-blue-600">{formatKRW(order.hq_total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">부가세</span>
                    <span className="text-blue-600">{formatKRW(hqVat)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>합계</span>
                    <span className="text-blue-600">{formatKRW(hqTotalWithVat)}</span>
                  </div>
                  <div className="text-right text-xs text-blue-300 mt-0.5">
                    금 {numberToKorean(hqTotalWithVat)}원정
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Print buttons */}
          {items.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => printStatement('retailer')}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700"
              >
                소매 거래명세서 인쇄
              </button>
              {order.hq_total != null && order.hq_total > 0 && (
                <button
                  onClick={() => printStatement('hq')}
                  className="px-6 py-3 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800"
                >
                  본사 정산 명세서 인쇄
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
