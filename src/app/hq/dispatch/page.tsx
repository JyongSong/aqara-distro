'use client'

import { useState } from 'react'

type DispatchRow = {
  customer_name: string | null
  phone:         string | null
  address:       string | null
  order_numbers: string | null
  memo:          string | null
}

function todayKST(): string {
  // 서울 시간 기준 YYYY-MM-DD
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return now.toISOString().slice(0, 10)
}

const stripDash = (d: string) => d.replace(/-/g, '')

export default function HQDispatchPage() {
  const [dueDate, setDueDate] = useState(todayKST())
  const [rows,    setRows]    = useState<DispatchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const fetchData = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/hq/dispatch?dueDate=${stripDash(dueDate)}`)
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

  const downloadExcel = () => {
    window.location.href = `/api/hq/dispatch/export?dueDate=${stripDash(dueDate)}`
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">기사배정</h1>
        <p className="text-sm text-gray-500 mt-1">
          납기일자 기준 출장/설치 대상 주문 조회 및 Excel 다운로드
        </p>
      </div>

      {/* 조회 조건 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">납기일자</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
          />
        </div>
        <button
          onClick={fetchData}
          disabled={loading || !dueDate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '조회 중…' : '조회'}
        </button>
        {searched && rows.length > 0 && (
          <button
            onClick={downloadExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            📥 Excel 다운로드 ({rows.length}건)
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
          ERP 연결 오류: {error}
        </div>
      )}

      {/* 결과 */}
      <div className="bg-white rounded-xl border border-gray-200">
        {!searched ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            납기일자를 선택하고 조회 버튼을 눌러주세요.
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            해당 일자에 기사배정 대상 주문이 없습니다.
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-medium text-gray-500">
                    <th className="px-4 py-3 text-left">고객명</th>
                    <th className="px-4 py-3 text-left">연락처</th>
                    <th className="px-4 py-3 text-left">주문번호</th>
                    <th className="px-4 py-3 text-left">주소</th>
                    <th className="px-4 py-3 text-left">메모 (품목 내역)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 text-sm">
                      <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">
                        {r.customer_name || <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-mono whitespace-nowrap">
                        {r.phone || <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-blue-600 font-mono text-xs">
                        {r.order_numbers || <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.address || <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs leading-relaxed">
                        {r.memo || <span className="text-gray-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-gray-100">
              {rows.map((r, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-semibold text-gray-900">{r.customer_name}</p>
                    <span className="text-xs font-mono text-gray-500">{r.phone}</span>
                  </div>
                  {r.address && (
                    <p className="text-xs text-gray-500 mb-1">📍 {r.address}</p>
                  )}
                  {r.order_numbers && (
                    <p className="text-xs text-blue-600 font-mono mb-1">{r.order_numbers}</p>
                  )}
                  {r.memo && (
                    <p className="text-xs text-gray-500 mt-1">📦 {r.memo}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
