import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { REPORT_RESOURCES, isAuthorized, parseReportQuery, toCsv } from '@/lib/report'

// 외부 분석용 읽기 전용 raw data API
// GET /api/report/{stores|orders|order-items|products}
// 인증: Authorization: Bearer <REPORT_API_KEY>
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  if (!isAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { resource } = await params
  const fetchResource = Object.hasOwn(REPORT_RESOURCES, resource) ? REPORT_RESOURCES[resource] : null
  if (!fetchResource) {
    return NextResponse.json(
      { error: `Unknown resource. Available: ${Object.keys(REPORT_RESOURCES).join(', ')}` },
      { status: 404 }
    )
  }

  const { query, error } = parseReportQuery(request.nextUrl.searchParams)
  if (error !== null) {
    return NextResponse.json({ error }, { status: 400 })
  }

  try {
    const { rows, total } = await fetchResource(createAdminClient(), query)
    const headers = { 'Cache-Control': 'no-store', 'X-Total-Count': String(total) }

    if (query.format === 'csv') {
      return new NextResponse(toCsv(rows), {
        headers: {
          ...headers,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${resource}.csv"`,
        },
      })
    }

    return NextResponse.json(
      { resource, total, page: query.page, page_size: query.pageSize, data: rows },
      { headers }
    )
  } catch (e) {
    console.error(`[report/${resource}] Error:`, e)
    return NextResponse.json({ error: '데이터 조회에 실패했습니다.' }, { status: 500 })
  }
}
