export async function sendSms(phone: string | null | undefined, text: string): Promise<void> {
  if (!phone) return
  const apiUrl = process.env.WARRANTY_API_URL
  const apiKey = process.env.WARRANTY_INTERNAL_KEY
  if (!apiUrl || !apiKey) return

  try {
    await fetch(`${apiUrl}/api/internal/sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': apiKey },
      body: JSON.stringify({ to: phone, text }),
    })
  } catch (e) {
    console.error('[SMS] 발송 실패:', e)
  }
}
