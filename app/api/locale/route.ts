import { cookies } from 'next/headers'

import { isLocale, localeCookieName } from '../../../lib/i18n'

export async function POST(request: Request) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!payload || typeof payload !== 'object' || !('locale' in payload) || typeof payload.locale !== 'string' || !isLocale(payload.locale)) {
    return Response.json({ error: 'Choose a supported language.' }, { status: 400 })
  }
  const locale = payload.locale
  const cookieStore = await cookies()

  cookieStore.set(localeCookieName, locale, {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  })

  return Response.json({ success: true, locale })
}
