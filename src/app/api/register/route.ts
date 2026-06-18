import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DISTRIBUTOR_CODE_MAP: Record<string, string> = {
  '0001': '경기열쇠상사',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, company_name, contact_name, phone, post_code, address, distributor_code, survey_id } = body

    // Validate required fields
    if (!email || !password || !company_name || !contact_name || !phone || !address) {
      return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: '유효한 이메일 주소를 입력해주세요.' }, { status: 400 })
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // If survey_id is provided, verify it first
    if (survey_id) {
      const { data: survey, error: surveyError } = await adminClient
        .from('partner_surveys')
        .select('status')
        .eq('id', survey_id)
        .single()

      if (surveyError || !survey) {
        return NextResponse.json({ error: '신청서를 찾을 수 없습니다.' }, { status: 404 })
      }

      if (survey.status !== 'approved') {
        return NextResponse.json({ error: '가입 가능한 상태의 신청서가 아닙니다.' }, { status: 400 })
      }
    }

    // Resolve distributor_id from code
    let distributor_id: string | null = null
    if (distributor_code && DISTRIBUTOR_CODE_MAP[distributor_code]) {
      const companyName = DISTRIBUTOR_CODE_MAP[distributor_code]
      const { data: distProfile } = await adminClient
        .from('users_profile')
        .select('id')
        .eq('role', 'distributor')
        .eq('company_name', companyName)
        .single()
      if (distProfile) {
        distributor_id = distProfile.id
      }
    }

    // Create auth user (email_confirm: true skips email verification)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        return NextResponse.json({ error: '이미 가입된 이메일 주소입니다.' }, { status: 409 })
      }
      return NextResponse.json({ error: '계정 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: '계정 생성에 실패했습니다.' }, { status: 500 })
    }

    // Create user profile with retailer role
    const { error: profileError } = await adminClient
      .from('users_profile')
      .insert({
        id: authData.user.id,
        role: 'retailer',
        status: 'active',
        company_name,
        contact_name,
        phone,
        post_code: post_code || null,
        address,
        distributor_id,
      })

    if (profileError) {
      // Rollback: delete the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: '프로필 생성에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
    }

    // If survey_id is provided, update partner_surveys
    if (survey_id) {
      const { error: surveyUpdateError } = await adminClient
        .from('partner_surveys')
        .update({
          status: 'registered',
          registered_user_id: authData.user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', survey_id)
        .eq('status', 'approved')

      if (surveyUpdateError) {
        console.error('[register POST] partner_surveys update error:', surveyUpdateError)
        // Rollback: delete profile and auth user if survey update fails
        await adminClient.from('users_profile').delete().eq('id', authData.user.id)
        await adminClient.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json({ error: '대리점 지원 정보 업데이트에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[register POST] Server Error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
