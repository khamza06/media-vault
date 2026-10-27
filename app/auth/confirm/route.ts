import { NextResponse } from 'next/server'

import { getEmailOtpType, getSafeAuthNextPath } from '../../../lib/auth/redirects'
import { persistSession } from '../../../lib/auth/session'
import { createSupabaseServerClient } from '../../../lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = getEmailOtpType(url.searchParams.get('type'))
  const nextPath = getSafeAuthNextPath(url.searchParams.get('next'))

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/login?authError=missing-link', url.origin))
  }

  const supabase = createSupabaseServerClient()
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
