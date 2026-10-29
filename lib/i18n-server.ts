import 'server-only'

import { cookies } from 'next/headers'
import { metadataLanguageCookieName, resolveMetadataLanguage } from './metadata-language'
import { localeCookieName, resolveLocale, type Locale } from './i18n'

export async function getRequestLocale(): Promise<Locale> {
  return resolveLocale((await cookies()).get(localeCookieName)?.value)
}

export async function getRequestMetadataLanguage() {
  return resolveMetadataLanguage((await cookies()).get(metadataLanguageCookieName)?.value)
}
