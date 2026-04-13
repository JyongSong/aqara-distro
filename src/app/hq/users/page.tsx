'use client'

import { useEffect, useMemo, useState } from 'react'
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
  const [distributors, setDistributors] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [processing, setProcessing] = useState<string | null>(null)

  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null)

  // 총판 배정 모달 상태
  const [assigningUser, setAssigningUser] = useState<UserProfile | null>(null)
  const [selectedDistributor, setSelectedDistributor] = useState<string>('')
  const [assigning, setAssigning] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    fetchUsers()
    fetchDistributors()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('users_profile')
        .select('*')
        .order('created_at', { ascending: false })

      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter)
      }

      const { data } = await query
      if (data) setUsers(data)
    } finally {
      setLoading(false)
    }
  }

  const fetchDistributors = async () => {
    const { data } = await supabase
      .from('users_profile')
      .select('*')
      .eq('role', 'distributor')
      .eq('status', 'active')
      .order('company_name')
    if (data) setDistributors(data)
  }

  const handleStatusChange = async (userId: string, newStatus: string) => {
    setProcessing(userId)
    const { error } = await supabase
      .from('users_profile')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus as UserProfile['status'] } : u))
    }
    setProcessing(null)
  }

  const openAssign = (user: UserProfile) => {
    setAssigningUser(user)
    setSelectedDistributor(user.distributor_id || '')
  }

  const handleAssignDistributor = async () => {
    if (!assigningUser) return
    setAssigning(true)

    const { error } = await supabase
      .from('users_profile')
      .update({
        distributor_id: selectedDistributor || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assigningUser.id)

    if (error) {
      alert('총판 배정에 실패했습니다.')
    } else {
      setUsers(users.map(u =>
        u.id === assigningUser.id
          ? { ...u, distributor_id: selectedDistributor || null }
          : u
      ))
      setAssigningUser(null)
    }
    setAssigning(false)
  }

  const getDistributorName = (distributorId: string | null) => {
    if (!distributorId) return null
    return distributors.find(d => d.id === distributorId)?.company_name || null
  }

  const SanctionButtons = ({ user }: { user: UserProfile }) => {
    if (user.role === 'hq') return null
    return (
      <div className="flex items-center gap-1 flex-wrap">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">담당 총판</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500">상태</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500">관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => setViewingUser(user)}>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{user.company_name}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{user.contact_name || '-'}</td>
                    <td className="px-6 py-3">
                      <span className="text-xs text-gray-500">{ROLE_LABELS[user.role]}</span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{user.phone || '-'}</td>
                    <td className="px-6 py-3 text-sm">
                      {user.role === 'retailer' ? (
                        <div className="flex items-center gap-2">
                          <span className={user.distributor_id ? 'text-gray-700' : 'text-orange-500 text-xs'}>
                            {getDistributorName(user.distributor_id) || '미배정'}
                          </span>
                          <button
                            onClick={() => openAssign(user)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            배정
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
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
                <div key={user.id} className="p-4 space-y-2 cursor-pointer active:bg-gray-50" onClick={() => setViewingUser(user)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{user.company_name}</span>
                    <span className={cn(
                      'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                      STATUS_COLORS[user.status]
                    )}>
                      {STATUS_LABELS[user.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                    <span>{user.contact_name || '-'}</span>
                    <span>·</span>
                    <span>{ROLE_LABELS[user.role]}</span>
                    <span>·</span>
                    <span>{user.phone || '-'}</span>
                  </div>
                  {user.role === 'retailer' && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">총판:</span>
                      <span className={user.distributor_id ? 'text-gray-700' : 'text-orange-500 text-xs'}>
                        {getDistributorName(user.distributor_id) || '미배정'}
                      </span>
                      <button
                        onClick={() => openAssign(user)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        배정
                      </button>
                    </div>
                  )}
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

      {/* 사용자 상세 정보 모달 */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">사용자 정보</h3>
              <button
                onClick={() => setViewingUser(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">회사명</dt>
                <dd className="font-medium text-gray-900 text-right">{viewingUser.company_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">담당자</dt>
                <dd className="text-gray-700">{viewingUser.contact_name || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">연락처</dt>
                <dd className="text-gray-700">{viewingUser.phone || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">역할</dt>
                <dd className="text-gray-700">{ROLE_LABELS[viewingUser.role]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">상태</dt>
                <dd>
                  <span className={cn('inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[viewingUser.status])}>
                    {STATUS_LABELS[viewingUser.status]}
                  </span>
                </dd>
              </div>
              {viewingUser.role === 'retailer' && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">담당 총판</dt>
                  <dd className={viewingUser.distributor_id ? 'text-gray-700' : 'text-orange-500'}>
                    {getDistributorName(viewingUser.distributor_id) || '미배정'}
                  </dd>
                </div>
              )}
              {viewingUser.address && (
                <div>
                  <dt className="text-gray-500 mb-1">주소</dt>
                  <dd className="text-gray-700 text-xs leading-relaxed">{viewingUser.address}</dd>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <dt className="text-gray-400">등록일</dt>
                <dd className="text-gray-400 text-xs">{new Date(viewingUser.created_at).toLocaleDateString('ko-KR')}</dd>
              </div>
            </dl>

            <button
              onClick={() => setViewingUser(null)}
              className="w-full mt-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 총판 배정 모달 */}
      {assigningUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">총판 배정</h3>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{assigningUser.company_name}</strong> 의 담당 총판을 선택하세요.
            </p>

            <select
              value={selectedDistributor}
              onChange={(e) => setSelectedDistributor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4"
            >
              <option value="">미배정</option>
              {distributors.map((d) => (
                <option key={d.id} value={d.id}>{d.company_name}</option>
              ))}
            </select>

            <div className="flex gap-3">
              <button
                onClick={handleAssignDistributor}
                disabled={assigning}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {assigning ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => setAssigningUser(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
