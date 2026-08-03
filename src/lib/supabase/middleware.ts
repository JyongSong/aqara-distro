import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 역할별 기본 화면
const ROLE_HOME: Record<string, string> = {
  retailer: '/retailer/dashboard',
  distributor: '/distributor/dashboard',
  hq: '/hq/dashboard',
}

// 경로 prefix ↔ 접근 허용 역할
// 각 역할의 사이드바는 자기 prefix 안에서만 이동하므로 교차 접근은 없다.
const ROLE_PATHS: { prefix: string; role: string }[] = [
  { prefix: '/hq', role: 'hq' },
  { prefix: '/distributor', role: 'distributor' },
  { prefix: '/retailer', role: 'retailer' },
]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 未登录时重定向到登录页（/register 페이지 및 /api/ 라우트 제외）
  const isLoginPage = request.nextUrl.pathname === '/login'
  const isRootPage = request.nextUrl.pathname === '/'
  const isRegisterPage = request.nextUrl.pathname === '/register'
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth/')
  const isForgotPassword = request.nextUrl.pathname === '/forgot-password'
  const isResetPassword = request.nextUrl.pathname === '/reset-password'
  const isOpenPage = request.nextUrl.pathname.startsWith('/open/')

  if (!user && !isLoginPage && !isRegisterPage && !isApiRoute && !isAuthRoute && !isForgotPassword && !isResetPassword && !isOpenPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 已登录用户
  if (user) {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('role, status')
      .eq('id', user.id)
      .single()

    // 停止状态用户强制登出
    if (profile?.status === 'suspended' && !isLoginPage) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'suspended')
      return NextResponse.redirect(url)
    }

    // 역할에 맞지 않는 경로 접근 차단 → 본인 대시보드로 리다이렉트
    // profile 이 null 인 경우(조회 실패 등)는 판단할 수 없으므로 통과시킨다.
    // 데이터 자체는 RLS 로 보호되며, 여기서 막으면 일시적 조회 실패 시
    // 리다이렉트 루프에 빠질 수 있다.
    if (profile) {
      const path = request.nextUrl.pathname
      const guarded = ROLE_PATHS.find(
        ({ prefix }) => path === prefix || path.startsWith(prefix + '/')
      )
      if (guarded && profile.role !== guarded.role) {
        const url = request.nextUrl.clone()
        url.pathname = ROLE_HOME[profile.role] ?? '/login'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }

    // 登录页、根页面或注册页 → 已登录则重定向到仪表盘
    // 알 수 없는 role 이면 리다이렉트하지 않는다. 예전에는 '/login' 으로
    // 보내서 로그인 페이지가 자기 자신으로 무한 리다이렉트됐다.
    if (isLoginPage || isRootPage || isRegisterPage) {
      const home = profile ? ROLE_HOME[profile.role] : undefined
      if (home) {
        const url = request.nextUrl.clone()
        url.pathname = home
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
