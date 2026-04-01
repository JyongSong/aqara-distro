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

export function generateOrderNumber(): string {
  const now = new Date()
  const y = now.getFullYear().toString().slice(2)
  const m = (now.getMonth() + 1).toString().padStart(2, '0')
  const d = now.getDate().toString().padStart(2, '0')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${y}${m}${d}-${rand}`
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

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
