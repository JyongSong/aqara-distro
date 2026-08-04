'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { UserProfile } from '@/lib/types'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  // 프로필을 이미 불러온(또는 불러오는 중인) 사용자 id.
  // TOKEN_REFRESHED 처럼 사용자가 바뀌지 않는 이벤트에서 재조회를 막는다.
  const loadedFor = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('users_profile')
          .select('*')
          .eq('id', userId)
          .single()

        if (!isMounted) return

        if (error) {
          // supabase-js 는 쿼리 실패 시 throw 하지 않고 error 를 돌려준다.
          console.error('[auth] 프로필 조회 실패:', error.message)
          loadedFor.current = null // 다음 auth 이벤트에서 다시 시도할 수 있도록
          setProfile(null)
        } else {
          setProfile(data as UserProfile)
        }
      } catch (e) {
        if (!isMounted) return
        console.error('[auth] 프로필 조회 중 예외:', e)
        loadedFor.current = null
        setProfile(null)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      // 콜백은 반드시 동기여야 한다.
      //
      // auth-js 는 _callRefreshToken 안에서 auth 락을 쥔 채로
      // _notifyAllSubscribers 를 await 한다(GoTrueClient.js:3883). 이 콜백에서
      // supabase 를 await 하면 그 호출이 getSession() -> _acquireLock() 의
      // 재진입 분기(:2235)로 들어가 이미 락을 쥔 쪽을 기다리게 되고,
      // 서로를 기다리는 교착이 생겨 락이 영영 풀리지 않는다.
      // 그러면 이후 모든 supabase 요청이 그 락 뒤에 줄서서 앱 전체가 멈춘다.
      // 최초 로드가 멀쩡한 이유는 INITIAL_SESSION 을 내보내는 쪽만
      // _emitInitialSession 을 await 하지 않아 락 밖에서 실행되기 때문이다.
      //
      // 그래서 프로필 조회는 setTimeout 으로 콜백 바깥으로 밀어낸다.
      // 이는 Supabase 공식 문서가 권장하는 방식이기도 하다.
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!isMounted) return

        const nextUser = session?.user ?? null
        setUser(nextUser)

        if (!nextUser) {
          loadedFor.current = null
          setProfile(null)
          setLoading(false)
          return
        }

        // 같은 사용자의 토큰 갱신 등 — 프로필은 그대로 두고 참조도 바꾸지 않는다.
        if (loadedFor.current === nextUser.id) {
          setLoading(false)
          return
        }

        loadedFor.current = nextUser.id
        setTimeout(() => { void loadProfile(nextUser.id) }, 0)
      }
    )

    return () => {
      isMounted = false
      // 재마운트(React Strict Mode 포함) 시 프로필을 다시 불러오도록 초기화
      loadedFor.current = null
      subscription.unsubscribe()
    }
  }, [supabase])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore errors, still redirect
    }
    loadedFor.current = null
    setUser(null)
    setProfile(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
