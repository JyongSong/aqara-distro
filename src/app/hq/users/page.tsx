'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserProfile, ROLE_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<string, string> = {
  active: '정상',
  restricted: '제한',
  suspended: '정지',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  restricted: 'bg-orange-100 text-orange-700',
  suspended: 'bg-red-100 text-red-700',
}

export default function HQUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [processing, setProcessing] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter])

  const fetchUsers = async () => {
    setLoading(true)
    let query = supabase
      .from('users_profile')
      .select('*')
      .order('created_at', { ascending: false })

    if (roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }

    const { data } = await query
    if (data) setUsers(data)
    setLoading(false)
  }

  const handleStatusChange = async (userId: string, newStatus: string) => {
    setProcessing(userId)
    await supabase
      .from('users_profile')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', userId)

    setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus as UserProfile['status'] } : u))
    setProcessing(null)
  }

  const SanctionButtons = ({ user }: { user: UserProfile }) => {
    if (user.role === 'hq') return null
    return (
      <div className="flex items-center gap-1">
        {user.status !== 'active' && (
          <button
            onClick={() => handleStatusChange(user.id, 'active')}
            disabled={processing === user.id}
            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 disabled:opacity-50"
          >
            해제
          </button>
        )}
        {user.status !== 'restricted' && (
          <button
            onClick={() => handleStatusChange(user.id, 'restricted')}
            disabled={processing === user.id}
            className="px-2 py-1 text-xs bg-orange-50 text-orange-700 rounded hover:bg-orange-100 disabled:opacity-50"
          >
            제한
          </button>
        )}
        {user.status !== 'suspended' && (
          <button
            onClick={() => handleStatusChange(user.id, 'suspended')}
            disabled={processing === user.id}
            className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 disabled:opacity-50"
          >
            정지
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">사용자 관리</h1>
        <p className="text-sm text-gray-500 mt-1">소매점·총판 관리 및 제재 설정</p>
      </div>

      {/* 역할 필터 */}
      <div className="flex gap-2 mb-6">
        {['all', 'retailer', 'distributor'].map((role) => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              roleFilter === role
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {role === 'all' ? '전체' : ROLE_LABELS[role as keyof typeof ROLE_LABELS]}
          </button>
        ))}
      </div>

      {/* 사용자 목록 */}
      <div className="bg-white rounded-xl border border-gray-200">
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">로딩 중...</div>
        ) : users.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">사용자가 없습니다.</div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full hidden lg:table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">회사명</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">담당자</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">역할</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">연락처</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500">상태</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500">제재</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{user.company_name}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{user.contact_name || '-'}</td>
                    <td className="px-6 py-3">
                      <span className="text-xs text-gray-500">{ROLE_LABELS[user.role]}</span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{user.phone || '-'}</td>
                    <td className="px-6 py-3 text-center">
                      <span className={cn(
                        'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                        STATUS_COLORS[user.status]
                      )}>
                        {STATUS_LABELS[user.status]}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <SanctionButtons user={user} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {users.map((user) => (
                <div key={user.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{user.company_name}</span>
                    <span className={cn(
                      'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                      STATUS_COLORS[user.status]
                    )}>
                      {STATUS_LABELS[user.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{user.contact_name || '-'}</span>
                    <span>·</span>
                    <span>{ROLE_LABELS[user.role]}</span>
                    <span>·</span>
                    <span>{user.phone || '-'}</span>
                  </div>
                  <SanctionButtons user={user} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 제재 기준 안내 */}
      <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">제재 기준</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-4">
            <dt className="w-20 flex-shrink-0">
              <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS.active)}>
                정상
              </span>
            </dt>
            <dd className="text-gray-600">모든 기능 이용 가능</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-20 flex-shrink-0">
              <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS.restricted)}>
                제한
              </span>
            </dt>
            <dd className="text-gray-600">로그인 가능, 신규 주문 불가</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-20 flex-shrink-0">
              <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS.suspended)}>
                정지
              </span>
            </dt>
            <dd className="text-gray-600">로그인 제한</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
