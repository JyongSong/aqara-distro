'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    phone: '',
    email: '',
    zipcode: '',
    address: '',
    address_detail: '',
    password: '',
    confirm_password: '',
    distributor_code: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const openPostcode = () => {
    if (typeof window === 'undefined' || !window.daum?.Postcode) return
    new window.daum.Postcode({
      oncomplete: (data: DaumPostcodeData) => {
        setForm(prev => ({
          ...prev,
          zipcode: data.zonecode,
          address: data.roadAddress || data.jibunAddress,
          address_detail: '',
        }))
      },
    }).open()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.company_name.trim()) {
      setError('업체명을 입력해주세요.')
      return
    }
    if (!form.contact_name.trim()) {
      setError('담당자 이름을 입력해주세요.')
      return
    }
    if (!form.phone.trim()) {
      setError('연락처를 입력해주세요.')
      return
    }
    if (!form.email.trim()) {
      setError('이메일을 입력해주세요.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('올바른 이메일 주소를 입력해주세요.')
      return
    }
    if (!form.address) {
      setError('주소 검색 버튼을 눌러 납품 주소를 입력해주세요.')
      return
    }
    if (!form.password) {
      setError('비밀번호를 입력해주세요.')
      return
    }
    if (form.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (form.password !== form.confirm_password) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)

    const fullAddress = [form.address, form.address_detail]
      .filter(Boolean)
      .join(' ')

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        company_name: form.company_name,
        contact_name: form.contact_name,
        phone: form.phone,
        post_code: form.zipcode || null,
        address: fullAddress,
        distributor_code: form.distributor_code.trim() || null,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || '가입에 실패했습니다.')
      setLoading(false)
      return
    }

    router.push('/login?registered=1')
  }

  return (
    <>
      <Script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" />
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Aqara Distro</h1>
              <p className="text-sm text-gray-500 mt-1">소매점 회원가입</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* 업체명 */}
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-1.5">
                  업체명 <span className="text-red-500">*</span>
                </label>
                <input
                  id="company_name"
                  name="company_name"
                  type="text"
                  value={form.company_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="예: 홍길동 스마트홈"
                />
              </div>

              {/* 담당자 이름 */}
              <div>
                <label htmlFor="contact_name" className="block text-sm font-medium text-gray-700 mb-1.5">
                  담당자 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  id="contact_name"
                  name="contact_name"
                  type="text"
                  value={form.contact_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="예: 홍길동"
                />
              </div>

              {/* 연락처 */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="예: 010-1234-5678"
                />
              </div>

              {/* 이메일 */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  이메일 (로그인 ID) <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="name@company.com"
                />
              </div>

              {/* 납품 받는 주소 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  납품 받는 주소 <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-400 mb-2">상품이 납품되는 실제 주소를 입력해주세요.</p>

                {/* 우편번호 + 검색 버튼 */}
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={form.zipcode}
                    readOnly
                    placeholder="우편번호"
                    className="w-28 px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={openPostcode}
                    className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    우편번호 조회
                  </button>
                </div>

                {/* 도로명 주소 */}
                <input
                  type="text"
                  value={form.address}
                  readOnly
                  placeholder="도로명 주소 (위 버튼으로 검색)"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-600 mb-2"
                />

                {/* 상세 주소 */}
                <input
                  name="address_detail"
                  type="text"
                  value={form.address_detail}
                  onChange={handleChange}
                  placeholder="상세 주소 (동, 호수, 층 등)"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              {/* 총판 코드 */}
              <div>
                <label htmlFor="distributor_code" className="block text-sm font-medium text-gray-700 mb-1.5">
                  총판 코드 <span className="text-gray-400 text-xs font-normal">(선택)</span>
                </label>
                <input
                  id="distributor_code"
                  name="distributor_code"
                  type="text"
                  value={form.distributor_code}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="총판에서 받은 코드 입력 (없으면 비워두세요)"
                />
              </div>

              {/* 비밀번호 */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  비밀번호 <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="8자 이상"
                />
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  비밀번호 확인 <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="비밀번호를 다시 입력하세요"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
              >
                {loading ? '가입 중...' : '가입하기'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-5">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                로그인
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            &copy; 2026 Aqara Life. All rights reserved.
          </p>
        </div>
      </div>
    </>
  )
}
