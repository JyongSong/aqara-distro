import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import fs from 'fs/promises'
import path from 'path'
import { fetchDispatchRows, formatDueDate, DISPATCH_CONST } from '@/lib/dispatch'

export async function GET(req: NextRequest) {
  const dueDate = new URL(req.url).searchParams.get('dueDate')
  if (!dueDate || !/^\d{8}$/.test(dueDate)) {
    return NextResponse.json({ error: 'dueDate (YYYYMMDD) required' }, { status: 400 })
  }

  try {
    const rows = await fetchDispatchRows(dueDate)

    // 1) 템플릿 로드
    const templatePath = path.join(process.cwd(), 'public/templates/dispatch-template.xlsx')
    const templateBuf  = await fs.readFile(templatePath)
    const wb = XLSX.read(templateBuf, { type: 'buffer', cellStyles: true })
    const sheetName = wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]

    // 2) 데이터 행 채우기 (row 2 부터)
    const shipDate = formatDueDate(dueDate)
    rows.forEach((row, i) => {
      const r = i + 2  // Excel은 1-indexed, 1행은 헤더
      const set = (col: string, val: string | number) => {
        ws[`${col}${r}`] = { t: typeof val === 'number' ? 'n' : 's', v: val }
      }
      set('A', shipDate)                       // 출고일자
      // B 순번: 비워둠
      set('C', DISPATCH_CONST.거래처)
      set('D', DISPATCH_CONST.지점명)
      set('E', DISPATCH_CONST.창고)
      set('F', DISPATCH_CONST.담당자)
      set('G', DISPATCH_CONST.수리유형)
      set('H', row.customer_name || '')
      set('I', row.phone         || '')
      set('J', row.order_numbers || '')
      set('K', row.address       || '')
      set('L', DISPATCH_CONST.설치완료여부)
      // M 설치일자 / N 용역비 / O 담당기사 : 비워둠
      set('P', row.memo || '')
      // Q~V: 비워둠 (예시에 없음)
    })

    // 3) 시트 범위 갱신
    const lastRow = Math.max(rows.length + 1, 2)
    ws['!ref'] = `A1:V${lastRow}`

    // 4) 버퍼로 출력
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true })
    const filename = `기사배정_${dueDate}.xlsx`

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Excel 생성 실패'
    console.error('[hq/dispatch/export]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
