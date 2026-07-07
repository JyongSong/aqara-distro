import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  // Create workbook
  const wb = XLSX.utils.book_new()
  
  // Dummy data
  const data = [
    { '이름': '홍길동', '연락처': '010-1234-5678' },
    { '이름': '이몽룡', '연락처': '010-9876-5432' }
  ]
  
  const ws = XLSX.utils.json_to_sheet(data)
  
  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // 이름
    { wch: 20 }  // 연락처
  ]
  
  XLSX.utils.book_append_sheet(wb, ws, '공지대상')
  
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="notification_sample.xlsx"',
    }
  })
}
