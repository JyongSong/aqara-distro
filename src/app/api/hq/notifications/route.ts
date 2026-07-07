import { sendSms } from '@/lib/sms'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

type Row = Record<string, unknown>

type Result = {
  row: number
  name: string
  to: string
  ok: boolean
  error?: string
}

export async function GET() {
  const senders = [
    process.env.SOLAPI_SENDER,
    process.env.SOLAPI_SENDER_2
  ].filter(Boolean) as string[]
  return NextResponse.json({ senders })
}

export async function POST(request: NextRequest) {
  // 1. HQ 권한 확인
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

  // 2. 파라미터 파싱
  const formData = await request.formData()
  const file = formData.get('file')
  const messageTemplate = String(formData.get('message') ?? '').trim()
  const senderNumber = String(formData.get('senderNumber') ?? '').trim() || undefined

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }
  if (!messageTemplate) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  // 3. 엑셀 파일 읽기
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return NextResponse.json({ error: '엑셀 파일에 시트가 존재하지 않습니다.' }, { status: 400 })
  }

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: '' })

  if (rows.length === 0) {
    return NextResponse.json({ error: '엑셀 파일에 데이터가 없습니다.' }, { status: 400 })
  }

  const results: Result[] = []

  // 4. 공지 발송 처리
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNumber = i + 2 // 헤더 포함 행 번호

    // 유연한 열 이름 매칭 (이름, 연락처)
    const nameKey = Object.keys(row).find(k => k.includes('이름') || k.includes('성명') || k.includes('이 름'))
    const phoneKey = Object.keys(row).find(k => k.includes('연락처') || k.includes('전화') || k.includes('휴대폰') || k.includes('번호'))

    const name = nameKey ? String(row[nameKey] ?? '').trim() : ''
    const to = phoneKey ? String(row[phoneKey] ?? '').trim() : ''

    if (!to) {
      results.push({
        row: rowNumber,
        name,
        to,
        ok: false,
        error: '수신 번호(연락처)가 비어있습니다.',
      })
      continue
    }

    // 치환문구 #{이름} 적용
    const text = messageTemplate.replace(/#{이름}/g, name || '고객')

    try {
      await sendSms(to, text, senderNumber)
      results.push({ row: rowNumber, name, to, ok: true })
    } catch (e) {
      results.push({
        row: rowNumber,
        name,
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
