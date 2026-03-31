'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderItem, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/types'
import { formatKRW, formatDateTime, formatDate, calculateVAT, calculateTotalWithVAT, cn } from '@/lib/utils'
import Link from 'next/link'
import { use } from 'react'

export default function RetailerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { profile } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<(OrderItem & { product: { name: string; product_code: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return

    const fetchOrder = async () => {
      setLoading(true)
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single()

      if (orderData) setOrder(orderData)

      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*, product:products(name, product_code)')
        .eq('order_id', id)

      if (itemsData) setItems(itemsData)
      setLoading(false)
    }

    fetchOrder()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, id])

  const handleConfirmDelivery = async () => {
    if (!order) return
    await supabase
      .from('orders')
      .update({
        status: 'DELIVERED',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    setOrder({ ...order, status: 'DELIVERED', delivered_at: new Date().toISOString() })
  }

  const printStatement = (type: 'retailer') => {
    const w = window.open('', '_blank', 'width=800,height=600')
    if (!w || !order) return

    const subtotal = order.retailer_total
    const vatAmt = calculateVAT(subtotal)
    const totalAmt = calculateTotalWithVAT(subtotal)

    const rows = items.map(item => `
      <tr>
        <td style="border:1px solid #ccc;padding:6px;text-align:left">${item.product?.name || ''}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:center">${item.option_code || '-'}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:right">${item.quantity}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:right">${formatKRW(item.retailer_unit_price)}</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:right">${formatKRW(item.retailer_amount)}</td>
      </tr>
    `).join('')

    w.document.write(`
      <html><head><title>거래명세서 - ${order.order_number}</title>
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
          <div><strong>주문번호:</strong> ${order.order_number}<br>
          <strong>발주일:</strong> ${formatDate(order.created_at)}<br>
          <strong>배송지:</strong> ${order.shipping_address || '-'}</div>
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
        </div>
        <script>window.onload=function(){window.print()}</script>
      </body></html>
    `)
    w.document.close()
  }

  if (loading) return <div className="text-gray-400 text-sm">로딩 중...</div>
  if (!order) return <div className="text-gray-400 text-sm">주문을 찾을 수 없습니다.</div>

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

      {/* 주문 정보 */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">주문 정보</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">발주일</dt>
              <dd className="text-gray-900">{formatDateTime(order.created_at)}</dd>
            </div>
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
      </div>

      {/* 주문 품목 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">주문 품목</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left text-xs font-medium text-gray-500">상품</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500">옵션</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500">단가</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500">수량</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-500">금액</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-50">
                <td className="py-3 text-sm text-gray-900">{item.product?.name}</td>
                <td className="py-3 text-sm text-gray-500">{item.option_code || '-'}</td>
                <td className="py-3 text-right text-sm text-gray-600">{formatKRW(item.retailer_unit_price)}</td>
                <td className="py-3 text-right text-sm text-gray-600">{item.quantity}</td>
                <td className="py-3 text-right text-sm font-medium text-gray-900">{formatKRW(item.retailer_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">공급가액</span>
            <span>{formatKRW(order.retailer_total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">부가세</span>
            <span>{formatKRW(vat)}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>합계</span>
            <span className="text-blue-600">{formatKRW(total)}</span>
          </div>
        </div>
      </div>

      {/* 수령 확인 버튼 */}
      {order.status === 'SHIPPED' && (
        <button
          onClick={handleConfirmDelivery}
          className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
        >
          수령 확인
        </button>
      )}

      {/* 거래명세서 다운로드 */}
      {['DELIVERED', 'COMPLETED'].includes(order.status) && items.length > 0 && (
        <button
          onClick={() => printStatement('retailer')}
          className="px-6 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800 mt-4"
        >
          거래명세서 인쇄
        </button>
      )}
    </div>
  )
}
