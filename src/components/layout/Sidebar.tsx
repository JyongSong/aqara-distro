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
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  retailer: [
    { label: '대시보드', href: '/retailer/dashboard', icon: '📊' },
    { label: '발주 목록', href: '/retailer/orders', icon: '📋' },
    { label: '새 발주', href: '/retailer/orders/new', icon: '➕' },
  ],
  distributor: [
    { label: '대시보드', href: '/distributor/dashboard', icon: '📊' },
    { label: '발주 관리', href: '/distributor/orders', icon: '📋' },
    { label: '단가 관리', href: '/distributor/pricing', icon: '💰' },
  ],
  hq: [
    { label: '대시보드', href: '/hq/dashboard', icon: '📊' },
    { label: '주문 관리', href: '/hq/orders', icon: '📋' },
    { label: '상품 관리', href: '/hq/products', icon: '📦' },
    { label: '단가 관리', href: '/hq/pricing', icon: '💰' },
    { label: '사용자 관리', href: '/hq/users', icon: '👥' },
  ],
}

function isActiveLink(pathname: string, href: string, allItems: NavItem[]): boolean {
  if (pathname === href) return true
  // Check if a more specific nav item matches — if so, this one shouldn't be active
  const moreSpecificMatch = allItems.some(
    other => other.href !== href && other.href.startsWith(href) && pathname.startsWith(other.href)
  )
  return pathname.startsWith(href) && !moreSpecificMatch
}

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()

  if (!profile) return null

  const items = NAV_ITEMS[profile.role] || []

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Aqara Distro</h1>
        <p className="text-sm text-gray-500 mt-1">발주·거래 관리 시스템</p>
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
      <nav className="flex-1 p-4 space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
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
        ))}
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
}
