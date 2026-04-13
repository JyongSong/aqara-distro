'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'

const BarcodeScannerModal = dynamic(
  () => import('@/components/BarcodeScannerModal'),
  { ssr: false }
)

interface LogisticsOrder {
  id: string
  order_number: string
  retailer_name: string
  retailer_phone: string | null
  k100_qty: number
  l100_qty: number
  k100_boxes: number
  l100_boxes: number
  created_at: string
}

interface BoxIdState {
  K100: string[]
  L100: string[]
}

interface ScanTarget {
  type: 'K100' | 'L100'
  index: number
  label: string
}

// K100: AK 시작 + TAK 끝 + 총 13자리
// L100: LUMI 시작 + LS 끝 + 총 22자리
function validateBoxId(type: 'K100' | 'L100', value: string): string | null {
  if (!value.trim()) return null // 빈 값은 별도 처리
  if (type === 'K100') {
    if (value.length !== 13) return '13자리여야 합니다'
    if (!value.startsWith('AK')) return "'AK'로 시작해야 합니다"
    if (!value.endsWith('TAK')) return "'TAK'으로 끝나야 합니다"
  }
  if (type === 'L100') {
    if (value.length !== 22) return '22자리여야 합니다'
    if (!value.startsWith('LUMI')) return "'LUMI'로 시작해야 합니다"
    if (!value.endsWith('LS')) return "'LS'로 끝나야 합니다"
  }
  return null
}

interface OrderCardProps {
  order: LogisticsOrder
  expanded: boolean
  onToggle: () => void
  boxIds: BoxIdState
  onBoxIdChange: (type: 'K100' | 'L100', index: number, value: string) => void
  onScanClick: (type: 'K100' | 'L100', index: number) => void
  onSubmit: () => void
  submitting: boolean
  submitted: boolean
}

function getDuplicates(boxIds: BoxIdState): Set<string> {
  const all = [...boxIds.K100, ...boxIds.L100].map(v => v.trim()).filter(Boolean)
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const v of all) {
    if (seen.has(v)) dupes.add(v)
    else seen.add(v)
  }
  return dupes
}

function OrderCard({
  order,
  expanded,
  onToggle,
  boxIds,
  onBoxIdChange,
  onScanClick,
  onSubmit,
  submitting,
  submitted,
}: OrderCardProps) {
  const dupes = getDuplicates(boxIds)

  const allFilled =
    (boxIds.K100.length + boxIds.L100.length > 0) &&
    dupes.size === 0 &&
    boxIds.K100.every((v) => v.trim() !== '' && validateBoxId('K100', v) === null) &&
    boxIds.L100.every((v) => v.trim() !== '' && validateBoxId('L100', v) === null)

  const productSummary = []
  if (order.k100_qty > 0) productSummary.push(`K100 × ${order.k100_qty}개`)
  if (order.l100_qty > 0) productSummary.push(`L100 × ${order.l100_qty}개`)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Card header - always visible */}
      <button
        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{order.order_number}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
              출고 준비
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1 truncate">
            {order.retailer_name}
            {order.retailer_phone && (
              <span className="text-gray-400 ml-2">{order.retailer_phone}</span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{productSummary.join(' · ')}</p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 flex-shrink-0 ml-2 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          {/* K100 box IDs */}
          {order.k100_boxes > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                K100 박스 ID ({order.k100_boxes}개 박스 / {order.k100_qty}개 제품)
              </p>
              <div className="space-y-2">
                {Array.from({ length: order.k100_boxes }).map((_, i) => {
                  const val = boxIds.K100[i] ?? ''
                  const fmtErr = val.trim() ? validateBoxId('K100', val) : null
                  const isDupe = val.trim() ? dupes.has(val.trim()) : false
                  const err = fmtErr ?? (isDupe ? '중복된 박스 ID입니다' : null)
                  const hasErr = !!err
                  return (
                    <div key={`k100-${i}`}>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => onBoxIdChange('K100', i, e.target.value)}
                          placeholder="AK__________TAK (13자리)"
                          className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent font-mono text-gray-900 ${
                            hasErr ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => onScanClick('K100', i)}
                          className="px-3 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3m11-4v3a1 1 0 01-1 1h-3M17 4h3a1 1 0 011 1v3M7 7h.01M7 12h.01M7 17h.01M12 7h.01M12 12h.01M12 17h.01M17 7h.01M17 12h.01M17 17h.01" />
                          </svg>
                          스캔
                        </button>
                      </div>
                      {err && <p className="text-xs text-red-500 mt-1 pl-1">⚠ {err}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* L100 box IDs */}
          {order.l100_boxes > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                L100 박스 ID ({order.l100_boxes}개 박스 / {order.l100_qty}개 제품)
              </p>
              <div className="space-y-2">
                {Array.from({ length: order.l100_boxes }).map((_, i) => {
                  const val = boxIds.L100[i] ?? ''
                  const fmtErr = val.trim() ? validateBoxId('L100', val) : null
                  const isDupe = val.trim() ? dupes.has(val.trim()) : false
                  const err = fmtErr ?? (isDupe ? '중복된 박스 ID입니다' : null)
                  const hasErr = !!err
                  return (
                    <div key={`l100-${i}`}>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => onBoxIdChange('L100', i, e.target.value)}
                          placeholder="LUMI__________________LS (22자리)"
                          className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent font-mono text-gray-900 ${
                            hasErr ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-blue-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => onScanClick('L100', i)}
                          className="px-3 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3m11-4v3a1 1 0 01-1 1h-3M17 4h3a1 1 0 011 1v3M7 7h.01M7 12h.01M7 17h.01M12 7h.01M12 12h.01M12 17h.01M17 7h.01M17 12h.01M17 17h.01" />
                          </svg>
                          스캔
                        </button>
                      </div>
                      {err && <p className="text-xs text-red-500 mt-1 pl-1">⚠ {err}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!allFilled || submitting || submitted}
            className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors ${
              submitted
                ? 'bg-green-100 text-green-700 cursor-default'
                : allFilled && !submitting
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitted
              ? '✅ 출고 완료'
              : submitting
              ? '처리 중...'
              : '출고 확정'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function LogisticsPage() {
  const [orders, setOrders] = useState<LogisticsOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [boxIdMap, setBoxIdMap] = useState<Record<string, BoxIdState>>({})
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [successMessages, setSuccessMessages] = useState<Record<string, boolean>>({})

  // Scanner state
  const [scanTarget, setScanTarget] = useState<(ScanTarget & { orderId: string }) | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/open/logistics')
      if (!res.ok) throw new Error('Failed to load orders')
      const data: LogisticsOrder[] = await res.json()
      setOrders(data)

      // Initialize box ID state for each order
      const initial: Record<string, BoxIdState> = {}
      data.forEach((order) => {
        initial[order.id] = {
          K100: Array(order.k100_boxes).fill(''),
          L100: Array(order.l100_boxes).fill(''),
        }
      })
      setBoxIdMap(initial)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleBoxIdChange = (
    orderId: string,
    type: 'K100' | 'L100',
    index: number,
    value: string
  ) => {
    setBoxIdMap((prev) => {
      const updated = { ...prev }
      const arr = [...(updated[orderId]?.[type] ?? [])]
      arr[index] = value
      updated[orderId] = { ...updated[orderId], [type]: arr }
      return updated
    })
  }

  const handleScanResult = useCallback(
    (value: string) => {
      if (!scanTarget) return
      const { orderId, type, index } = scanTarget
      setBoxIdMap((prev) => {
        const updated = { ...prev }
        const arr = [...(updated[orderId]?.[type] ?? [])]
        arr[index] = value
        updated[orderId] = { ...updated[orderId], [type]: arr }
        return updated
      })
      setScanTarget(null)
    },
    [scanTarget]
  )

  const handleSubmit = async (orderId: string) => {
    const ids = boxIdMap[orderId]
    if (!ids) return

    setSubmittingId(orderId)
    try {
      const box_ids: { K100?: string[]; L100?: string[] } = {}
      if (ids.K100.length > 0) box_ids.K100 = ids.K100
      if (ids.L100.length > 0) box_ids.L100 = ids.L100

      const res = await fetch(`/api/open/logistics/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box_ids }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to update order')
      }

      setSuccessMessages((prev) => ({ ...prev, [orderId]: true }))

      // Remove from list after short delay
      setTimeout(() => {
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
        setExpandedId((prev) => (prev === orderId ? null : prev))
      }, 1200)
    } catch (e) {
      alert(e instanceof Error ? e.message : '출고 처리 중 오류가 발생했습니다.')
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">🚚 물류 관리</h1>
            <p className="text-xs text-gray-500 mt-0.5">출고 준비 중인 HQ 주문</p>
          </div>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '로딩 중...' : '새로고침'}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-3" />
            <p className="text-sm">주문을 불러오는 중...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-sm text-red-700 font-medium">오류가 발생했습니다</p>
            <p className="text-xs text-red-500 mt-1">{error}</p>
            <button
              onClick={fetchOrders}
              className="mt-3 px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-base font-medium text-gray-500">처리할 주문이 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">출고 준비 중인 K100/L100 주문이 없습니다</p>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 font-medium">
              출고 대기 주문 {orders.length}건
            </p>
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                expanded={expandedId === order.id}
                onToggle={() =>
                  setExpandedId((prev) => (prev === order.id ? null : order.id))
                }
                boxIds={boxIdMap[order.id] ?? { K100: [], L100: [] }}
                onBoxIdChange={(type, index, value) =>
                  handleBoxIdChange(order.id, type, index, value)
                }
                onScanClick={(type, index) => {
                  const productSummary = []
                  if (order.k100_qty > 0) productSummary.push(`K100 × ${order.k100_qty}`)
                  if (order.l100_qty > 0) productSummary.push(`L100 × ${order.l100_qty}`)
                  setScanTarget({
                    orderId: order.id,
                    type,
                    index,
                    label: `${order.order_number} - ${type} 박스 ${index + 1}`,
                  })
                }}
                onSubmit={() => handleSubmit(order.id)}
                submitting={submittingId === order.id}
                submitted={!!successMessages[order.id]}
              />
            ))}
          </div>
        )}
      </main>

      {/* Barcode scanner modal */}
      {scanTarget && (
        <BarcodeScannerModal
          label={scanTarget.label}
          onScan={handleScanResult}
          onClose={() => setScanTarget(null)}
        />
      )}
    </div>
  )
}
