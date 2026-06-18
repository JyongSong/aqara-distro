import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 1. GET: 가입 페이지에서 survey_id로 승인된 신청서 데이터를 조회 (공개 API)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: survey, error } = await adminClient
      .from('partner_surveys')
      .select('status, business_name, contact_name, contact_phone, business_zipcode, business_address, business_address_detail')
      .eq('id', id)
      .single()

    if (error || !survey) {
      return NextResponse.json({ error: '신청서를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 승인(approved) 상태인 건에 한해서만 정보 조회를 허용함 (이미 가입된 건은 registered로 변경되어 제외됨)
    if (survey.status !== 'approved') {
      return NextResponse.json({ error: '가입 가능한 상태의 신청서가 아닙니다.' }, { status: 400 })
    }

    return NextResponse.json({
      business_name: survey.business_name,
      contact_name: survey.contact_name,
      contact_phone: survey.contact_phone,
      business_zipcode: survey.business_zipcode,
      business_address: survey.business_address,
      business_address_detail: survey.business_address_detail,
    }, { status: 200 })
  } catch (error) {
    console.error('[partner-invite GET] Error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 2. POST: 공개 지원서(설문) 제출 처리
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      businessName,
      contactName,
      contactPosition,
      contactPhone,
      email,
      businessZipcode,
      businessAddress,
      businessAddressDetail,
      salesExperience,
      installationExperience,
      annualSalesVolume,
      salesTarget,
      installationMethod,
      installationStaff,
      iotExpansionIntent,
      supportPurpose,
      supportPurposeOther,
      interestedProducts,
      additionalInquiry
    } = body

    // 필수 필드 유효성 검사
    if (
      !businessName ||
      !contactName ||
      !contactPosition ||
      !contactPhone ||
      !businessZipcode ||
      !businessAddress ||
      !salesExperience ||
      !installationExperience ||
      !annualSalesVolume ||
      !salesTarget ||
      !installationMethod ||
      !installationStaff ||
      !iotExpansionIntent ||
      !supportPurpose ||
      supportPurpose.length === 0
    ) {
      return NextResponse.json({ error: '필수 항목들을 모두 입력해 주세요.' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 연락처 중복 여부 확인
    const { data: existing } = await adminClient
      .from('partner_surveys')
      .select('id')
      .eq('contact_phone', contactPhone.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: '이미 동일한 연락처로 신청이 완료되었습니다.' }, { status: 409 })
    }

    // 데이터 삽입
    const { error: insertError } = await adminClient
      .from('partner_surveys')
      .insert({
        business_name: businessName.trim(),
        contact_name: contactName.trim(),
        contact_position: contactPosition.trim(),
        contact_phone: contactPhone.trim(),
        email: email?.trim() || null,
        business_zipcode: businessZipcode,
        business_address: businessAddress,
        business_address_detail: businessAddressDetail?.trim() || null,
        sales_experience: salesExperience,
        installation_experience: installationExperience,
        annual_sales_volume: annualSalesVolume,
        sales_target: salesTarget,
        installation_method: installationMethod,
        installation_staff: installationStaff,
        iot_expansion_intent: iotExpansionIntent,
        support_purpose: supportPurpose,
        support_purpose_other: supportPurposeOther?.trim() || null,
        interested_products: interestedProducts || [],
        additional_inquiry: additionalInquiry?.trim() || null,
      })

    if (insertError) {
      console.error('[partner-invite POST] DB Insert Error:', insertError)
      if (insertError.code === '23505') { // Postgres UNIQUE constraint violation code
        return NextResponse.json({ error: '이미 등록된 연락처입니다.' }, { status: 409 })
      }
      return NextResponse.json({ error: '신청서 저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[partner-invite POST] Server Error:', error)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
