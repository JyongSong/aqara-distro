'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

interface PartnerSurvey {
  id: string
  status: 'pending' | 'approved' | 'rejected' | 'registered'
  business_name: string
  contact_name: string
  contact_position: string
  contact_phone: string
  email: string | null
  business_zipcode: string
  business_address: string
  business_address_detail: string | null
  sales_experience: string
  installation_experience: string
  annual_sales_volume: string
  sales_target: string
  installation_method: string
  installation_staff: string
  iot_expansion_intent: string
  support_purpose: string[]
  support_purpose_other: string | null
  interested_products: string[]
  additional_inquiry: string | null
  registered_user_id: string | null
  created_at: string
  updated_at: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  approved: '승인됨 (가입 대기)',
  rejected: '거절됨',
  registered: '가입 완료',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  registered: 'bg-green-100 text-green-800 border-green-200',
}

const PURPOSE_LABELS: Record<string, string> = {
  supply_condition: "새로운 공급 조건 확인",
  price_competitiveness: "제품 단가 경쟁력 확보",
  installation_education: "설치/서비스 교육",
  iot_expansion: "IoT 제품 판매 확대",
  new_business: "신규 사업 기회 탐색",
  other: "기타 (직접 입력)"
}

const EXP_LABELS: Record<string, string> = {
  under1: "1년 미만",
  "1to3": "1~3년",
  "3to5": "3~5년",
  "5to10": "5~10년",
  over10: "10년 이상"
}

const VOL_LABELS: Record<string, string> = {
  under100: "100대 미만",
  "100to300": "100~300대",
  "300to500": "300~500대",
  "500to1000": "500~1,000대",
  over1000: "1,000대 이상"
}

const TARGET_LABELS: Record<string, string> = {
  enduser: "일반 소비자",
  b2b: "소매/재판매 (업체 납품)",
  both: "둘 다 병행"
}

const METHOD_LABELS: Record<string, string> = {
  own_team: "자체 설치팀 운영",
  outsource: "외주 활용",
  mixed: "혼합 운영"
}

const STAFF_LABELS: Record<string, string> = {
  none: "없음",
  "1to2": "1~2명",
  "3to5": "3~5명",
  "6to10": "6~10명",
  over10: "10명 이상"
}

const INTENT_LABELS: Record<string, string> = {
  already: "이미 진행 중",
  reviewing: "검토 중",
  interested: "관심 있음",
  none: "없음"
}

export default function HQPartnerSurveysPage() {
  const [surveys, setSurveys] = useState<PartnerSurvey[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewingSurvey, setViewingSurvey] = useState<PartnerSurvey | null>(null)
  const [processing, setProcessing] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    fetchSurveys()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchSurveys = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hq/partner-surveys')
      const data = await res.json()
      if (res.ok) {
        setSurveys(data)
      } else {
        alert(data.error || '목록을 불러오는 중 오류가 발생했습니다.')
      }
    } catch (err) {
      console.error(err)
      alert('서버와의 통신에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (surveyId: string, action: 'approve' | 'reject') => {
    const confirmMsg = action === 'approve'
      ? '신청을 승인하고 전용 가입 링크가 포함된 안내 문자를 발송하시겠습니까?'
      : '신청을 거절하시겠습니까?'
    
    if (!confirm(confirmMsg)) return

    setProcessing(true)
    try {
      const res = await fetch(`/api/hq/partner-surveys/${surveyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      const data = await res.json()
      if (res.ok) {
        alert(action === 'approve' ? '승인 및 가입 링크 문자 발송 완료' : '거절 완료')
        setSurveys(prev => prev.map(s => s.id === surveyId ? { ...s, status: data.status } : s))
        // 모달 닫거나 갱신
        if (viewingSurvey?.id === surveyId) {
          setViewingSurvey(prev => prev ? { ...prev, status: data.status } : null)
        }
      } else {
        alert(data.error || '처리에 실패했습니다.')
      }
    } catch (err) {
      console.error(err)
      alert('오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const handleExport = () => {
    const exportData = surveys.map((s, idx) => ({
      'No': surveys.length - idx,
      '신청일': new Date(s.created_at).toLocaleDateString('ko-KR'),
      '상태': STATUS_LABELS[s.status],
      '업체명': s.business_name,
      '성함': s.contact_name,
      '직책': s.contact_position,
      '연락처': s.contact_phone,
      '이메일': s.email || '',
      '우편번호': s.business_zipcode,
      '사업장 주소': `${s.business_address} ${s.business_address_detail || ''}`.trim(),
      '도어락 판매경력': EXP_LABELS[s.sales_experience] || s.sales_experience,
      '도어락 설치경력': EXP_LABELS[s.installation_experience] || s.installation_experience,
      '연간 판매대수': VOL_LABELS[s.annual_sales_volume] || s.annual_sales_volume,
      '주요 판매대상': TARGET_LABELS[s.sales_target] || s.sales_target,
      '설치기사 운영방식': METHOD_LABELS[s.installation_method] || s.installation_method,
      '설치기사 인원': STAFF_LABELS[s.installation_staff] || s.installation_staff,
      'IoT 확대 의향': INTENT_LABELS[s.iot_expansion_intent] || s.iot_expansion_intent,
      '지원 사유': s.support_purpose.map(p => PURPOSE_LABELS[p] || p).join(', ') + (s.support_purpose_other ? ` (${s.support_purpose_other})` : ''),
      '관심 제품': s.interested_products.join(', '),
      '기타 문의사항': s.additional_inquiry || ''
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '대리점 지원 현황')
    XLSX.writeFile(wb, `대리점지원현황_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const filteredSurveys = useMemo(() => {
    return surveys.filter(s => {
      const matchStatus = statusFilter === 'all' || s.status === statusFilter
      const matchSearch =
        s.business_name.includes(searchQuery) ||
        s.contact_name.includes(searchQuery) ||
        s.contact_phone.includes(searchQuery)
      return matchStatus && matchSearch
    })
  }, [surveys, statusFilter, searchQuery])

  return (
    <div>
      <div className="mb-6 sm:mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">대리점 지원 현황</h1>
          <p className="text-sm text-gray-500 mt-1">공개 모집을 통해 접수된 대리점 지원 설문서를 평가하고 승인합니다.</p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <span>📥</span> Excel 다운로드
        </button>
      </div>

      {/* 상태 필터 및 검색 */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
        <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { value: 'all', label: '전체' },
            { value: 'pending', label: '대기' },
            { value: 'approved', label: '승인됨 (가입 대기)' },
            { value: 'registered', label: '가입 완료' },
            { value: 'rejected', label: '거절됨' }
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap',
                statusFilter === opt.value
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="업체명, 담당자, 연락처로 검색..."
          className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none transition-colors bg-white"
        />
      </div>

      {/* 리스트 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">로딩 중...</div>
        ) : filteredSurveys.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">신청 건이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-3.5 text-left">신청일</th>
                  <th className="px-6 py-3.5 text-left">업체명</th>
                  <th className="px-6 py-3.5 text-left">성함 / 직책</th>
                  <th className="px-6 py-3.5 text-left">연락처</th>
                  <th className="px-6 py-3.5 text-left">판매 경력</th>
                  <th className="px-6 py-3.5 text-left">설치 경력</th>
                  <th className="px-6 py-3.5 text-center">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
                {filteredSurveys.map((survey) => (
                  <tr
                    key={survey.id}
                    onClick={() => setViewingSurvey(survey)}
                    className="hover:bg-blue-50/20 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3.5 whitespace-nowrap text-xs text-gray-400">
                      {new Date(survey.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-gray-900">{survey.business_name}</td>
                    <td className="px-6 py-3.5">
                      {survey.contact_name} <span className="text-gray-400 text-xs">({survey.contact_position})</span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-500">{survey.contact_phone}</td>
                    <td className="px-6 py-3.5 text-xs text-gray-600">{EXP_LABELS[survey.sales_experience]}</td>
                    <td className="px-6 py-3.5 text-xs text-gray-600">{EXP_LABELS[survey.installation_experience]}</td>
                    <td className="px-6 py-3.5 text-center whitespace-nowrap">
                      <span className={cn(
                        'inline-flex px-2.5 py-1 rounded-full text-xs font-medium border',
                        STATUS_COLORS[survey.status]
                      )}>
                        {STATUS_LABELS[survey.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 지원 상세 모달 */}
      {viewingSurvey && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-50 transition-opacity">
          <div className="bg-white h-full w-full max-w-2xl flex flex-col shadow-2xl animate-slide-in">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">지원 상세 평가</h3>
                <p className="text-xs text-gray-500 mt-0.5">신청일: {new Date(viewingSurvey.created_at).toLocaleString('ko-KR')}</p>
              </div>
              <button
                onClick={() => setViewingSurvey(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* 기본 정보 */}
              <div>
                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-blue-600 rounded-full inline-block"></span>
                  1. 기본 정보
                </h4>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-2xl p-4 border border-gray-100 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">업체명</p>
                    <p className="font-bold text-gray-900">{viewingSurvey.business_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">성함 / 직책</p>
                    <p className="font-medium text-gray-800">{viewingSurvey.contact_name} ({viewingSurvey.contact_position})</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">연락처</p>
                    <p className="text-gray-800">{viewingSurvey.contact_phone}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">이메일</p>
                    <p className="text-gray-800">{viewingSurvey.email || '-'}</p>
                  </div>
                </div>
              </div>

              {/* 사업 현황 */}
              <div>
                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-blue-600 rounded-full inline-block"></span>
                  2. 사업 현황
                </h4>
                <div className="space-y-3 bg-gray-50 rounded-2xl p-4 border border-gray-100 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">사업장 주소</p>
                    <p className="text-gray-800">
                      [{viewingSurvey.business_zipcode}] {viewingSurvey.business_address} {viewingSurvey.business_address_detail || ''}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200/50">
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">도어락 판매 경력</p>
                      <p className="text-gray-900 font-semibold">{EXP_LABELS[viewingSurvey.sales_experience]}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">도어락 설치 경력</p>
                      <p className="text-gray-900 font-semibold">{EXP_LABELS[viewingSurvey.installation_experience]}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200/50">
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">2025년 연간 도어락 판매량</p>
                      <p className="text-gray-800">{VOL_LABELS[viewingSurvey.annual_sales_volume]}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">주요 판매 대상</p>
                      <p className="text-gray-800">{TARGET_LABELS[viewingSurvey.sales_target]}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 설치 및 IoT 역량 */}
              <div>
                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-blue-600 rounded-full inline-block"></span>
                  3. 설치 및 IoT 역량
                </h4>
                <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-2xl p-4 border border-gray-100 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">설치기사 운영방식</p>
                    <p className="font-semibold text-gray-800">{METHOD_LABELS[viewingSurvey.installation_method]}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">설치 기사 인원</p>
                    <p className="font-semibold text-gray-800">{STAFF_LABELS[viewingSurvey.installation_staff]}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-0.5">IoT 제품 확장 의향</p>
                    <p className="font-semibold text-gray-900 text-blue-600">{INTENT_LABELS[viewingSurvey.iot_expansion_intent]}</p>
                  </div>
                </div>
              </div>

              {/* 지원 목적 */}
              <div>
                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-blue-600 rounded-full inline-block"></span>
                  4. 지원 목적
                </h4>
                <div className="space-y-4 bg-gray-50 rounded-2xl p-4 border border-gray-100 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">지원 사유 / 기대 사항</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {viewingSurvey.support_purpose.map(p => (
                        <span key={p} className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700">
                          {PURPOSE_LABELS[p] || p}
                        </span>
                      ))}
                    </div>
                    {viewingSurvey.support_purpose_other && (
                      <p className="text-xs text-gray-500 mt-2 bg-white rounded-lg p-2 border border-gray-100">
                        기타 내용: {viewingSurvey.support_purpose_other}
                      </p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-gray-200/50">
                    <p className="text-gray-400 text-xs mb-1.5">관심 제품</p>
                    {viewingSurvey.interested_products.length > 0 ? (
                      <div className="flex gap-2">
                        {viewingSurvey.interested_products.map(p => (
                          <span key={p} className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold">
                            {p}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">-</p>
                    )}
                  </div>
                  {viewingSurvey.additional_inquiry && (
                    <div className="pt-2 border-t border-gray-200/50">
                      <p className="text-gray-400 text-xs mb-1">기타 문의사항</p>
                      <p className="bg-white rounded-lg p-2.5 border border-gray-100 text-xs leading-relaxed text-gray-600">
                        {viewingSurvey.additional_inquiry}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer (Actions) */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={() => setViewingSurvey(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium transition-colors"
              >
                닫기
              </button>
              
              <div className="ml-auto flex gap-2">
                {/* 1. 대기(pending) 상태일 때만 승인 및 가입 링크 발송 노출 */}
                {viewingSurvey.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleAction(viewingSurvey.id, 'reject')}
                      disabled={processing}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-sm rounded-lg border border-red-200 transition-colors disabled:opacity-50"
                    >
                      거절
                    </button>
                    <button
                      onClick={() => handleAction(viewingSurvey.id, 'approve')}
                      disabled={processing}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                    >
                      승인 및 가입 링크 문자 전송
                    </button>
                  </>
                )}

                {/* 2. 승인됨(approved) 상태일 때 거절(취소) 가능 */}
                {viewingSurvey.status === 'approved' && (
                  <>
                    <span className="text-xs text-blue-600 font-semibold flex items-center mr-2">
                      ✉ 가입 링크 문자 발송 완료 (대기 중)
                    </span>
                    <button
                      onClick={() => handleAction(viewingSurvey.id, 'reject')}
                      disabled={processing}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-sm rounded-lg border border-red-200 transition-colors disabled:opacity-50"
                    >
                      거절
                    </button>
                  </>
                )}

                {/* 3. 이미 가입 완료(registered) 되었을 때 완료 표시 */}
                {viewingSurvey.status === 'registered' && (
                  <span className="px-4 py-2 bg-green-100 text-green-800 border border-green-200 rounded-lg text-sm font-bold flex items-center gap-1">
                    ✓ 대리점 회원가입 완료
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
