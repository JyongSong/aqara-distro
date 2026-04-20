import { SolapiMessageService } from 'solapi'

let _service: SolapiMessageService | null = null

function getService(): SolapiMessageService | null {
  if (_service) return _service
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  if (!apiKey || !apiSecret) return null
  _service = new SolapiMessageService(apiKey, apiSecret)
  return _service
}

export async function sendSms(
  to: string | null | undefined,
  text: string
): Promise<void> {
  if (!to) return
  const from = process.env.SOLAPI_SENDER
  if (!from) return

  const service = getService()
  if (!service) return

  // 번호 정규화: 숫자만 남김
  const normalized = to.replace(/[^0-9]/g, '')
  if (!normalized) return

  try {
    await service.send({ to: normalized, from, text })
  } catch (e) {
    console.error('[SMS] 발송 실패:', e)
  }
}
