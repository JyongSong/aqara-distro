import { createHash, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// 외부 분석용 읽기 전용 리포트 API (/api/report/*) 공용 로직.
// service role 로 RLS 를 우회하므로 반드시 isAuthorized() 통과 후에만 사용한다.

export const MAX_PAGE_SIZE = 1000

export type ReportRow = Record<string, unknown>

export type ReportQuery = {
  from: string | null // KST 기준 시작 시각 (ISO)
  to: string | null   // KST 기준 종료 시각 (ISO)
  page: number
  pageSize: number
  format: 'json' | 'csv'
}

type Page = { rows: ReportRow[]; total: number }

/** Authorization: Bearer <REPORT_API_KEY> 검사. 키 미설정 시 항상 거부. */
export function isAuthorized(header: string | null): boolean {
  const key = process.env.REPORT_API_KEY
  if (!key || !header) return false
  const digest = (v: string) => createHash('sha256').update(v).digest()
  return timingSafeEqual(digest(header), digest(`Bearer ${key}`))
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseReportQuery(
  params: URLSearchParams
): { query: ReportQuery; error: null } | { query: null; error: string } {
  const from = params.get('from')
  const to = params.get('to')
  for (const [name, value] of [['from', from], ['to', to]] as const) {
    if (value && (!DATE_RE.test(value) || Number.isNaN(Date.parse(value)))) {
      return { query: null, error: `${name} must be YYYY-MM-DD` }
    }
  }

  const page = Number(params.get('page') ?? 1)
  const pageSize = Number(params.get('page_size') ?? MAX_PAGE_SIZE)
  if (!Number.isInteger(page) || page < 1) {
    return { query: null, error: 'page must be an integer >= 1' }
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    return { query: null, error: `page_size must be an integer between 1 and ${MAX_PAGE_SIZE}` }
  }

  const format = params.get('format') ?? 'json'
  if (format !== 'json' && format !== 'csv') {
    return { query: null, error: 'format must be json or csv' }
  }

  return {
    query: {
      from: from ? `${from}T00:00:00+09:00` : null,
      to: to ? `${to}T23:59:59.999+09:00` : null,
      page,
      pageSize,
      format,
    },
    error: null,
  }
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Excel 에서 한글이 깨지지 않도록 BOM 을 붙인 CSV. */
export function toCsv(rows: ReportRow[]): string {
  if (rows.length === 0) return '﻿'
  const columns = Object.keys(rows[0])
  const lines = [
    columns.join(','),
    ...rows.map(row => columns.map(c => csvCell(row[c])).join(',')),
  ]
  return '﻿' + lines.join('\r\n') + '\r\n'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = any

async function fetchPage(builder: Builder, q: ReportQuery): Promise<{ data: Builder[]; total: number }> {
  const offset = (q.page - 1) * q.pageSize
  const { data, count, error } = await builder.range(offset, offset + q.pageSize - 1)
  // 마지막 페이지를 넘긴 요청(PGRST103)은 에러가 아니라 빈 페이지로 응답한다
  if (error?.code === 'PGRST103') {
    const { count: total, error: countError } = await builder.range(0, 0)
    if (countError) throw new Error(countError.message)
    return { data: [], total: total ?? 0 }
  }
  if (error) throw new Error(error.message)
  return { data: data ?? [], total: count ?? 0 }
}

type Option = { code: string; name: string }

function optionName(options: Option[] | null, code: string | null): string | null {
  if (!code) return null
  return options?.find(o => o.code === code)?.name ?? null
}

async function fetchStores(supabase: SupabaseClient, q: ReportQuery): Promise<Page> {
  const { data, total } = await fetchPage(
    supabase
      .from('users_profile')
      .select(
        `id, role, company_name, contact_name, phone, post_code, address, distributor_id,
         status, created_at, updated_at`,
        { count: 'exact' }
      )
      .in('role', ['retailer', 'distributor'])
      .order('created_at')
      .order('id'),
    q
  )

  // 자기 참조 FK 라 임베드 대신 총판명을 따로 조회한다
  const { data: distributors, error: distError } = await supabase
    .from('users_profile')
    .select('id, company_name')
    .eq('role', 'distributor')
  if (distError) throw new Error(distError.message)
  const distributorNames = new Map(distributors.map(d => [d.id, d.company_name]))

  // 이메일·마지막 로그인 시각은 auth.users 에만 있다
  const authUsers = new Map<string, { email?: string; last_sign_in_at?: string }>()
  for (let page = 1; ; page++) {
    const { data: list, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    list.users.forEach(u => authUsers.set(u.id, u))
    if (list.users.length < 1000) break
  }

  const rows = data.map(p => ({
    id: p.id,
    role: p.role,
    company_name: p.company_name,
    contact_name: p.contact_name,
    phone: p.phone,
    email: authUsers.get(p.id)?.email ?? null,
    post_code: p.post_code,
    address: p.address,
    distributor_id: p.distributor_id,
    distributor_name: distributorNames.get(p.distributor_id) ?? null,
    status: p.status,
    created_at: p.created_at,
    updated_at: p.updated_at,
    last_sign_in_at: authUsers.get(p.id)?.last_sign_in_at ?? null,
  }))
  return { rows, total }
}

async function fetchOrders(supabase: SupabaseClient, q: ReportQuery): Promise<Page> {
  let builder = supabase
    .from('orders')
    .select(
      `id, order_number, status, order_type, fulfillment_type,
       retailer_id, distributor_id, shipping_address, desired_date, note,
       retailer_total, hq_total, tracking_number, box_ids, quote_expires_at,
       submitted_at, approved_at, shipped_at, delivered_at, created_at, updated_at,
       retailer:users_profile!retailer_id(company_name),
       distributor:users_profile!distributor_id(company_name)`,
      { count: 'exact' }
    )
  if (q.from) builder = builder.gte('created_at', q.from)
  if (q.to) builder = builder.lte('created_at', q.to)

  const { data, total } = await fetchPage(builder.order('created_at').order('id'), q)

  const rows = data.map(o => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    order_type: o.order_type,
    fulfillment_type: o.fulfillment_type,
    retailer_id: o.retailer_id,
    retailer_name: o.retailer?.company_name ?? null,
    distributor_id: o.distributor_id,
    distributor_name: o.distributor?.company_name ?? null,
    shipping_address: o.shipping_address,
    desired_date: o.desired_date,
    note: o.note,
    retailer_total: o.retailer_total,
    hq_total: o.hq_total,
    tracking_number: o.tracking_number,
    box_ids: o.box_ids,
    quote_expires_at: o.quote_expires_at,
    submitted_at: o.submitted_at,
    approved_at: o.approved_at,
    shipped_at: o.shipped_at,
    delivered_at: o.delivered_at,
    created_at: o.created_at,
    updated_at: o.updated_at,
  }))
  return { rows, total }
}

async function fetchOrderItems(supabase: SupabaseClient, q: ReportQuery): Promise<Page> {
  let builder = supabase
    .from('order_items')
    .select(
      `id, order_id, product_id, option_code, quantity,
       retailer_unit_price, retailer_amount, hq_unit_price, hq_amount, created_at,
       product:products(product_code, erp_code, name, category, options),
       order:orders!inner(
         order_number, status, order_type, fulfillment_type, retailer_id, distributor_id,
         submitted_at, approved_at, shipped_at, delivered_at, created_at,
         retailer:users_profile!retailer_id(company_name),
         distributor:users_profile!distributor_id(company_name)
       )`,
      { count: 'exact' }
    )
  // 기간 필터는 주문 생성일 기준 (/orders 와 동일)
  if (q.from) builder = builder.gte('order.created_at', q.from)
  if (q.to) builder = builder.lte('order.created_at', q.to)

  const { data, total } = await fetchPage(builder.order('created_at').order('id'), q)

  const rows = data.map(i => ({
    id: i.id,
    order_id: i.order_id,
    order_number: i.order.order_number,
    order_status: i.order.status,
    order_type: i.order.order_type,
    fulfillment_type: i.order.fulfillment_type,
    retailer_id: i.order.retailer_id,
    retailer_name: i.order.retailer?.company_name ?? null,
    distributor_id: i.order.distributor_id,
    distributor_name: i.order.distributor?.company_name ?? null,
    product_id: i.product_id,
    product_code: i.product?.product_code ?? null,
    erp_code: i.product?.erp_code ?? null,
    product_name: i.product?.name ?? null,
    category: i.product?.category ?? null,
    option_code: i.option_code,
    option_name: optionName(i.product?.options ?? null, i.option_code),
    quantity: i.quantity,
    retailer_unit_price: i.retailer_unit_price,
    retailer_amount: i.retailer_amount,
    hq_unit_price: i.hq_unit_price,
    hq_amount: i.hq_amount,
    order_created_at: i.order.created_at,
    order_submitted_at: i.order.submitted_at,
    order_approved_at: i.order.approved_at,
    order_shipped_at: i.order.shipped_at,
    order_delivered_at: i.order.delivered_at,
  }))
  return { rows, total }
}

async function fetchProducts(supabase: SupabaseClient, q: ReportQuery): Promise<Page> {
  const { data, total } = await fetchPage(
    supabase
      .from('products')
      .select(
        `id, product_code, erp_code, name, category, options, moq, order_unit,
         consumer_price, distributor_price, product_url, image_url, is_active, created_at`,
        { count: 'exact' }
      )
      .order('product_code'),
    q
  )
  return { rows: data, total }
}

export const REPORT_RESOURCES: Record<
  string,
  (supabase: SupabaseClient, q: ReportQuery) => Promise<Page>
> = {
  stores: fetchStores,
  orders: fetchOrders,
  'order-items': fetchOrderItems,
  products: fetchProducts,
}
