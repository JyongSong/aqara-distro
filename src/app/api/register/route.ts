import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DISTRIBUTOR_CODE_MAP: Record<string, string> = {
  '0001': '경기열쇠상사',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, company_name, contact_name, phone, post_code, address, distributor_code } = body

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

    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
