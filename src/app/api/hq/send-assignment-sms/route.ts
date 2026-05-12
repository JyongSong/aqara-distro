import { sendSms } from '@/lib/sms'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const SHEET_NAME = '배정결과'

type Row = {
  '지점명'?: unknown
  '기사님 연락처'?: unknown
  '연락처'?: unknown
}

type Result = {
  row: number
  branch: string
  to: string
  ok: boolean
  error?: string
}

export async function POST(request: NextRequest) {
  // HQ 권한 확인
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users_profile')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'hq') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 파일 파싱
  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[SHEET_NAME]
  if (!ws) {
    return NextResponse.json(
      { error: `시트 "${SHEET_NAME}" 를 찾을 수 없습니다` },
      { status: 400 }
    )
  }

  const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: '' })

  const results: Result[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const branch       = String(row['지점명'] ?? '').trim()
    const masterPhone  = String(row['기사님 연락처'] ?? '').trim()
    const to           = String(row['연락처'] ?? '').trim()
    const rowNumber    = i + 2  // 헤더 포함 엑셀 행 번호

    if (!to || !branch || !masterPhone) {
      results.push({
        row: rowNumber,
        branch,
        to,
        ok: false,
        error: '필수 필드 누락 (지점명/기사님 연락처/연락처)',
      })
      continue
    }

    const text =
      `아카라라이프 설치 배정 완료\n` +
      `${branch} ${masterPhone}\n` +
      `기사님 연락처 입니다`

    try {
      await sendSms(to, text)
      results.push({ row: rowNumber, branch, to, ok: true })
    } catch (e) {
      results.push({
        row: rowNumber,
        branch,
        to,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return NextResponse.json({
    total: rows.length,
    sent: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  })
}
