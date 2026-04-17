import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids')
  if (!idsParam) return NextResponse.json({ error: 'ids required' }, { status: 400 })

  const orderIds = idsParam.split(',').filter(Boolean)
  if (orderIds.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: orders } = await supabase
    .from('orders')
    .select('*, retailer:users_profile!retailer_id(company_name, phone, post_code, address)')
    .in('id', orderIds)
    .order('created_at', { ascending: false })

  if (!orders || orders.length === 0) {
    return NextResponse.json({ error: 'orders not found' }, { status: 404 })
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('*, product:products(name, erp_code)')
    .in('order_id', orderIds)

  if (!items) return NextResponse.json({ error: 'items not found' }, { status: 404 })

  // 헤더 행
  const header = ['No.', '주문번호', '상품명', '모델명', '수량', '공급단가(VAT포함)', '주문금액(Vat포함)', '수취인명', '전화(휴대폰)', '우편번호', '주소']

  const rows: (string | number)[][] = []
  let rowNo = 1

  for (const order of orders) {
    const retailer = order.retailer as { company_name: string; phone: string | null; post_code: string | null; address: string | null }
    const orderItems = items.filter(item => item.order_id === order.id)

    for (const item of orderItems) {
      const hqUnitPrice = item.hq_unit_price || 0
      const unitPriceVat = Math.round(hqUnitPrice * 1.1)
      const totalVat = unitPriceVat * item.quantity
      rows.push([
        rowNo++,
        order.order_number,
        item.product?.name || '',
        item.product?.erp_code || '',
        item.quantity,
        unitPriceVat,
        totalVat,
        retailer.company_name,
        retailer.phone || '',
        retailer.post_code || '',
        order.shipping_address || retailer.address || '',
      ])
    }
  }

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])

  ws['!cols'] = [
    { wch: 5 },
    { wch: 20 },
    { wch: 25 },
    { wch: 18 },
    { wch: 6 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 15 },
    { wch: 8 },
    { wch: 40 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const filename = `주문서_${dateStr}_${orders.length}건.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
