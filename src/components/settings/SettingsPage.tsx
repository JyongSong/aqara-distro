'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { formatDateTime } from '@/lib/utils'

type LoginLog = {
  id: string
  email: string
  logged_in_at: string
}

export default function SettingsPage() {
  const { profile } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  // ── 비밀번호 변경 ──────────────────────────────────────────
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (newPw.length < 6) { setPwError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (newPw !== confirmPw) { setPwError('비밀번호가 일치하지 않습니다.'); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      setPwError(`변경 실패: ${error.message}`)
      setPwLoading(false)
      return
    }
    setPwSuccess(true)
    setNewPw('')
    setConfirmPw('')
    setPwLoading(false)
  }

  // ── 본사 시스템 설정 (HQ 전용) ──────────────────────────────
  const [snItems, setSnItems] = useState<string[]>([])
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSuccess, setSettingsSuccess] = useState(false)
  const [settingsError, setSettingsError] = useState('')

  useEffect(() => {
    if (profile?.role !== 'hq') return
    const fetchSettings = async () => {
      setSettingsLoading(true)
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'logistics_sn_items')
        .single()
      if (error) {
        console.error('시스템 설정 조회 실패:', error)
      } else if (data) {
        setSnItems((data.value as string[]) || [])
      }
      setSettingsLoading(false)
    }
    fetchSettings()
  }, [profile, supabase])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSettingsError('')
    setSettingsSuccess(false)
    setSettingsSaving(true)

    const { error } = await supabase
      .from('system_settings')
      .update({ value: snItems, updated_at: new Date().toISOString() })
      .eq('key', 'logistics_sn_items')

    if (error) {
      setSettingsError(`설정 저장 실패: ${error.message}`)
    } else {
      setSettingsSuccess(true)
    }
    setSettingsSaving(false)
  }

  const handleToggleSnItem = (item: string) => {
    setSnItems(prev => {
      if (prev.includes(item)) {
        return prev.filter(x => x !== item)
      } else {
        return [...prev, item]
      }
    })
  }

  // ── 로그인 기록 ────────────────────────────────────────────
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('login_logs')
        .select('id, email, logged_in_at')
        .order('logged_in_at', { ascending: false })
        .limit(20)
      if (data) setLogs(data)
      setLogsLoading(false)
    }
    fetchLogs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">계정 설정</h1>
        <p className="text-sm text-gray-500 mt-1">{profile?.company_name}</p>
      </div>

      {/* 비밀번호 변경 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">비밀번호 변경</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              새 비밀번호
            </label>
            <input
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="6자 이상"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              새 비밀번호 확인
            </label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="비밀번호를 다시 입력하세요"
            />
          </div>

          {pwError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              ✅ 비밀번호가 성공적으로 변경되었습니다.
            </div>
          )}

          <button
            type="submit"
            disabled={pwLoading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {pwLoading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>

      {/* 본사 물류 설정 (HQ 전용) */}
      {profile?.role === 'hq' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">물류 설정</h2>
          <p className="text-xs text-gray-500 mb-5">
            물류 관리 페이지에서 일련번호(SN)를 기록할 제품 항목을 설정합니다. 선택되지 않은 품목은 물류 페이지에서 제외되거나 일련번호 입력을 요구하지 않습니다.
          </p>
          {settingsLoading ? (
            <p className="text-sm text-gray-400">설정 로딩 중...</p>
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div className="flex gap-6">
                {['K100', 'L100'].map(item => (
                  <label key={item} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={snItems.includes(item)}
                      onChange={() => handleToggleSnItem(item)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    {item}
                  </label>
                ))}
              </div>

              {settingsError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {settingsError}
                </div>
              )}
              {settingsSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  ✅ 설정이 성공적으로 저장되었습니다.
                </div>
              )}

              <button
                type="submit"
                disabled={settingsSaving}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {settingsSaving ? '저장 중...' : '설정 저장'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* 로그인 기록 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">로그인 기록</h2>
        {logsLoading ? (
          <p className="text-sm text-gray-400">로딩 중...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-400">로그인 기록이 없습니다.</p>
        ) : (
          <div className="space-y-0 divide-y divide-gray-100">
            {logs.map((log, i) => (
              <div key={log.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{i === 0 ? '🟢' : '🔵'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{log.email}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(log.logged_in_at)}</p>
                  </div>
                </div>
                {i === 0 && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                    최근 로그인
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-4">최근 20건을 표시합니다.</p>
      </div>
    </div>
  )
}
