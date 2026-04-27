import { cookies } from 'next/headers'

import { localeCookieName, resolveLocale } from '../../../lib/i18n'

export async function POST(request: Request) {
  let payload: { locale?: string }

  try {
    payload = (await request.json()) as { locale?: string }
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const locale = resolveLocale(payload.locale)
  const cookieStore = await cookies()

  cookieStore.set(localeCookieName, locale, {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  })

  return Response.json({ success: true, locale })
}
