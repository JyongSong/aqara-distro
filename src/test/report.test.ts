import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAuthorized, parseReportQuery, toCsv } from '@/lib/report'

describe('isAuthorized', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('rejects everything when REPORT_API_KEY is not configured', () => {
    vi.stubEnv('REPORT_API_KEY', '')
    expect(isAuthorized('Bearer ')).toBe(false)
    expect(isAuthorized('Bearer undefined')).toBe(false)
    expect(isAuthorized(null)).toBe(false)
  })

  it('accepts only the exact bearer token', () => {
    vi.stubEnv('REPORT_API_KEY', 'secret-key')
    expect(isAuthorized('Bearer secret-key')).toBe(true)
    expect(isAuthorized('Bearer secret-key2')).toBe(false)
    expect(isAuthorized('secret-key')).toBe(false)
    expect(isAuthorized(null)).toBe(false)
  })
})

describe('parseReportQuery', () => {
  const parse = (qs: string) => parseReportQuery(new URLSearchParams(qs))

  it('applies defaults', () => {
    expect(parse('').query).toEqual({ from: null, to: null, page: 1, pageSize: 1000, format: 'json' })
  })

  it('interprets from/to as whole KST days', () => {
    const { query } = parse('from=2026-09-01&to=2026-09-30')
    expect(query?.from).toBe('2026-09-01T00:00:00+09:00')
    expect(query?.to).toBe('2026-09-30T23:59:59.999+09:00')
  })

  it('rejects invalid parameters', () => {
    expect(parse('from=2026/09/01').error).toMatch(/from/)
    expect(parse('to=2026-13-45').error).toMatch(/to/)
    expect(parse('page=0').error).toMatch(/page/)
    expect(parse('page_size=1001').error).toMatch(/page_size/)
    expect(parse('format=xml').error).toMatch(/format/)
  })
})

describe('toCsv', () => {
  it('prefixes a BOM and escapes commas, quotes, newlines and JSON values', () => {
    const csv = toCsv([
      { name: '가게, "A"', note: 'line1\nline2', options: [{ code: 'W' }], total: 1000, empty: null },
    ])
    expect(csv).toBe(
      '﻿name,note,options,total,empty\r\n' +
      '"가게, ""A""","line1\nline2","[{""code"":""W""}]",1000,\r\n'
    )
  })

  it('returns only the BOM for no rows', () => {
    expect(toCsv([])).toBe('﻿')
  })
})
