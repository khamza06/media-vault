import 'server-only'

import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import type { Session, User } from '@supabase/supabase-js'

import {
  AUTH_ACCESS_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  AUTH_REFRESH_COOKIE,
} from './constants'
import { createSupabaseServerClient } from '../supabase/server'

type AuthSession = {
  accessToken: string
  refreshToken: string
  user: User
}

function isLocalHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  )
}

async function getCookieOptions() {
  const requestHeaders = await headers()
  const hostHeader =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? ''
  const hostname = hostHeader.split(':')[0].trim().toLowerCase()
  const forwardedProto = requestHeaders.get('x-forwarded-proto')
  const origin = requestHeaders.get('origin')
  const referer = requestHeaders.get('referer')

  const secure =
    forwardedProto === 'https' ||
    origin?.startsWith('https://') === true ||
    referer?.startsWith('https://') === true ||
    (process.env.NODE_ENV === 'production' && hostname.length > 0 && !isLocalHostname(hostname))

  return {
    httpOnly: true,
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax' as const,
    secure,
  }
}

export async function persistSession(session: Session) {
  const cookieStore = await cookies()
  const options = await getCookieOptions()

  cookieStore.set(AUTH_ACCESS_COOKIE, session.access_token, options)
  cookieStore.set(AUTH_REFRESH_COOKIE, session.refresh_token, options)
}

export async function clearSession() {
  const cookieStore = await cookies()
  const options = await getCookieOptions()
  cookieStore.set(AUTH_ACCESS_COOKIE, '', { ...options, maxAge: 0 })
  cookieStore.set(AUTH_REFRESH_COOKIE, '', { ...options, maxAge: 0 })
}

async function readSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(AUTH_ACCESS_COOKIE)?.value
  const refreshToken = cookieStore.get(AUTH_REFRESH_COOKIE)?.value

  if (!accessToken || !refreshToken) {
    return null
  }

  const supabase = createSupabaseServerClient()
  const currentUser = await supabase.auth.getUser(accessToken)

  if (!currentUser.error && currentUser.data.user) {
    return {
      accessToken,
      refreshToken,
      user: currentUser.data.user,
    }
  }

  const refreshed = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  })

  if (refreshed.error || !refreshed.data.session || !refreshed.data.user) {
    return null
  }

  // Server Component renders can read cookies but cannot modify them in Next 16.
  // We still return the refreshed session for the current request and leave
  // cookie persistence to Server Actions and Route Handlers.
  return {
    accessToken: refreshed.data.session.access_token,
    refreshToken: refreshed.data.session.refresh_token,
    user: refreshed.data.user,
  }
}

export const getAuthSession = cache(readSession)
