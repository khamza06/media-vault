import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_ACCESS_COOKIE, AUTH_COOKIE_MAX_AGE, AUTH_REFRESH_COOKIE } from './lib/auth/constants'
import { createSupabaseServerClient } from './lib/supabase/server'

export async function proxy(request: NextRequest) {
  const access = request.cookies.get(AUTH_ACCESS_COOKIE)?.value
  const refresh = request.cookies.get(AUTH_REFRESH_COOKIE)?.value
  if (!refresh) return NextResponse.next()

  const supabase = createSupabaseServerClient()
  try {
    if (access) {
      const current = await supabase.auth.getUser(access)
      if (!current.error && current.data.user) {
        const response = NextResponse.next()
        response.headers.set('Cache-Control', 'private, no-store')
        return response
      }
    }
    const result = await supabase.auth.refreshSession({ refresh_token: refresh })
    if (result.error || !result.data.session) {
      // A temporary provider failure must not erase a still-recoverable session.
      const response = NextResponse.next()
      response.headers.set('Cache-Control', 'private, no-store')
      return response
    }
    const session = result.data.session
    request.cookies.set(AUTH_ACCESS_COOKIE, session.access_token)
    request.cookies.set(AUTH_REFRESH_COOKIE, session.refresh_token)
    // Forward fresh tokens to this render AND persist them in the browser.
    const response = NextResponse.next({ request: { headers: request.headers } })
    const options = { httpOnly: true, secure: request.nextUrl.protocol === 'https:',
      sameSite: 'lax' as const, path: '/', maxAge: AUTH_COOKIE_MAX_AGE }
    response.cookies.set(AUTH_ACCESS_COOKIE, session.access_token, options)
    response.cookies.set(AUTH_REFRESH_COOKIE, session.refresh_token, options)
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  } catch {
    const response = NextResponse.next()
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
}
