// 카테고리 표시 순서
export const CATEGORY_ORDER = ['도어락', '액세서리', '도어벨', '허브', '컨트롤러', '스위치', '기타']

export function sortByCategory<T extends { category?: string | null; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category ?? '')
    const bi = CATEGORY_ORDER.indexOf(b.category ?? '')
    const aOrder = ai === -1 ? CATEGORY_ORDER.length : ai
    const bOrder = bi === -1 ? CATEGORY_ORDER.length : bi
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.name.localeCompare(b.name, 'ko')
  })
}

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원'
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}


export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function calculateVAT(amount: number): number {
  return Math.round(amount * 0.1)
}

export function calculateTotalWithVAT(amount: number): number {
  return amount + calculateVAT(amount)
}

export function numberToKorean(n: number): string {
  if (n === 0) return '영'
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  const small = ['', '십', '백', '천']
  const big = ['', '만', '억', '조']

  function chunk4(num: number): string {
    let res = ''
    for (let i = 3; i >= 0; i--) {
      const d = Math.floor(num / Math.pow(10, i)) % 10
      if (d === 0) continue
      res += (d === 1 && i > 0 ? '' : digits[d]) + small[i]
    }
    return res
  }

  let result = ''
  let temp = n
  let bi = 0
  while (temp > 0) {
    const chunk = temp % 10000
    if (chunk > 0) result = chunk4(chunk) + big[bi] + result
    temp = Math.floor(temp / 10000)
    bi++
  }
  return result
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
