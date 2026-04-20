'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderItem, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { formatKRW, formatDateTime, formatDate, calculateVAT, calculateTotalWithVAT, cn, escapeHtml, numberToKorean } from '@/lib/utils'
import Link from 'next/link'
import { use } from 'react'

type ItemWithProduct = OrderItem & {
  product: {
    name: string
    product_code: string
    product_url: string | null
    consumer_price: number | null
  }
}

// Statuses where prices are confirmed and we show financial totals
const CONFIRMED_STATUSES = [
  'ORDER_PLACED',
  'APPROVED',
  'REJECTED',
  'HQ_RECEIVED',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
] as const

export default function RetailerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { profile } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<ItemWithProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [placingOrder, setPlacingOrder] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const fetchOrder = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    try {
      const [{ data: orderData }, { data: itemsData }] = await Promise.all([
        supabase.from('orders').select('*').eq('id', id).single(),
        supabase.from('order_items').select('*, product:products(name, product_code, product_url, consumer_price)').eq('order_id', id),
      ])
      if (orderData) setOrder(orderData)
      if (itemsData) setItems(itemsData as ItemWithProduct[])
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, id])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const handlePlaceOrder = async () => {
    if (!order) return
    setPlacingOrder(true)
    const { error } = await supabase
      .from('orders')
      .update({ status: 'ORDER_PLACED' })
      .eq('id', order.id)

    if (error) {
      alert('발주 처리에 실패했습니다. 다시 시도해 주세요.')
      setPlacingOrder(false)
      return
    }
    setOrder({ ...order, status: 'ORDER_PLACED' })
    setPlacingOrder(false)
  }

  const handleConfirmDelivery = async () => {
    if (!order) return
    const res = await fetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus: 'DELIVERED' }),
    })

    if (!res.ok) {
      alert('수령 확인에 실패했습니다. 다시 시도해 주세요.')
      return
    }
    setOrder({ ...order, status: 'DELIVERED', delivered_at: new Date().toISOString() })
  }

  const printStatement = () => {
    const w = window.open('', '_blank', 'width=800,height=600')
    if (!w || !order) return

    const subtotal = order.retailer_total
    const vatAmt = calculateVAT(subtotal)
    const totalAmt = calculateTotalWithVAT(subtotal)

    const rows = items.map(item => `
      <tr>
        <td style="border:1px solid #ccc;padding:6px;text-align:left">${escapeHtml(item.product?.name || '')}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${escapeHtml(item.option_code || '-')}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:right">${item.quantity}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:right">${formatKRW(item.retailer_unit_price ?? 0)}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:right">${formatKRW(item.retailer_amount ?? 0)}</td>
      </tr>
    `).join('')

    w.document.write(`
      <html><head><title>거래명세서 - ${escapeHtml(order.order_number)}</title>
      <style>body{font-family:'Malgun Gothic',sans-serif;margin:40px;font-size:13px}
      table{border-collapse:collapse;width:100%}
      h1{text-align:center;margin-bottom:24px;font-size:20px}
      .info{display:flex;justify-content:space-between;margin-bottom:24px}
      .info div{flex:1}
      .totals{margin-top:16px;text-align:right}
      @media print{body{margin:20mm}}</style></head>
      <body>
        <h1>거래명세서</h1>
        <div class="info">
          <div><strong>주문번호:</strong> ${escapeHtml(order.order_number)}<br>
          <strong>발주일:</strong> ${formatDate(order.created_at)}<br>
          <strong>배송지:</strong> ${escapeHtml(order.shipping_address || '-')}</div>
        </div>
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

  if (loading) return <div className="text-gray-400 text-sm">로딩 중...</div>
  if (!order) return <div className="text-gray-400 text-sm">주문을 찾을 수 없습니다.</div>

  const isPriceConfirmed = (CONFIRMED_STATUSES as readonly string[]).includes(order.status)
  const showQuotePrices = order.status === 'QUOTE_SENT' || isPriceConfirmed
  const vat = calculateVAT(order.retailer_total)
  const total = calculateTotalWithVAT(order.retailer_total)

  return (
    <div>
      <div className="mb-6">
        <Link href="/retailer/orders" className="text-sm text-blue-600 hover:underline">&larr; 목록으로</Link>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{order.order_number}</h1>
        <span className={cn(
          'inline-flex px-3 py-1 rounded-full text-sm font-medium',
          ORDER_STATUS_COLORS[order.status]
        )}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* 견적 도착 배너 */}
      {order.status === 'QUOTE_SENT' && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <span className="text-orange-500 text-xl mt-0.5">!</span>
          <div className="flex-1">
            <p className="text-orange-800 font-semibold text-sm">총판으로부터 견적이 도착했습니다!</p>
            {order.quote_expires_at && (
              <p className="text-orange-600 text-xs mt-1">
                견적 유효기간: {formatDate(order.quote_expires_at)}까지
              </p>
            )}
          </div>
          <button
            onClick={handlePlaceOrder}
            disabled={placingOrder}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {placingOrder ? '처리 중...' : '발주하기'}
          </button>
        </div>
      )}

      {/* 주문 정보 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">주문 정보</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">요청일</dt>
              <dd className="text-gray-900">{formatDateTime(order.created_at)}</dd>
            </div>
            {order.submitted_at && (
              <div className="flex justify-between">
                <dt className="text-gray-500">견적 요청일</dt>
                <dd className="text-gray-900">{formatDateTime(order.submitted_at)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">희망납기</dt>
              <dd className="text-gray-900">{order.desired_date ? formatDate(order.desired_date) : '-'}</dd>
            </div>
            {order.approved_at && (
              <div className="flex justify-between">
                <dt className="text-gray-500">승인일</dt>
                <dd className="text-gray-900">{formatDateTime(order.approved_at)}</dd>
              </div>
            )}
            {order.shipped_at && (
              <div className="flex justify-between">
                <dt className="text-gray-500">출고일</dt>
                <dd className="text-gray-900">{formatDateTime(order.shipped_at)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">배송 정보</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">배송지</dt>
              <dd className="text-gray-900 text-right max-w-[60%]">{order.shipping_address || '-'}</dd>
            </div>
            {order.note && (
              <div className="flex justify-between">
                <dt className="text-gray-500">비고</dt>
                <dd className="text-gray-900 text-right max-w-[60%]">{order.note}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* 주문 품목 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">주문 품목</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left text-xs font-medium text-gray-500">상품명</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500">수량</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500">단가</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500">금액</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-50">
                <td className="py-3 text-sm text-gray-900">
                  <div>
                    {item.product?.product_url ? (
                      <a
                        href={item.product.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {item.product.name}
                      </a>
                    ) : (
                      item.product?.name
                    )}
                  </div>
                  {item.option_code && (
                    <div className="text-xs text-gray-400 mt-0.5">{item.option_code}</div>
                  )}
                </td>
                <td className="py-3 text-right text-sm text-gray-600">{item.quantity}</td>
                <td className="py-3 text-right text-sm text-gray-600">
                  {showQuotePrices && item.retailer_unit_price != null
                    ? formatKRW(item.retailer_unit_price)
                    : <span className="text-gray-400">견적 대기</span>
                  }
                </td>
                <td className="py-3 text-right text-sm font-medium text-gray-900">
                  {showQuotePrices && item.retailer_amount != null
                    ? formatKRW(item.retailer_amount)
                    : <span className="text-gray-400">-</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 합계 — only shown when prices are confirmed */}
        {isPriceConfirmed && (
          <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">공급가액</span>
              <span>{formatKRW(order.retailer_total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">부가세 (10%)</span>
              <span>{formatKRW(vat)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>합계</span>
              <span className="text-blue-600">{formatKRW(total)}</span>
            </div>
          </div>
        )}

        {/* QUOTE_SENT: show subtotal from quoted prices, prompt to place order */}
        {order.status === 'QUOTE_SENT' && order.retailer_total > 0 && (
          <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">견적 공급가액</span>
              <span>{formatKRW(order.retailer_total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">부가세 (10%)</span>
              <span>{formatKRW(vat)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>견적 합계</span>
              <span className="text-orange-600">{formatKRW(total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 액션 버튼 영역 */}
      <div className="flex gap-3 flex-wrap">
        {/* 수령 확인 */}
        {order.status === 'SHIPPED' && (
          <button
            onClick={handleConfirmDelivery}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
          >
            수령 확인
          </button>
        )}

        {/* 거래명세서 인쇄 */}
        {['DELIVERED', 'COMPLETED'].includes(order.status) && items.length > 0 && (
          <button
            onClick={printStatement}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800"
          >
            거래명세서 인쇄
          </button>
        )}
      </div>
    </div>
  )
}
