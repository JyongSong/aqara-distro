import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '소매점 발주 매뉴얼 · Aqara Distro',
  description: 'Aqara Distro 소매점용 빠른 시작 매뉴얼 — 회원가입부터 발주 요청, 수령 확인, 거래명세서 출력까지',
}

// 로그인 없이 열람 가능한 공개 매뉴얼 페이지.
// 매뉴얼 본문은 자체 스타일을 가진 정적 문서(public/open/manual.html)이므로,
// 앱 스타일과 충돌하지 않도록 전체 화면 iframe 으로 임베드한다.
export default function OpenManualPage() {
  return (
    <iframe
      src="/open/manual.html"
      title="소매점 발주 매뉴얼"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 'none' }}
    />
  )
}
