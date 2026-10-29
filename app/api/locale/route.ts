import { cookies } from 'next/headers'

import { isLocale, localeCookieName } from '../../../lib/i18n'
import { isMetadataLanguage, metadataLanguageCookieName } from '../../../lib/metadata-language'

export async function POST(request: Request) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
    (!('locale' in payload) && !('metadataLanguage' in payload)) ||
    ('locale' in payload && (typeof payload.locale !== 'string' || !isLocale(payload.locale))) ||
    ('metadataLanguage' in payload && !isMetadataLanguage(payload.metadataLanguage))) {
    return Response.json({ error: 'Choose a supported language.' }, { status: 400 })
  }
  const locale = 'locale' in payload ? payload.locale as 'en' | 'ru' : undefined
  const cookieStore = await cookies()

  const options = {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }
  if (locale) cookieStore.set(localeCookieName, locale, options)
  const metadataLanguage = 'metadataLanguage' in payload ? payload.metadataLanguage as 'en' | 'ru' | 'original' : undefined
  if (metadataLanguage) cookieStore.set(metadataLanguageCookieName, metadataLanguage, options)

  return Response.json({ success: true, ...(locale ? { locale } : {}), ...(metadataLanguage ? { metadataLanguage } : {}) }, { headers: { 'Cache-Control': 'private, no-store' } })
}
