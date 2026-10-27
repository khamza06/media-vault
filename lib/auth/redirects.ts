import type { EmailOtpType } from '@supabase/supabase-js'

const REDIRECT_BASE = 'https://media-vault.app'
const emailOtpTypes: readonly EmailOtpType[] = [
  'email', 'signup', 'recovery', 'invite', 'magiclink', 'email_change',
]

export function getSafeAuthNextPath(value: string | null) {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) {
    return '/'
  }

  const url = new URL(value, REDIRECT_BASE)
  return url.origin === REDIRECT_BASE ? `${url.pathname}${url.search}${url.hash}` : '/'
}

export function getEmailOtpType(value: string | null): EmailOtpType | null {
  return emailOtpTypes.find((type) => type === value) ?? null
}
