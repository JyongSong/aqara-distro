import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  if (!user && !isLoginPage && !isRegisterPage && !isApiRoute) {
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

    // 登录页、根页面或注册页 → 已登录则重定向到仪表盘
    if (isLoginPage || isRootPage || isRegisterPage) {
      if (profile) {
        const url = request.nextUrl.clone()
        switch (profile.role) {
          case 'retailer':
            url.pathname = '/retailer/dashboard'
            break
          case 'distributor':
            url.pathname = '/distributor/dashboard'
            break
          case 'hq':
            url.pathname = '/hq/dashboard'
            break
          default:
            url.pathname = '/login'
        }
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
