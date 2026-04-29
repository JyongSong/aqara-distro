'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type ShipmentRow = {
  req_no: string
  req_date: string
  so_no: string
  po_partner: string | null
  online_order_no: string | null
  item_name: string
  item_code: string
  qty_req: number
  qty_shipped: number
  qty_pending: number
  tracking_no: string | null
  carrier_code: string | null
  delivery_method: string | null
  partner_name: string
}

function getDefaultDates() {
  const to   = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return { from, to }
}

export default function HQShipmentsPage() {
  const defaults = getDefaultDates()
  const [dateFrom, setDateFrom] = useState(defaults.from)
  const [dateTo,   setDateTo]   = useState(defaults.to)
  const [rows,     setRows]     = useState<ShipmentRow[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/erp/shipments?from=${dateFrom}&to=${dateTo}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'ERP 조회 실패')
      setRows(json.data)
      setSearched(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류 발생')
    } finally {
      setLoading(false)
    }
  }

  const shippedCount  = rows.filter(r => r.qty_pending === 0 && r.qty_shipped > 0).length
  const pendingCount  = rows.filter(r => r.qty_pending > 0).length
  const trackingCount = rows.filter(r => r.tracking_no).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">출하현황</h1>
        <p className="text-sm text-gray-500 mt-1">ERP 출하의뢰 현황 조회</p>
      </div>

      {/* 조회 조건 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">시작일</label>
          <input
            type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">종료일</label>
          <input
            type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
          />
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '조회 중…' : '조회'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
          ERP 연결 오류: {error}
        </div>
      )}

      {/* 요약 카드 */}
      {searched && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500">전체</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{rows.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
            <p className="text-xs text-gray-500">출하완료</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{shippedCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-orange-200 p-4 text-center">
            <p className="text-xs text-gray-500">미출하</p>
            <p className="text-2xl font-bold text-orange-500 mt-1">{pendingCount}</p>
          </div>
        </div>
      )}

      {/* 결과 */}
      <div className="bg-white rounded-xl border border-gray-200">
        {!searched ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            조회 버튼을 눌러 출하현황을 확인하세요.
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            해당 기간에 출하의뢰 내역이 없습니다.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">의뢰일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">의뢰번호</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">수주번호</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">거래처PO</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">품목명</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">의뢰</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">출하</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">배송방법</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">송장번호</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isDone = row.qty_pending === 0 && row.qty_shipped > 0
                    return (
                      <tr key={i} className={cn(
                        'border-b border-gray-50 hover:bg-gray-50',
                        isDone && 'bg-green-50 hover:bg-green-100'
                      )}>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{row.req_date}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-700">{row.req_no}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{row.so_no}</td>
                        <td className="px-4 py-3 text-sm text-blue-600">{row.po_partner || <span className="text-gray-300">-</span>}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.item_name}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">{row.qty_req}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">{row.qty_shipped}</td>
                        <td className="px-4 py-3 text-center">
                          {isDone ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">완료</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              미출하 {row.qty_pending}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{row.delivery_method || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          {row.tracking_no
                            ? <span className="font-mono text-blue-700">{row.tracking_no}</span>
                            : <span className="text-gray-300">-</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {rows.map((row, i) => {
                const isDone = row.qty_pending === 0 && row.qty_shipped > 0
                return (
                  <div key={i} className={cn('p-4', isDone && 'bg-green-50')}>
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-medium text-gray-900 flex-1 pr-2">{row.item_name}</p>
                      {isDone ? (
                        <span className="text-xs font-medium text-green-600 whitespace-nowrap">출하완료</span>
                      ) : (
                        <span className="text-xs font-medium text-orange-500 whitespace-nowrap">미출하 {row.qty_pending}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{row.req_date} · {row.req_no}</p>
                    {row.po_partner && (
                      <p className="text-xs text-blue-600 mt-0.5">PO: {row.po_partner}</p>
                    )}
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>의뢰 {row.qty_req} / 출하 {row.qty_shipped}</span>
                      <span>{row.delivery_method || ''}</span>
                    </div>
                    {row.tracking_no && (
                      <p className="text-xs font-mono text-blue-700 mt-1">📦 {row.tracking_no}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {searched && trackingCount > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-right">송장번호 확인된 건: {trackingCount}건</p>
      )}
    </div>
  )
}
