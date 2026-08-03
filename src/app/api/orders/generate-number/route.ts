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

  const { count, error } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .like('order_number', `${datePrefix}%`)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const seq = ((count ?? 0) + 1).toString().padStart(4, '0')
  return NextResponse.json({ order_number: `${datePrefix}${seq}` })
}
