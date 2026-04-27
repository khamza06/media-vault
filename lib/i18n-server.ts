import 'server-only'

import type { Locale } from './i18n'

export async function getRequestLocale(): Promise<Locale> {
  return 'en'
}
