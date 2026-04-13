import { describe, it, expect } from 'vitest'
import {
  formatKRW,
  calculateVAT,
  calculateTotalWithVAT,
  numberToKorean,
  cn,
  escapeHtml,
} from '@/lib/utils'

// ── formatKRW ─────────────────────────────────────────────────────────────────

describe('formatKRW', () => {
  it('formats integer amounts with Korean locale', () => {
    expect(formatKRW(1000)).toBe('1,000원')
    expect(formatKRW(1000000)).toBe('1,000,000원')
  })

  it('formats zero', () => {
    expect(formatKRW(0)).toBe('0원')
  })

  it('formats large amounts', () => {
    expect(formatKRW(66000000)).toBe('66,000,000원')
  })
})

// ── calculateVAT ──────────────────────────────────────────────────────────────

describe('calculateVAT', () => {
  it('computes 10% VAT rounded', () => {
    expect(calculateVAT(100000)).toBe(10000)
    expect(calculateVAT(150000)).toBe(15000)
  })

  it('rounds fractional VAT', () => {
    expect(calculateVAT(10001)).toBe(1000) // Math.round(1000.1) = 1000
    expect(calculateVAT(10005)).toBe(1001) // Math.round(1000.5) = 1001
  })

  it('returns 0 for zero input', () => {
    expect(calculateVAT(0)).toBe(0)
  })
})

// ── calculateTotalWithVAT ────────────────────────────────────────────────────

describe('calculateTotalWithVAT', () => {
  it('returns amount + 10% VAT', () => {
    expect(calculateTotalWithVAT(100000)).toBe(110000)
    expect(calculateTotalWithVAT(500000)).toBe(550000)
  })

  it('handles zero', () => {
    expect(calculateTotalWithVAT(0)).toBe(0)
  })
})

// ── numberToKorean ────────────────────────────────────────────────────────────

describe('numberToKorean', () => {
  it('converts single digits', () => {
    expect(numberToKorean(1)).toBe('일')
    expect(numberToKorean(9)).toBe('구')
  })

  it('converts tens', () => {
    expect(numberToKorean(10)).toBe('십')
    expect(numberToKorean(11)).toBe('십일')
    expect(numberToKorean(20)).toBe('이십')
  })

  it('converts hundreds and thousands', () => {
    expect(numberToKorean(100)).toBe('백')
    expect(numberToKorean(1000)).toBe('천')
    expect(numberToKorean(1234)).toBe('천이백삼십사')
  })

  it('converts man units', () => {
    expect(numberToKorean(10000)).toBe('일만')
    expect(numberToKorean(100000)).toBe('십만')
    expect(numberToKorean(6600000)).toBe('육백육십만')
  })

  it('converts eok units', () => {
    expect(numberToKorean(100000000)).toBe('일억')
    expect(numberToKorean(123000000)).toBe('일억이천삼백만')
  })

  it('returns 영 for zero', () => {
    expect(numberToKorean(0)).toBe('영')
  })
})

// ── cn ────────────────────────────────────────────────────────────────────────

describe('cn (classnames)', () => {
  it('joins truthy class strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('filters falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('returns empty string for all falsy', () => {
    expect(cn(false, null, undefined)).toBe('')
  })
})

// ── escapeHtml ────────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes angle brackets', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;')
  })

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
    expect(escapeHtml("it's")).toBe('it&#039;s')
  })

  it('returns clean string unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

