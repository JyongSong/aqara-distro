import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 1. 세션 체크 및 HQ 권한 검사
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 })
    }

    const { data: profile } = await adminClient
      .from('users_profile')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'hq') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    // 2. 전체 대리점 지원 설문 리스트 조회
    const { data: surveys, error } = await adminClient
      .from('partner_surveys')
      .select(`
        *,
        registered_user:users_profile!registered_user_id(company_name, phone)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[hq/partner-surveys GET] Error fetching list:', error)
      return NextResponse.json({ error: '데이터 조회에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json(surveys || [], { status: 200 })
  } catch (error) {
    console.error('[hq/partner-surveys GET] Server Error:', error)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
