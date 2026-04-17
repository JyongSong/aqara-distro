import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('id')
  if (!orderId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: order } = await supabase
    .from('orders')
    .select('*, retailer:users_profile!retailer_id(company_name, phone, post_code, address)')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 })

  const { data: items } = await supabase
    .from('order_items')
    .select('*, product:products(name, erp_code)')
    .eq('order_id', orderId)

  if (!items) return NextResponse.json({ error: 'items not found' }, { status: 404 })

  const retailer = order.retailer as { company_name: string; phone: string | null; post_code: string | null; address: string | null }

  // 우편번호/주소 분리 (기존 데이터는 address 앞에 5자리 우편번호가 포함되어 있을 수 있음)
  function splitPostCode(raw: string | null): { postCode: string; address: string } {
    if (!raw) return { postCode: '', address: '' }
    const m = raw.match(/^(\d{5})\s+(.*)$/)
    if (m) return { postCode: m[1], address: m[2] }
    return { postCode: '', address: raw }
  }

  // 헤더 행
  const header = ['No.', '주문번호', '상품명', '모델명', '수량', '공급단가(VAT포함)', '주문금액(Vat포함)', '수취인명', '전화(휴대폰)', '우편번호', '주소']

  // 데이터 행
  const rows = items.map((item, i) => {
    const hqUnitPrice = item.hq_unit_price || 0
    const unitPriceVat = Math.round(hqUnitPrice * 1.1)
    const totalVat = unitPriceVat * item.quantity
    return [
      i + 1,
      order.order_number,
      item.product?.name || '',
      item.product?.erp_code || '',
      item.quantity,
      unitPriceVat,
      totalVat,
      retailer.company_name,
      retailer.phone || '',
      (() => {
        if (retailer.post_code) return retailer.post_code
        const raw = order.shipping_address || retailer.address || ''
        return splitPostCode(raw).postCode
      })(),
      (() => {
        const raw = order.shipping_address || retailer.address || ''
        if (retailer.post_code) return raw  // post_code 분리 저장된 신규 데이터
        return splitPostCode(raw).address   // 기존 데이터: 우편번호 제거
      })(),
    ]
  })

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])

  // 열 너비 설정
  ws['!cols'] = [
    { wch: 5 },   // No.
    { wch: 20 },  // 주문번호
    { wch: 25 },  // 상품명
    { wch: 18 },  // 모델명
    { wch: 6 },   // 수량
    { wch: 16 },  // 공급단가
    { wch: 16 },  // 주문금액
    { wch: 16 },  // 수취인명
    { wch: 15 },  // 전화
    { wch: 8 },   // 우편번호
    { wch: 40 },  // 주소
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `주문서_${order.order_number}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
