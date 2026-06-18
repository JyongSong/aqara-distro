'use client'

import { useState } from 'react'
import Script from 'next/script'

interface DaumPostcodeData {
  zonecode: string
  roadAddress: string
  jibunAddress: string
}

declare global {
  interface Window {
    daum: {
      Postcode: new (config: { oncomplete: (data: DaumPostcodeData) => void }) => { open: () => void }
    }
  }
}

const LOGO_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663375882276/AcFeksXYT56o4U9QsgyZGe/aqara_logo_6a235e61.png"
const K100_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663375882276/AcFeksXYT56o4U9QsgyZGe/doorlock_k100_29952d57.png"
const L100_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663375882276/AcFeksXYT56o4U9QsgyZGe/doorlock_l100_b1d33277.png"
const U100_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663375882276/AcFeksXYT56o4U9QsgyZGe/doorlock_u100_cec83568.png"

const PURPOSE_OPTIONS = [
  { value: "supply_condition", label: "새로운 공급 조건 확인" },
  { value: "price_competitiveness", label: "제품 단가 경쟁력 확보" },
  { value: "installation_education", label: "설치/서비스 교육" },
  { value: "iot_expansion", label: "IoT 제품 판매 확대" },
  { value: "new_business", label: "신규 사업 기회 탐색" },
  { value: "other", label: "기타 (직접 입력)" }
]

const PRODUCT_OPTIONS = [
  { value: "K100", label: "스마트 도어락 K100", img: K100_IMG },
  { value: "L100", label: "스마트 도어락 L100", img: L100_IMG },
  { value: "U100", label: "스마트 도어락 U100", img: U100_IMG }
]

export default function PartnerInvitePage() {
  const [form, setForm] = useState({
    businessName: '',
    contactName: '',
    contactPosition: '',
    contactPhone: '',
    email: '',
    businessZipcode: '',
    businessAddress: '',
    businessAddressDetail: '',
    salesExperience: '1to3',
    installationExperience: '1to3', // 도어락 설치 경력
    annualSalesVolume: '100to300',
    salesTarget: 'enduser',
    installationMethod: 'own_team',
    installationStaff: '1to2',
    iotExpansionIntent: 'interested',
    supportPurpose: [] as string[],
    supportPurposeOther: '',
    interestedProducts: [] as string[],
    additionalInquiry: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const openPostcode = () => {
    if (typeof window === 'undefined' || !window.daum?.Postcode) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    new window.daum.Postcode({
      oncomplete: (data: DaumPostcodeData) => {
        setForm(prev => ({
          ...prev,
          businessZipcode: data.zonecode,
          businessAddress: data.roadAddress || data.jibunAddress,
          businessAddressDetail: ''
        }))
        setErrors(prev => ({ ...prev, businessAddress: '' }))
        setTimeout(() => {
          document.getElementById('businessAddressDetail')?.focus()
        }, 100)
      }
    }).open()
  }

  const handleFieldChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const toggleCheckbox = (field: 'supportPurpose' | 'interestedProducts', value: string) => {
    const list = form[field]
    const updated = list.includes(value) ? list.filter(v => v !== value) : [...list, value]
    handleFieldChange(field, updated)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!form.businessName.trim()) newErrors.businessName = '업체명을 입력해 주세요.'
    if (!form.contactName.trim()) newErrors.contactName = '성함을 입력해 주세요.'
    if (!form.contactPosition.trim()) newErrors.contactPosition = '직책을 입력해 주세요.'
    if (!form.contactPhone.trim()) newErrors.contactPhone = '연락처를 입력해 주세요.'
    if (!form.businessAddress) newErrors.businessAddress = '사업장 주소를 검색해 주세요.'
    if (form.supportPurpose.length === 0) newErrors.supportPurpose = '지원 사유를 하나 이상 선택해 주세요.'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) {
      alert('필수 항목을 모두 입력해 주세요.')
      document.querySelector('[data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/open/partner-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '제출에 실패했습니다.')
      }

      setSubmitted(true)
    } catch (err: any) {
      alert(err.message || '오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5 py-12">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">지원 설문 제출 완료</h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            아카라 공식 도어락 대리점 모집에 지원해 주셔서 감사합니다.<br />
            제출해 주신 소중한 정보를 바탕으로 담당자가 검토 후 빠른 시일 내에 연락드리겠습니다.
          </p>
          <div className="bg-gray-50 rounded-2xl p-4 text-left text-xs text-gray-500 space-y-1 mb-8">
            <p className="font-semibold text-gray-700">문의처</p>
            <p>• 담당자: 김시열 (010-9961-4937 | siyeol@aqara.kr)</p>
            <p>• 담당자: 김동수 (010-2245-2222)</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-black hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
          >
            확인
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="lazyOnload" />
      <div className="min-h-screen bg-gray-50">
        {/* Banner Section */}
        <section className="relative bg-slate-900 text-white overflow-hidden">
          <div className="absolute inset-0 opacity-15">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: 'radial-gradient(circle at 20% 50%, #2563eb 0%, transparent 50%), radial-gradient(circle at 80% 20%, #c9a84c 0%, transparent 45%)'
              }}
            />
          </div>
          <div className="relative max-w-xl mx-auto px-5 pt-12 pb-12 text-center">
            <div className="mb-6">
              <img src={LOGO_IMG} alt="AqaraLife" className="h-7 brightness-0 invert mx-auto" />
            </div>
            
            <div className="inline-flex items-center bg-blue-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full mb-6">
              <span>PARTNER RECRUITMENT</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-4 text-white">
              아카라(Aqara) 스마트 도어락<br />공식 대리점 모집
            </h1>
            
            <p className="text-amber-400 text-sm font-semibold mb-2">
              "글로벌 스마트홈 리더 아카라와 함께 미래 홈 IoT 시장을 선도할 파트너를 모십니다."
            </p>
          </div>
        </section>

        {/* Intro & Sections 1 & 2 */}
        <section className="bg-white py-10 text-gray-800">
          <div className="max-w-xl mx-auto px-5 space-y-10">
            {/* Introduction block */}
            <div className="bg-blue-50/50 border-l-4 border-blue-600 rounded-r-2xl p-5 text-sm leading-relaxed text-gray-700">
              <p>
                아카라(Aqara)는 고도화된 IoT 기술력을 바탕으로 전 세계 사용자에게 스마트하고 안전한 라이프스타일을 제공하는 글로벌 홈 IoT 전문 브랜드입니다. 압도적인 기술력과 감각적인 디자인으로 큰 사랑을 받고 있는 <strong>아카라 스마트 도어락</strong>의 유통 및 시공망을 전국으로 확대하고자, 열정과 역량을 갖춘 공식 대리점 파트너를 모집합니다. 급성장하는 스마트홈 시장에서 아카라와 함께 성공 신화를 결성할 비즈니스 파트너의 많은 관심과 지원 바랍니다.
              </p>
            </div>

            {/* 1. 모집 부문 및 지역 */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 border-l-4 border-blue-600 pl-3 flex items-center">
                1. 모집 부문 및 지역
              </h3>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 space-y-3 text-sm">
                <p className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>모집 부문:</strong> 아카라 스마트 도어락 공식 대리점 (판매, 영업 및 설치·A/S 수행)</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span><strong>모집 지역:</strong> 전국 주요 시·도 단위</span>
                </p>
              </div>
            </div>

            {/* 2. 신청 자격 및 우대사항 */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 border-l-4 border-blue-600 pl-3 flex items-center">
                2. 신청 자격 및 우대사항
              </h3>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 space-y-4 text-sm">
                <div>
                  <p className="font-bold text-gray-900 mb-1.5">• 필수 자격:</p>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700">
                    <li>개인사업자 또는 법인사업자 (도어락, 인테리어, 가전, 홈 네트워크 등 관련 업종)</li>
                    <li className="font-bold text-blue-700">도어락 시공 및 설치 경력 1년 이상 필수</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-gray-900 mb-1.5">• 필수 조건:</p>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700">
                    <li>본사 지정 설치 서비스 교육 이수 및 실행</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-gray-900 mb-1.5">• 우대 사항:</p>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700">
                    <li>스마트폰 활용 및 디지털 기기 조작에 능숙하신 분</li>
                    <li>오프라인 매장(쇼룸) 보유 또는 운영 예정인 사업자</li>
                    <li>지역 내 유통 네트워크 및 영업망을 확보하고 있는 사업자</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. 아카라 파트너 특별 혜택 */}
        <section className="bg-gray-50 py-10 border-t border-b border-gray-100">
          <div className="max-w-xl mx-auto px-5 space-y-6">
            <h3 className="text-lg font-bold text-gray-900 border-l-4 border-blue-600 pl-3 flex items-center">
              3. 아카라 파트너 특별 혜택
            </h3>
            
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-center py-3.5 px-4 rounded-xl text-sm font-bold">
              "안정적인 수익 창출과 비즈니스 성장을 위한 전폭적인 지원을 약속합니다."
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: "경쟁력 있는 공급가", desc: "본사 지정 공식 총판을 통한 투명한 발주, 정산 및 대금 거래 진행" },
                { title: "강력한 마케팅 지원", desc: "본사 주도 온·오프라인 브랜드 홍보, 리플렛 및 홍보물 제공" },
                { title: "체계적인 기술 교육", desc: "제품 설치, 세팅, 홈 IoT 연동 및 A/S 기술 교육 무료 제공" },
                { title: "온라인 연계 영업", desc: "본사 플랫폼 및 온라인을 통해 접수된 지역별 설치/구매 수요 매칭" }
              ].map((item, idx) => (
                <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <h4 className="text-sm font-bold text-blue-700 mb-2">{item.title}</h4>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. 개설 절차 */}
        <section className="bg-white py-10">
          <div className="max-w-xl mx-auto px-5 space-y-6">
            <h3 className="text-lg font-bold text-gray-900 border-l-4 border-blue-600 pl-3 flex items-center">
              4. 개설 절차
            </h3>

            {/* Stepper Timeline */}
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { step: "STEP 01", text: "지원서 접수 및 상담 신청" },
                { step: "STEP 02", text: "본사 또는 총판 담당자 해피콜" },
                { step: "STEP 03", text: "본사 담당자 현장 방문/미팅" },
                { step: "STEP 04", text: "개설 조건 합의 및 계약 체결" },
                { step: "STEP 05", text: "공식 대리점 오픈 및 영업 개시" }
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col items-center text-center">
                  <div className="bg-blue-50 text-blue-700 text-[9px] sm:text-[10px] font-bold px-1.5 py-1 rounded mb-2 border border-blue-100 whitespace-nowrap">
                    {item.step}
                  </div>
                  <div className="text-[9px] sm:text-xs text-gray-700 font-medium leading-tight px-0.5">
                    {item.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6">
              <a
                href="#survey"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-center py-4 rounded-xl text-base sm:text-lg transition-colors shadow-md"
              >
                도어락 대리점 지원 설문 작성하기
              </a>
            </div>
          </div>
        </section>

        {/* Survey Form Section */}
        <section id="survey" className="bg-white py-12">
          <div className="max-w-xl mx-auto px-5">
            <div className="text-center mb-8">
              <div className="text-xs font-semibold text-amber-600 tracking-widest uppercase mb-2">Recruitment</div>
              <h2 className="text-2xl font-bold text-gray-900">도어락 대리점 지원 설문</h2>
              <p className="text-sm text-gray-500 mt-2">도어락 대리점 개설 지원을 위한 설문조사입니다.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* 1. 기본 정보 */}
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 bg-amber-500 text-black text-xs font-bold rounded-full flex items-center justify-center">1</div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">기본 정보</h3>
                </div>
                <div className="space-y-5">
                  <div data-error={errors.businessName}>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Q1. 업체명 / 상호 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.businessName}
                      onChange={e => handleFieldChange('businessName', e.target.value)}
                      placeholder="업체명을 입력해 주세요"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                    />
                    {errors.businessName && <p className="text-red-500 text-xs mt-1">{errors.businessName}</p>}
                  </div>

                  <div data-error={errors.contactName}>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Q2. 성함 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.contactName}
                      onChange={e => handleFieldChange('contactName', e.target.value)}
                      placeholder="성함을 입력해 주세요"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                    />
                    {errors.contactName && <p className="text-red-500 text-xs mt-1">{errors.contactName}</p>}
                  </div>

                  <div data-error={errors.contactPosition}>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Q3. 직책 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.contactPosition}
                      onChange={e => handleFieldChange('contactPosition', e.target.value)}
                      placeholder="직책을 입력해 주세요 (예: 사장, 실장, 기사)"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                    />
                    {errors.contactPosition && <p className="text-red-500 text-xs mt-1">{errors.contactPosition}</p>}
                  </div>

                  <div data-error={errors.contactPhone}>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Q4. 연락처 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={form.contactPhone}
                      onChange={e => handleFieldChange('contactPhone', e.target.value)}
                      placeholder="010-0000-0000"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                    />
                    {errors.contactPhone && <p className="text-red-500 text-xs mt-1">{errors.contactPhone}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">이메일 (선택)</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => handleFieldChange('email', e.target.value)}
                      placeholder="example@company.com"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* 2. 사업 현황 */}
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 bg-amber-500 text-black text-xs font-bold rounded-full flex items-center justify-center">2</div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">사업 현황</h3>
                </div>
                <div className="space-y-5">
                  <div data-error={errors.businessAddress}>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Q5. 사업장 주소 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={form.businessZipcode}
                        readOnly
                        placeholder="우편번호"
                        className="w-24 border-2 border-gray-200 rounded-xl px-3 py-3 text-sm bg-gray-50 text-gray-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={openPostcode}
                        className="px-4 py-3 bg-amber-500 text-black text-xs sm:text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors whitespace-nowrap"
                      >
                        우편번호 검색
                      </button>
                    </div>
                    <input
                      type="text"
                      value={form.businessAddress}
                      readOnly
                      placeholder="주소 검색 버튼을 눌러 주세요"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-600 mb-2 focus:outline-none"
                    />
                    {errors.businessAddress && <p className="text-red-500 text-xs mt-1 mb-2">{errors.businessAddress}</p>}
                    <input
                      id="businessAddressDetail"
                      type="text"
                      value={form.businessAddressDetail}
                      onChange={e => handleFieldChange('businessAddressDetail', e.target.value)}
                      placeholder="상세 주소 입력 (건물명, 층, 호수 등)"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Q6. 도어락 판매 경력 <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { value: "under1", label: "1년 미만" },
                        { value: "1to3", label: "1~3년" },
                        { value: "3to5", label: "3~5년" },
                        { value: "5to10", label: "5~10년" },
                        { value: "over10", label: "10년 이상" }
                      ].map(opt => (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            form.salesExperience === opt.value
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="salesExperience"
                            value={opt.value}
                            checked={form.salesExperience === opt.value}
                            onChange={() => handleFieldChange('salesExperience', opt.value)}
                            className="w-4 h-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Q6-1. 도어락 설치 경력 <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { value: "under1", label: "1년 미만" },
                        { value: "1to3", label: "1~3년" },
                        { value: "3to5", label: "3~5년" },
                        { value: "5to10", label: "5~10년" },
                        { value: "over10", label: "10년 이상" }
                      ].map(opt => (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            form.installationExperience === opt.value
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="installationExperience"
                            value={opt.value}
                            checked={form.installationExperience === opt.value}
                            onChange={() => handleFieldChange('installationExperience', opt.value)}
                            className="w-4 h-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Q7. 2025년 연간 도어락 판매 대수 <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { value: "under100", label: "100대 미만" },
                        { value: "100to300", label: "100~300대" },
                        { value: "300to500", label: "300~500대" },
                        { value: "500to1000", label: "500~1,000대" },
                        { value: "over1000", label: "1,000대 이상" }
                      ].map(opt => (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            form.annualSalesVolume === opt.value
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="annualSalesVolume"
                            value={opt.value}
                            checked={form.annualSalesVolume === opt.value}
                            onChange={() => handleFieldChange('annualSalesVolume', opt.value)}
                            className="w-4 h-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Q8. 주요 판매 대상 <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { value: "enduser", label: "일반 소비자 (개인 고객 직접 판매)" },
                        { value: "b2b", label: "소매/재판매 (업체 납품)" },
                        { value: "both", label: "둘 다 병행" }
                      ].map(opt => (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            form.salesTarget === opt.value
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="salesTarget"
                            value={opt.value}
                            checked={form.salesTarget === opt.value}
                            onChange={() => handleFieldChange('salesTarget', opt.value)}
                            className="w-4 h-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* 3. 설치 운영 역량 */}
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 bg-amber-500 text-black text-xs font-bold rounded-full flex items-center justify-center">3</div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">설치 운영 역량</h3>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Q9. 설치 기사 운영 방식 <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { value: "own_team", label: "자체 설치팀 운영" },
                        { value: "outsource", label: "외주(협력기사) 활용" },
                        { value: "mixed", label: "혼합 운영" }
                      ].map(opt => (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            form.installationMethod === opt.value
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="installationMethod"
                            value={opt.value}
                            checked={form.installationMethod === opt.value}
                            onChange={() => handleFieldChange('installationMethod', opt.value)}
                            className="w-4 h-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Q10. 설치 기사 인원 <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { value: "none", label: "없음" },
                        { value: "1to2", label: "1~2명" },
                        { value: "3to5", label: "3~5명" },
                        { value: "6to10", label: "6~10명" },
                        { value: "over10", label: "10명 이상" }
                      ].map(opt => (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            form.installationStaff === opt.value
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="installationStaff"
                            value={opt.value}
                            checked={form.installationStaff === opt.value}
                            onChange={() => handleFieldChange('installationStaff', opt.value)}
                            className="w-4 h-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* 4. 사업 확장 가능성 */}
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 bg-amber-500 text-black text-xs font-bold rounded-full flex items-center justify-center">4</div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">사업 확장 가능성</h3>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Q11. 도어락 외 IoT/설치형 제품 사업 확대 의향 <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { value: "already", label: "이미 진행 중" },
                        { value: "reviewing", label: "검토 중" },
                        { value: "interested", label: "관심 있음" },
                        { value: "none", label: "없음" }
                      ].map(opt => (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            form.iotExpansionIntent === opt.value
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="iotExpansionIntent"
                            value={opt.value}
                            checked={form.iotExpansionIntent === opt.value}
                            onChange={() => handleFieldChange('iotExpansionIntent', opt.value)}
                            className="w-4 h-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* 5. 지원 목적 */}
              <div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 bg-amber-500 text-black text-xs font-bold rounded-full flex items-center justify-center">5</div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">지원 목적</h3>
                </div>
                <div className="space-y-5">
                  <div data-error={errors.supportPurpose}>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Q12. 도어락 대리점 지원 사유 / 기대 사항 <span className="text-red-500">*</span> <span className="text-xs text-gray-400 font-normal">(복수 선택 가능)</span>
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {PURPOSE_OPTIONS.map(opt => (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            form.supportPurpose.includes(opt.value)
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.supportPurpose.includes(opt.value)}
                            onChange={() => toggleCheckbox('supportPurpose', opt.value)}
                            className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                    {errors.supportPurpose && <p className="text-red-500 text-xs mt-1">{errors.supportPurpose}</p>}
                    
                    {form.supportPurpose.includes('other') && (
                      <textarea
                        value={form.supportPurposeOther}
                        onChange={e => handleFieldChange('supportPurposeOther', e.target.value)}
                        placeholder="기타 지원 사유를 입력해 주세요"
                        rows={2}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:outline-none transition-colors mt-2 resize-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2 font-bold">
                      관심 제품 <span className="text-xs text-gray-400 font-normal">(복수 선택 가능)</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {PRODUCT_OPTIONS.map(opt => (
                        <label
                          key={opt.value}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            form.interestedProducts.includes(opt.value)
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.interestedProducts.includes(opt.value)}
                            onChange={() => toggleCheckbox('interestedProducts', opt.value)}
                            className="sr-only"
                          />
                          <img src={opt.img} alt={opt.label} className="w-full aspect-square object-contain" />
                          <span className={`text-xs font-bold ${
                            form.interestedProducts.includes(opt.value) ? 'text-amber-700' : 'text-gray-700'
                          }`}>
                            {opt.value}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      기타 문의사항 <span className="text-xs text-gray-400 font-normal">(선택)</span>
                    </label>
                    <textarea
                      value={form.additionalInquiry}
                      onChange={e => handleFieldChange('additionalInquiry', e.target.value)}
                      placeholder="궁금하신 점이나 요청 사항을 자유롭게 입력해 주세요."
                      rows={3}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold py-4 rounded-xl text-base sm:text-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? '제출 중...' : '도어락 대리점 지원 설문 제출하기'}
              </button>
            </form>
          </div>
        </section>

        {/* Footer Contacts Section */}
        <section className="bg-gray-50 py-12 border-t border-gray-100">
          <div className="max-w-xl mx-auto px-5">
            <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 space-y-5 text-sm shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                <span className="font-bold text-gray-400 w-24 flex-shrink-0">접수 기간</span>
                <span className="font-semibold text-gray-200">상시 모집</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-start gap-2 pt-2 border-t border-gray-800">
                <span className="font-bold text-gray-400 w-24 flex-shrink-0">문의</span>
                <div className="space-y-1.5 text-gray-200">
                  <p>본사 담당자 김시열 : <a href="tel:010-9961-4937" className="hover:text-blue-400 hover:underline">010-9961-4937</a></p>
                  <p>총판 담당자 경기열쇠 김동수 : <a href="tel:010-2245-2222" className="hover:text-blue-400 hover:underline">010-2245-2222</a></p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-start gap-2 pt-2 border-t border-gray-800">
                <span className="font-bold text-gray-400 w-24 flex-shrink-0">이메일</span>
                <span><a href="mailto:partner@aqara.co.kr" className="hover:text-blue-400 hover:underline text-gray-200">partner@aqara.co.kr</a></span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-start gap-2 pt-2 border-t border-gray-800">
                <span className="font-bold text-gray-400 w-24 flex-shrink-0">홈페이지</span>
                <span><a href="https://www.aqara.co.kr" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 hover:underline text-gray-200">www.aqara.co.kr</a></span>
              </div>
            </div>
            
            <div className="text-center mt-8 space-y-8">
              <p className="text-blue-600 font-bold text-sm sm:text-base px-2">
                아카라의 차별화된 IoT 생태계와 함께 새로운 비즈니스 기회를 잡으세요!
              </p>
              <p className="text-xs text-gray-400">
                &copy; 2026 Aqara Life. All rights reserved.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
