'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderItem, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { formatKRW, formatDateTime, formatDate, calculateVAT, calculateTotalWithVAT, cn, escapeHtml, numberToKorean } from '@/lib/utils'
import Link from 'next/link'
import { use } from 'react'

export default function HQOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<(Order & {
    retailer: { company_name: string }
    distributor: { company_name: string }
  }) | null>(null)
  const [items, setItems] = useState<(OrderItem & { product: { name: string; product_code: string; product_url: string | null; consumer_price: number | null } })[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true)
      const { data: orderData } = await supabase
        .from('orders')
        .select('*, retailer:users_profile!retailer_id(company_name), distributor:users_profile!distributor_id(company_name)')
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
  }, [id])

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return
    setProcessing(true)

    const updateData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'SHIPPED') updateData.shipped_at = new Date().toISOString()

    const { error } = await supabase.from('orders').update(updateData).eq('id', order.id)
    if (error) {
      alert('상태 변경에 실패했습니다. 다시 시도해 주세요.')
      setProcessing(false)
      return
    }
    setOrder({ ...order, status: newStatus as Order['status'] })
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
      const price = isRetailer ? (item.retailer_unit_price ?? 0) : (item.hq_unit_price || 0)
      const amount = isRetailer ? (item.retailer_amount ?? 0) : (item.hq_amount || 0)
      return `
        <tr>
          <td style="border:1px solid #ccc;padding:6px;text-align:left">${escapeHtml(item.product?.name || '')}</td>
          <td style="border:1px solid #ccc;padding:6px;text-align:center">${escapeHtml(item.option_code || '-')}</td>
          <td style="border:1px solid #ccc;padding:6px;text-align:right">${item.quantity}</td>
          <td style="border:1px solid #ccc;padding:6px;text-align:right">${formatKRW(price)}</td>
          <td style="border:1px solid #ccc;padding:6px;text-align:right">${formatKRW(amount)}</td>
        </tr>
      `
    }).join('')

    const parties = isRetailer
      ? `<strong>공급자:</strong> ${escapeHtml(order.distributor?.company_name || '')}<br><strong>수급자:</strong> ${escapeHtml(order.retailer?.company_name || '')}`
      : `<strong>공급자:</strong> 아카라라이프 본사<br><strong>수급자:</strong> ${escapeHtml(order.distributor?.company_name || '')}`

    w.document.write(`
      <html><head><title>${escapeHtml(title)} - ${escapeHtml(order.order_number)}</title>
      <style>body{font-family:'Malgun Gothic',sans-serif;margin:40px;font-size:13px}
      table{border-collapse:collapse;width:100%}
      h1{text-align:center;margin-bottom:24px;font-size:20px}
      .info{display:flex;justify-content:space-between;margin-bottom:24px}
      .info div{flex:1}
      .totals{margin-top:16px;text-align:right}
      @media print{body{margin:20mm}}</style></head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <div class="info">
          <div>${parties}<br>
          <strong>주문번호:</strong> ${escapeHtml(order.order_number)}<br>
          <strong>발주일:</strong> ${formatDate(order.created_at)}</div>
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

  const getNextAction = (status: string): { label: string; nextStatus: string; color: string } | null => {
    switch (status) {
      case 'APPROVED':
        return { label: '본사 접수', nextStatus: 'HQ_RECEIVED', color: 'bg-purple-600 hover:bg-purple-700' }
      case 'HQ_RECEIVED':
        return { label: '출고 준비', nextStatus: 'PREPARING', color: 'bg-yellow-600 hover:bg-yellow-700' }
      case 'PREPARING':
        return { label: '출고 완료', nextStatus: 'SHIPPED', color: 'bg-indigo-600 hover:bg-indigo-700' }
      case 'DELIVERED':
        return { label: '거래 완료', nextStatus: 'COMPLETED', color: 'bg-emerald-600 hover:bg-emerald-700' }
      default:
        return null
    }
  }

  if (loading) return <div className="text-gray-400 text-sm">로딩 중...</div>
  if (!order) return <div className="text-gray-400 text-sm">주문을 찾을 수 없습니다.</div>

  const retailerVat = calculateVAT(order.retailer_total)
  const retailerTotal = calculateTotalWithVAT(order.retailer_total)
  const hqVat = order.hq_total ? calculateVAT(order.hq_total) : 0
  const hqTotal = order.hq_total ? calculateTotalWithVAT(order.hq_total) : 0
  const action = getNextAction(order.status)

  return (
    <div>
      <div className="mb-6">
        <Link href="/hq/orders" className="text-sm text-blue-600 hover:underline">&larr; 목록으로</Link>
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
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">주문 정보</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">소매점</dt>
              <dd className="text-gray-900 font-medium">{order.retailer?.company_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">총판</dt>
              <dd className="text-gray-900 font-medium">{order.distributor?.company_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">발주일</dt>
              <dd className="text-gray-900">{formatDateTime(order.created_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">희망납기</dt>
              <dd className="text-gray-900">{order.desired_date ? formatDate(order.desired_date) : '-'}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">배송 정보</h2>
          <dl className="space-y-2 text-sm">
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
            {order.delivered_at && (
              <div className="flex justify-between">
                <dt className="text-gray-500">수령일</dt>
                <dd className="text-gray-900">{formatDateTime(order.delivered_at)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* 가격 요약 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">가격 요약</h2>
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
                  <p className="text-xs text-gray-400 mb-1">총판 마진</p>
                  <p className="text-lg font-bold text-green-600">{formatKRW(retailerTotal - hqTotal)}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 주문 품목 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">주문 품목</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left text-xs font-medium text-gray-500">상품코드</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500">상품명</th>
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
                <td className="py-3 text-sm font-mono text-gray-500">{item.product?.product_code}</td>
                <td className="py-3 text-sm text-gray-900">
                  {item.product?.product_url ? (
                    <a href={item.product.product_url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:underline">{item.product.name}</a>
                  ) : item.product?.name}
                </td>
                <td className="py-3 text-sm text-gray-500">{item.option_code || '-'}</td>
                <td className="py-3 text-right text-sm text-gray-600">{item.quantity}</td>
                <td className="py-3 text-right text-sm text-gray-600">{item.retailer_unit_price != null ? formatKRW(item.retailer_unit_price) : '-'}</td>
                <td className="py-3 text-right text-sm font-medium text-gray-900">{item.retailer_amount != null ? formatKRW(item.retailer_amount) : '-'}</td>
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

      {/* 액션 버튼 */}
      <div className="flex items-center gap-3">
        {action && (
          <button
            onClick={() => handleStatusChange(action.nextStatus)}
            disabled={processing}
            className={cn(
              'px-8 py-3 text-white rounded-lg font-medium disabled:opacity-50',
              action.color
            )}
          >
            {processing ? '처리 중...' : action.label}
          </button>
        )}

        {/* 거래명세서 인쇄 */}
        {['DELIVERED', 'COMPLETED'].includes(order.status) && items.length > 0 && (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
