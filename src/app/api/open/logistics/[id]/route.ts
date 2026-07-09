import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

interface PatchBody {
  box_ids: {
    K100?: string[]
    L100?: string[]
  }
}

function validateBoxId(type: 'K100' | 'L100', value: string): string | null {
  if (type === 'K100') {
    if (value.length !== 13) return `K100 박스 ID는 13자리여야 합니다: ${value}`
    if (!value.startsWith('AK')) return `K100 박스 ID는 'AK'로 시작해야 합니다: ${value}`
    if (!value.endsWith('TAK')) return `K100 박스 ID는 'TAK'으로 끝나야 합니다: ${value}`
  }
  if (type === 'L100') {
    if (value.length !== 22) return `L100 박스 ID는 22자리여야 합니다: ${value}`
    if (!value.startsWith('LUMI')) return `L100 박스 ID는 'LUMI'로 시작해야 합니다: ${value}`
    if (!value.endsWith('LS')) return `L100 박스 ID는 'LS'로 끝나야 합니다: ${value}`
  }
  return null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  let body: PatchBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!body.box_ids || typeof body.box_ids !== 'object') {
    return NextResponse.json({ error: 'box_ids required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. 물류 설정 조회
  const { data: settingsData } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'logistics_sn_items')
    .single()
  const activeItems: string[] = (settingsData?.value as string[]) ?? ['K100', 'L100']

  // 서버사이드 박스 ID 형식 검증 및 정제 (설정에서 활성화된 품목만 검증 및 저장)
  const cleanedBoxIds: { K100?: string[]; L100?: string[] } = {}

  if (activeItems.includes('K100')) {
    const k100Ids = body.box_ids.K100 ?? []
    for (const id of k100Ids) {
      const err = validateBoxId('K100', id)
      if (err) return NextResponse.json({ error: err }, { status: 400 })
    }
    cleanedBoxIds.K100 = k100Ids
  }

  if (activeItems.includes('L100')) {
    const l100Ids = body.box_ids.L100 ?? []
    for (const id of l100Ids) {
      const err = validateBoxId('L100', id)
      if (err) return NextResponse.json({ error: err }, { status: 400 })
    }
    cleanedBoxIds.L100 = l100Ids
  }

  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'SHIPPED',
      shipped_at: new Date().toISOString(),
      box_ids: cleanedBoxIds,
    })
    .eq('id', id)
    .eq('status', 'PREPARING')
    .select('id, order_number, status, shipped_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Order not found or already shipped' },
      { status: 404 }
    )
  }

  return NextResponse.json(data)
}
