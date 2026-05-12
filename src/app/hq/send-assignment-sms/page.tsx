'use client'

import { useState } from 'react'

type Result = {
  row: number
  branch: string
  to: string
  ok: boolean
  error?: string
}

type Response = {
  total: number
  sent: number
  failed: number
  results: Result[]
}

export default function SendAssignmentSmsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [response, setResponse] = useState<Response | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!file) return
    const confirmed = confirm(
      `엑셀 파일의 모든 행에 SMS를 발송합니다.\n실제 SMS가 발송되며 비용이 발생합니다.\n계속하시겠습니까?`
    )
    if (!confirmed) return

    setSending(true)
    setError(null)
    setResponse(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/hq/send-assignment-sms', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `요청 실패 (${res.status})`)
      } else {
        setResponse(data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">설치 배정 SMS 발송</h1>
        <p className="text-sm text-gray-500 mt-1">
          배정결과 엑셀 파일을 업로드하여 고객에게 기사 연락처 SMS를 일괄 발송합니다.
        </p>
      </div>

      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-900">
        <p className="font-medium mb-1">엑셀 파일 형식</p>
        <ul className="list-disc ml-5 space-y-0.5 text-blue-800">
          <li>시트명: <code className="bg-blue-100 px-1 rounded">배정결과</code></li>
          <li>필요 컬럼: <code className="bg-blue-100 px-1 rounded">지점명</code> / <code className="bg-blue-100 px-1 rounded">기사님 연락처</code> / <code className="bg-blue-100 px-1 rounded">연락처</code></li>
        </ul>
        <p className="font-medium mt-3 mb-1">발송 문구</p>
        <pre className="bg-white border border-blue-100 rounded p-3 text-xs text-gray-700 whitespace-pre-wrap">{`아카라라이프 설치 배정 완료
[지점명] [기사님 연락처]
기사님 연락처 입니다`}</pre>
      </div>

      {/* 파일 업로드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">엑셀 파일</label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setResponse(null)
            setError(null)
          }}
          className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {file && (
          <p className="mt-2 text-xs text-gray-500">
            선택됨: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!file || sending}
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? '발송 중...' : 'SMS 일괄 발송'}
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* 결과 */}
      {response && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex gap-6 text-sm">
            <div>
              <span className="text-gray-500">전체</span>{' '}
              <span className="font-semibold text-gray-900">{response.total}</span>
            </div>
            <div>
              <span className="text-gray-500">성공</span>{' '}
              <span className="font-semibold text-green-700">{response.sent}</span>
            </div>
            <div>
              <span className="text-gray-500">실패</span>{' '}
              <span className="font-semibold text-red-700">{response.failed}</span>
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">행</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">지점명</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">수신번호</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">결과</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">에러</th>
              </tr>
            </thead>
            <tbody>
              {response.results.map((r, idx) => (
                <tr key={idx} className="border-b border-gray-50 text-sm">
                  <td className="px-4 py-2 text-gray-600">{r.row}</td>
                  <td className="px-4 py-2 text-gray-900">{r.branch || '-'}</td>
                  <td className="px-4 py-2 text-gray-700 font-mono">{r.to || '-'}</td>
                  <td className="px-4 py-2 text-center">
                    {r.ok ? (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">성공</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">실패</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-red-600">{r.error || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
