'use client'

import { useState, useEffect } from 'react'

type Result = {
  row: number
  name: string
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

export default function NotificationsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string>('안녕하세요, #{이름}님!\n공지 사항 안내 드립니다.')
  const [senders, setSenders] = useState<string[]>([])
  const [selectedSender, setSelectedSender] = useState<string>('')
  const [customSender, setCustomSender] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [response, setResponse] = useState<Response | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 1. 발신번호 목록 조회
  useEffect(() => {
    const fetchSenders = async () => {
      try {
        const res = await fetch('/api/hq/notifications')
        if (res.ok) {
          const data = await res.json()
          setSenders(data.senders || [])
          if (data.senders && data.senders.length > 0) {
            setSelectedSender(data.senders[0])
          } else {
            setSelectedSender('custom')
          }
        }
      } catch (e) {
        console.error('발신번호 목록 로드 실패:', e)
      }
    }
    fetchSenders()
  }, [])

  // 2. 미리보기 문자 구성
  const previewText = message.replace(/#{이름}/g, '홍길동')

  // 3. 발송 요청 제출
  const handleSubmit = async () => {
    if (!file) {
      alert('엑셀 파일을 업로드해 주세요.')
      return
    }
    if (!message.trim()) {
      alert('공지 내용을 입력해 주세요.')
      return
    }

    const senderNum = selectedSender === 'custom' ? customSender : selectedSender
    if (!senderNum.trim()) {
      alert('발신 번호를 입력하거나 선택해 주세요.')
      return
    }

    const confirmed = confirm(
      `엑셀 파일의 모든 행에 문자 공지를 발송합니다.\n실제 문자가 발송되며 비용이 발생합니다.\n계속하시겠습니까?`
    )
    if (!confirmed) return

    setSending(true)
    setError(null)
    setResponse(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('message', message)
      formData.append('senderNumber', senderNum)

      const res = await fetch('/api/hq/notifications', {
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
    <div className="max-w-4xl mx-auto pb-12">
      {/* 顶部标题 */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">공지기능 (문자 일괄 발송)</h1>
        <p className="text-sm text-gray-500 mt-1">
          대량의 고객 또는 대리점 파트너에게 개별 맞춤 문자 공지를 일괄 발송합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 왼쪽 폼 컨트롤 (2/3) */}
        <div className="md:col-span-2 space-y-6">
          {/* 엑셀 업로드 카드 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">1. 수신 대상 업로드 (Excel)</h2>
            
            <div className="flex items-center justify-between mb-4 bg-gray-50 border border-gray-150 rounded-lg p-3 text-xs text-gray-600">
              <div>
                <p className="font-semibold text-gray-700">엑셀 파일 서식 필수 열:</p>
                <p className="mt-1"><code className="bg-gray-200 px-1 py-0.5 rounded font-mono">이름</code> (치환용) / <code className="bg-gray-200 px-1 py-0.5 rounded font-mono">연락처</code> (수신번호)</p>
              </div>
              <a
                href="/api/hq/notifications/sample"
                download
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg text-xs transition-colors shadow-sm"
              >
                📄 템플릿 다운로드
              </a>
            </div>

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
                선택됨: <span className="font-medium text-gray-700">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* 발송 설정 카드 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-gray-900">2. 발송 설정</h2>

            {/* 발신번호 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">발신번호 선택</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={selectedSender}
                  onChange={(e) => setSelectedSender(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {senders.map((s, idx) => (
                    <option key={s} value={s}>
                      {s} {idx === 0 ? '(기본 발신번호)' : `(备用 발신번호 ${idx})`}
                    </option>
                  ))}
                  <option value="custom">직접 입력 (커스텀)</option>
                </select>

                {selectedSender === 'custom' && (
                  <input
                    type="text"
                    value={customSender}
                    onChange={(e) => setCustomSender(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="하이픈(-) 없이 숫자만 입력"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            </div>

            {/* 공지 내용 */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-gray-600">공지 메시지 입력</label>
                <span className="text-[10px] text-gray-400">
                  <code className="bg-gray-100 px-1 rounded font-mono">#{`{이름}`}</code> 사용 시 이름으로 자동 치환됩니다.
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="공지 내용을 입력해 주세요. 예: 안녕하세요, #{이름}님..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!file || !message.trim() || sending}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              {sending ? '발송 중...' : '공지 문자 일괄 발송'}
            </button>
          </div>
        </div>

        {/* 오른쪽 미리보기 영역 (1/3) */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm sticky top-6">
            <h2 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">📱 발송 메시지 프리뷰</h2>
            
            {/* 가상 스마트폰 형태 */}
            <div className="border-4 border-gray-800 rounded-3xl overflow-hidden bg-gray-100 shadow-inner max-w-[260px] mx-auto">
              {/* 스피커/카메라 바 */}
              <div className="h-6 bg-gray-800 w-full flex items-center justify-center">
                <div className="w-16 h-2 bg-gray-900 rounded-full"></div>
              </div>
              
              {/* 화면 */}
              <div className="p-3 min-h-[300px] flex flex-col justify-end">
                {/* 문자 말풍선 */}
                <div className="bg-white border border-gray-200 text-xs rounded-2xl p-3 text-gray-800 shadow-sm leading-relaxed whitespace-pre-wrap max-w-[90%]">
                  {previewText || <span className="text-gray-400">내용을 입력하면 여기에 미리보기가 표시됩니다.</span>}
                </div>
                <div className="text-[10px] text-gray-400 mt-1.5 ml-2">오늘 · SMS 수신</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 에러 발생 표시 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-6 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* 발송 결과 리스트 */}
      {response && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-8 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-150 bg-gray-50 flex gap-6 text-sm">
            <div>
              <span className="text-gray-500">전체 수신자:</span>{' '}
              <span className="font-bold text-gray-900">{response.total}</span> 명
            </div>
            <div>
              <span className="text-gray-500">성공:</span>{' '}
              <span className="font-bold text-green-600">{response.sent}</span> 건
            </div>
            <div>
              <span className="text-gray-500">실패:</span>{' '}
              <span className="font-bold text-red-600">{response.failed}</span> 건
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3">행</th>
                  <th className="px-5 py-3">성명</th>
                  <th className="px-5 py-3">수신번호</th>
                  <th className="px-5 py-3 text-center">상태</th>
                  <th className="px-5 py-3">상세/에러내용</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {response.results.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-500">{r.row}</td>
                    <td className="px-5 py-3 font-semibold text-gray-950">{r.name || '-'}</td>
                    <td className="px-5 py-3 font-mono text-gray-600">{r.to || '-'}</td>
                    <td className="px-5 py-3 text-center">
                      {r.ok ? (
                        <span className="inline-flex px-2 py-0.5 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 rounded-full">성공</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 rounded-full">실패</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-red-500 max-w-[200px] truncate" title={r.error}>
                      {r.error || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
