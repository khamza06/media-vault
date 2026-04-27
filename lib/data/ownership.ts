import 'server-only'

import { cache } from 'react'

import { requireCurrentUser } from '../auth/dal'
import { createSupabaseServerClient } from '../supabase/server'

export type OwnershipMode = 'enforced' | 'legacy'

export function isMissingUserIdError(message?: string | null) {
  return Boolean(message && message.includes('user_id'))
}

export function isMissingColumnError(message: string | null | undefined, column: string) {
  return Boolean(message && message.includes(column))
}

export const getOwnershipMode = cache(async (): Promise<OwnershipMode> => {
  const user = await requireCurrentUser()
  const supabase = createSupabaseServerClient(user.accessToken)
  const probe = await supabase.from('items').select('user_id').limit(1)

  if (!probe.error) {
    return 'enforced'
  }

  if (isMissingUserIdError(probe.error.message)) {
    return 'legacy'
  }

  return 'enforced'
})
