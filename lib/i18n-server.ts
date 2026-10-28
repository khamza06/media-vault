import 'server-only'

import { cookies } from 'next/headers'
import { localeCookieName, resolveLocale, type Locale } from './i18n'

export async function getRequestLocale(): Promise<Locale> {
  return resolveLocale((await cookies()).get(localeCookieName)?.value)
}
