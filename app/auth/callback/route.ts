import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { persistSession } from '../../../lib/auth/session'
import { createSupabaseServerClient } from '../../../lib/supabase/server'

function getSafeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return '/'
  }

  return nextPath
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const nextPath = getSafeNextPath(url.searchParams.get('next'))
  const supabase = createSupabaseServerClient()

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code)

    if (result.error || !result.data.session) {
      return NextResponse.redirect(new URL('/login?authError=invalid-link', url.origin))
    }

    await persistSession(result.data.session)

    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/auth/reset-password?ready=1', url.origin))
    }

    const nextUrl = new URL(nextPath, url.origin)
    nextUrl.searchParams.set('confirmed', '1')
    return NextResponse.redirect(nextUrl)
  }

  if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (result.error || !result.data.session) {
      return NextResponse.redirect(new URL('/login?authError=invalid-link', url.origin))
    }

    await persistSession(result.data.session)

    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/auth/reset-password?ready=1', url.origin))
    }

    const nextUrl = new URL(nextPath, url.origin)
    nextUrl.searchParams.set('confirmed', '1')
    return NextResponse.redirect(nextUrl)
  }

  return NextResponse.redirect(new URL('/login?authError=missing-link', url.origin))
}
