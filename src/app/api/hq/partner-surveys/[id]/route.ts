import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/sms'

const APP_URL = 'https://aqara-distro.vercel.app'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: '유효한 action(approve, reject)이 필요합니다.' }, { status: 400 })
    }

    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 1. 세션 및 HQ 권한 체크
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

    // 2. 해당 신청서 조회
    const { data: survey, error: fetchError } = await adminClient
      .from('partner_surveys')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !survey) {
      return NextResponse.json({ error: '신청서를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 3. 상태에 따른 비즈니스 로직 분기
    if (action === 'approve') {
      if (survey.status !== 'pending') {
        return NextResponse.json({ error: '대기(pending) 상태인 신청서만 승인할 수 있습니다.' }, { status: 400 })
      }

      // 상태를 'approved'로 변경
      const { error: updateError } = await adminClient
        .from('partner_surveys')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (updateError) {
        console.error('[hq/partner-surveys PATCH] Approve update error:', updateError)
        return NextResponse.json({ error: '신청서 승인 처리에 실패했습니다.' }, { status: 500 })
      }

      // 전용 회원가입 링크 생성 및 안내 SMS 발송
      const inviteLink = `${APP_URL}/register?survey_id=${id}`
      const smsMessage = `[Aqara] 대리점 파트너 지원 승인 안내\n\n안녕하세요, Aqara 대리점 파트너 개설 지원이 승인되었습니다. 아래 전용 가입 링크를 클릭하여 회원가입을 완료해 주세요.\n\n가입 링크: ${inviteLink}\n\n감사합니다.`
      
      try {
        await sendSms(survey.contact_phone, smsMessage)
        console.log(`[hq/partner-surveys PATCH] SMS sent successfully to ${survey.contact_phone}`)
      } catch (smsErr) {
        console.error('[hq/partner-surveys PATCH] Failed to send SMS:', smsErr)
        // SMS 발송 실패하더라도 DB 승인 상태는 완료되었으므로 일단 성공으로 응답하되 경고 로그를 남깁니다.
      }

      return NextResponse.json({ success: true, status: 'approved' }, { status: 200 })

    } else if (action === 'reject') {
      if (survey.status !== 'pending' && survey.status !== 'approved') {
        return NextResponse.json({ error: '대기(pending) 또는 승인(approved) 상태인 신청서만 거절할 수 있습니다.' }, { status: 400 })
      }

      const { error: updateError } = await adminClient
        .from('partner_surveys')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (updateError) {
        console.error('[hq/partner-surveys PATCH] Reject update error:', updateError)
        return NextResponse.json({ error: '신청서 거절 처리에 실패했습니다.' }, { status: 500 })
      }

      return NextResponse.json({ success: true, status: 'rejected' }, { status: 200 })
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  } catch (error) {
    console.error('[hq/partner-surveys PATCH] Server Error:', error)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
