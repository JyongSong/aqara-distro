'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { UserProfile, UserStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<UserStatus, string> = {
  active: '활성',
  restricted: '제한',
  suspended: '정지',
}

const STATUS_COLORS: Record<UserStatus, string> = {
  active: 'bg-green-100 text-green-700',
  restricted: 'bg-orange-100 text-orange-700',
  suspended: 'bg-red-100 text-red-700',
}

export default function RetailersPage() {
  const { profile } = useAuth()
  const [retailers, setRetailers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!profile) return

    const fetchRetailers = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('users_profile')
        .select('*')
        .eq('distributor_id', profile.id)
        .eq('role', 'retailer')
        .order('company_name')

      if (data) setRetailers(data)
      setLoading(false)
    }

    fetchRetailers()
  }, [profile, supabase])

  const handleStatusChange = async (retailerId: string, newStatus: UserStatus) => {
    setUpdatingId(retailerId)
    const { error } = await supabase
      .from('users_profile')
      .update({ status: newStatus })
      .eq('id', retailerId)

    if (!error) {
      setRetailers((prev) =>
        prev.map((r) => (r.id === retailerId ? { ...r, status: newStatus } : r))
      )
    }
    setUpdatingId(null)
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">소매점 관리</h1>
        <p className="text-sm text-gray-500 mt-1">담당 소매점 현황 및 계정 상태 관리</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">로딩 중...</div>
        ) : retailers.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            담당 소매점이 없습니다.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full hidden lg:table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">업체명</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">담당자</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">전화</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">주소</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">상태</th>
                </tr>
              </thead>
              <tbody>
                {retailers.map((retailer) => (
                  <tr key={retailer.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {retailer.company_name}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {retailer.contact_name || '-'}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {retailer.phone || '-'}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {retailer.address || '-'}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                            STATUS_COLORS[retailer.status]
                          )}
                        >
                          {STATUS_LABELS[retailer.status]}
                        </span>
                        <select
                          value={retailer.status}
                          disabled={updatingId === retailer.id}
                          onChange={(e) =>
                            handleStatusChange(retailer.id, e.target.value as UserStatus)
                          }
                          className={cn(
                            'text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600',
                            'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          <option value="active">활성</option>
                          <option value="restricted">제한</option>
                          <option value="suspended">정지</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {retailers.map((retailer) => (
                <div key={retailer.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {retailer.company_name}
                    </span>
                    <span
                      className={cn(
                        'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2',
                        STATUS_COLORS[retailer.status]
                      )}
                    >
                      {STATUS_LABELS[retailer.status]}
                    </span>
                  </div>

                  <div className="space-y-1 mb-3">
                    {retailer.contact_name && (
                      <p className="text-xs text-gray-500">
                        <span className="text-gray-400">담당자</span>{' '}
                        {retailer.contact_name}
                      </p>
                    )}
                    {retailer.phone && (
                      <p className="text-xs text-gray-500">
                        <span className="text-gray-400">전화</span>{' '}
                        {retailer.phone}
                      </p>
                    )}
                    {retailer.address && (
                      <p className="text-xs text-gray-500 line-clamp-1">
                        <span className="text-gray-400">주소</span>{' '}
                        {retailer.address}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">상태 변경:</span>
                    <select
                      value={retailer.status}
                      disabled={updatingId === retailer.id}
                      onChange={(e) =>
                        handleStatusChange(retailer.id, e.target.value as UserStatus)
                      }
                      className={cn(
                        'text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600',
                        'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      <option value="active">활성</option>
                      <option value="restricted">제한</option>
                      <option value="suspended">정지</option>
                    </select>
                    {updatingId === retailer.id && (
                      <span className="text-xs text-gray-400">저장 중...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
