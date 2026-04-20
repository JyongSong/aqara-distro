import { SolapiMessageService } from 'solapi'
import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey    = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  const from      = process.env.SOLAPI_SENDER
  const to        = process.env.HQ_NOTIFY_PHONE

  // 환경변수 확인
  if (!apiKey || !apiSecret || !from || !to) {
    return NextResponse.json({
      ok: false,
      error: 'missing env vars',
      apiKey: !!apiKey,
      apiSecret: !!apiSecret,
      from: !!from,
      to: !!to,
    })
  }

  try {
    const service = new SolapiMessageService(apiKey, apiSecret)
    const result = await service.send({
      to: to.replace(/[^0-9]/g, ''),
      from: from.replace(/[^0-9]/g, ''),
      text: '[Aqara] SMS 테스트 메시지입니다.',
    })
    return NextResponse.json({ ok: true, result })
  } catch (e: unknown) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      detail: e,
    })
  }
}
