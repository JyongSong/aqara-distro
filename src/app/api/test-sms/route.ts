import { sendSms } from '@/lib/sms'
import { NextResponse } from 'next/server'

export async function GET() {
  const hqPhone = process.env.HQ_NOTIFY_PHONE
  await sendSms(hqPhone, '[Aqara] SMS 테스트 메시지입니다.')
  return NextResponse.json({ ok: true, to: hqPhone })
}
