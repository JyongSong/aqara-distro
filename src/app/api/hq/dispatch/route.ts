import { NextRequest, NextResponse } from 'next/server'
import { fetchDispatchRows, assignDispatch } from '@/lib/dispatch'

export async function GET(req: NextRequest) {
  const dueDate = new URL(req.url).searchParams.get('dueDate')
  if (!dueDate || !/^\d{8}$/.test(dueDate)) {
    return NextResponse.json({ error: 'dueDate (YYYYMMDD) required' }, { status: 400 })
  }

  try {
    const rows = await fetchDispatchRows(dueDate)
    const data = assignDispatch(rows)
    return NextResponse.json({ data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'ERP 연결 실패'
    console.error('[hq/dispatch]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
