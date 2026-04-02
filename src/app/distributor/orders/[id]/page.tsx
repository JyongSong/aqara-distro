'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderItem, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { formatKRW, formatDateTime, formatDate, calculateVAT, calculateTotalWithVAT, cn, escapeHtml } from '@/lib/utils'
import Link from 'next/link'
import { use } from 'react'

export default function DistributorOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { profile } = useAuth()
  const [order, setOrder] = useState<(Order & { retailer: { company_name: string } }) | null>(null)
  const [items, setItems] = useState<(OrderItem & { product: { name: string; product_code: string; product_url: string | null; consumer_price: number | null } })[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
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

  const handleApprove = async () => {
    if (!order || !profile) return
    setProcessing(true)

    // 본사 공급단가 조회 및 주문 상세에 반영
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

      updates.push({
        id: item.id,
        hq_unit_price: hqPrice,
        hq_amount: hqAmount,
      })
    }

    // 주문 상세에 본사 단가 반영
    for (const update of updates) {
      await supabase
        .from('order_items')
        .update({ hq_unit_price: update.hq_unit_price, hq_amount: update.hq_amount })
        .eq('id', update.id)
    }

    // 주문 상태 업데이트
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'APPROVED',
        hq_total: hqTotal,
        approved_at: new Date().toISOString(),
        approved_by: profile.id,
      })
      .eq('id', order.id)

    if (orderError) {
      alert('승인 처리에 실패했습니다. 다시 시도해 주세요.')
      setProcessing(false)
      return
    }

    // 상태 갱신
    setOrder({
      ...order,
      status: 'APPROVED',
      hq_total: hqTotal,
      approved_at: new Date().toISOString(),
    })
    setItems(items.map(item => {
      const update = updates.find(u => u.id === item.id)
      return update ? { ...item, hq_unit_price: update.hq_unit_price, hq_amount: update.hq_amount } : item
    }))
    setProcessing(false)
  }

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

  const printStatement = (type: 'retailer' | 'hq') => {
    const w = window.open('', '_blank', 'width=800,height=600')
    if (!w || !order) return

    const isRetailer = type === 'retailer'
    const title = isRetailer ? '거래명세서 (소매용)' : '거래명세서 (본사 정산용)'
    const subtotal = isRetailer ? order.retailer_total : (order.hq_total || 0)
    const vatAmt = calculateVAT(subtotal)
    const totalAmt = calculateTotalWithVAT(subtotal)

    const rows = items.map(item => {
      const price = isRetailer ? item.retailer_unit_price : (item.hq_unit_price || 0)
      const amount = isRetailer ? item.retailer_amount : (item.hq_amount || 0)
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
        </div>
        <script>window.onload=function(){window.print()}</script>
      </body></html>
    `)
    w.document.close()
  }

  if (loading) return <div className="text-gray-400 text-sm">로딩 중...</div>
  if (!order) return <div className="text-gray-400 text-sm">주문을 찾을 수 없습니다.</div>

  const retailerVat = calculateVAT(order.retailer_total)
  const retailerTotal = calculateTotalWithVAT(order.retailer_total)
  const hqVat = order.hq_total ? calculateVAT(order.hq_total) : 0
  const hqTotal = order.hq_total ? calculateTotalWithVAT(order.hq_total) : 0

  return (
    <div>
      <div className="mb-6">
        <Link href="/distributor/orders" className="text-sm text-blue-600 hover:underline">&larr; 목록으로</Link>
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

      {/* 주문 정보 */}
      <div className="grid grid-cols-2 gap-6 mb-8">
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

        {/* 가격 비교 카드 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">가격 비교</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">소매 발주 금액 (VAT 포함)</p>
              <p className="text-xl font-bold text-gray-900">{formatKRW(retailerTotal)}</p>
            </div>
            {order.hq_total > 0 && (
              <>
                <div>
                  <p className="text-xs text-gray-400 mb-1">본사 공급 금액 (VAT 포함)</p>
                  <p className="text-xl font-bold text-blue-600">{formatKRW(hqTotal)}</p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-400 mb-1">예상 마진</p>
                  <p className="text-lg font-bold text-green-600">{formatKRW(retailerTotal - hqTotal)}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 주문 품목 (이중 가격 표시) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">주문 품목</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left text-xs font-medium text-gray-500">상품</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500">옵션</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500">수량</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500">소매단가</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500">소매금액</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500">본사단가</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500">본사금액</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-50">
                <td className="py-3 text-sm text-gray-900">
                  {item.product?.product_url ? (
                    <a href={item.product.product_url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:underline">{item.product.name}</a>
                  ) : item.product?.name}
                </td>
                <td className="py-3 text-sm text-gray-500">{item.option_code || '-'}</td>
                <td className="py-3 text-right text-sm text-gray-600">{item.quantity}</td>
                <td className="py-3 text-right text-sm text-gray-600">{formatKRW(item.retailer_unit_price)}</td>
                <td className="py-3 text-right text-sm font-medium text-gray-900">{formatKRW(item.retailer_amount)}</td>
                <td className="py-3 text-right text-sm text-blue-600">
                  {item.hq_unit_price ? formatKRW(item.hq_unit_price) : '-'}
                </td>
                <td className="py-3 text-right text-sm font-medium text-blue-600">
                  {item.hq_amount ? formatKRW(item.hq_amount) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 합계 */}
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
              <span>{formatKRW(retailerTotal)}</span>
            </div>
          </div>
          {order.hq_total > 0 && (
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
                <span className="text-blue-600">{formatKRW(hqTotal)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 거래명세서 인쇄 */}
      {['DELIVERED', 'COMPLETED'].includes(order.status) && items.length > 0 && (
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => printStatement('retailer')}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700"
          >
            소매 거래명세서
          </button>
          {order.hq_total > 0 && (
            <button
              onClick={() => printStatement('hq')}
              className="px-6 py-3 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800"
            >
              본사 정산 명세서
            </button>
          )}
        </div>
      )}

      {/* 승인/반려 버튼 */}
      {order.status === 'SUBMITTED' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">발주 처리</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">반려 사유 (반려 시)</label>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="반려 사유를 입력하세요"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleApprove}
              disabled={processing}
              className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {processing ? '처리 중...' : '승인'}
            </button>
            <button
              onClick={handleReject}
              disabled={processing}
              className="px-8 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
            >
              반려
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
