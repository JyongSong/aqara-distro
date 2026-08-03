import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole, UserStatus } from '@/lib/types'

export const ALL_ROLES: readonly UserRole[] = ['retailer', 'distributor', 'hq']

export type AuthedUser = {
  id: string
  role: UserRole
  status: UserStatus
}

type Allowed = { user: AuthedUser; error: null }
type Denied = { user: null; error: NextResponse }

/**
 * 라우트 핸들러용 인증·권한 검사.
 *
 * proxy.ts 는 /api/* 를 통과시키므로(`isApiRoute` 예외) 각 라우트가 스스로
 * 검사해야 한다. service role 클라이언트를 쓰는 라우트는 RLS 를 우회하므로
 * 특히 필수.
 *
 * 사용법:
 *   const { user, error } = await requireRole(['hq'])
 *   if (error) return error
 */
export async function requireRole(
  roles: readonly UserRole[]
): Promise<Allowed | Denied> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 }),
    }
  }

  // 프로필 조회는 admin client 사용 — users_profile RLS 가 get_user_role() 을
  // 참조하므로 사용자 클라이언트로 읽으면 재귀가 발생할 수 있다.
  // (api/hq/partner-surveys 라우트와 동일한 방식)
  const { data: profile } = await createAdminClient()
    .from('users_profile')
    .select('id, role, status')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return {
      user: null,
      error: NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 403 }),
    }
  }

  if (profile.status === 'suspended') {
    return {
      user: null,
      error: NextResponse.json({ error: '정지된 계정입니다.' }, { status: 403 }),
    }
  }

  if (!roles.includes(profile.role)) {
    return {
      user: null,
      error: NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 }),
    }
  }

  return { user: profile as AuthedUser, error: null }
}
