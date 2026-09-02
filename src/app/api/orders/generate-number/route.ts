import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, ALL_ROLES } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const { error: authError } = await requireRole(ALL_ROLES)
  if (authError) return authError

  const supabase = createAdminClient()

  // 서울 시간 기준 날짜 (UTC+9)
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const y = now.getUTCFullYear().toString().slice(2)
  const m = (now.getUTCMonth() + 1).toString().padStart(2, '0')
  const d = now.getUTCDate().toString().padStart(2, '0')
  const datePrefix = `ORD-${y}${m}${d}-`

  // 가장 큰 기존 번호 + 1 (count 기반은 삭제/공백 시 기존 번호와 충돌하므로 사용하지 않는다)
  const { data: last, error } = await supabase
    .from('orders')
    .select('order_number')
    .like('order_number', `${datePrefix}%`)
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const lastSeq = last
    ? parseInt(last.order_number.slice(datePrefix.length), 10) || 0
    : 0
  const seq = (lastSeq + 1).toString().padStart(4, '0')
  return NextResponse.json({ order_number: `${datePrefix}${seq}` })
}
