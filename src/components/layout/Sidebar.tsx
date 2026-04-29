'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: string
  external?: boolean
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  retailer: [
    { label: '대시보드', href: '/retailer/dashboard', icon: '📊' },
    { label: '상품 리스트', href: '/retailer/products', icon: '📦' },
    { label: '발주 관리', href: '/retailer/orders', icon: '📋' },
    // 견적 요청 기능 임시 비활성화
    // { label: '견적 요청', href: '/retailer/orders/new', icon: '📝' },
    { label: '발주 요청', href: '/retailer/orders/new-direct', icon: '🚀' },
    { label: '계정 설정', href: '/retailer/settings', icon: '⚙️' },
  ],
  distributor: [
    { label: '대시보드', href: '/distributor/dashboard', icon: '📊' },
    { label: '상품리스트', href: '/distributor/products', icon: '📦' },
    { label: '소매점 관리', href: '/distributor/retailers', icon: '👥' },
    { label: '발주 관리', href: '/distributor/orders', icon: '📋' },
    { label: '본사 발주', href: '/distributor/orders/new', icon: '➕' },
    { label: '단가 관리', href: '/distributor/pricing', icon: '💰' },
    { label: '계정 설정', href: '/distributor/settings', icon: '⚙️' },
  ],
  hq: [
    { label: '대시보드', href: '/hq/dashboard', icon: '📊' },
    { label: '주문 관리', href: '/hq/orders', icon: '📋' },
    { label: '출하현황', href: '/hq/shipments', icon: '🚚' },
    { label: '상품 관리', href: '/hq/products', icon: '📦' },
    { label: '단가 관리', href: '/hq/pricing', icon: '💰' },
    { label: '사용자 관리', href: '/hq/users', icon: '👥' },
    { label: '물류 관리', href: '/open/logistics', icon: '🏭', external: true },
    { label: '계정 설정', href: '/hq/settings', icon: '⚙️' },
  ],
}

function isActiveLink(pathname: string, href: string, allItems: NavItem[]): boolean {
  if (pathname === href) return true
  const moreSpecificMatch = allItems.some(
    other => other.href !== href && other.href.startsWith(href) && pathname.startsWith(other.href)
  )
  return pathname.startsWith(href) && !moreSpecificMatch
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()

  if (!profile) return null

  const items = NAV_ITEMS[profile.role] || []

  const sidebarContent = (
    <aside className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Aqara Distro</h1>
          <p className="text-sm text-gray-500 mt-1">발주·거래 관리 시스템</p>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          aria-label="Close menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <p className="font-medium text-gray-900 text-sm">{profile.company_name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {profile.contact_name && `${profile.contact_name} · `}
          {ROLE_LABELS[profile.role]}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {items.map((item) =>
          item.external ? (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              <span>{item.icon}</span>
              {item.label}
              <svg className="w-3 h-3 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActiveLink(pathname, item.href, items)
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        )}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <span>🚪</span>
          로그아웃
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={onClose} />
          <div className="fixed inset-y-0 left-0 z-50 animate-slide-in">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
