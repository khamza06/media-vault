import 'server-only'

import { createSupabaseAdminClient } from '../supabase/admin'

export type PublicProfileLookup = {
  displayName: string | null
  id: string
  isPublic: boolean
  username: string
}

type ProfileLookupRow = {
  display_name?: string | null
  id: string
  is_public?: boolean | null
  username: string
}

export async function getProfileByUsername(username: string): Promise<{
  data: PublicProfileLookup | null
  error: { message?: string | null } | null
}> {
  const supabase = createSupabaseAdminClient()
  const result = await supabase
    .from('profiles')
    .select('id, display_name, username, is_public')
    .eq('username', username)
    .maybeSingle()

  if (result.error || !result.data) {
    return {
      data: null,
      error: result.error,
    }
  }

  const row = result.data as ProfileLookupRow

  return {
    data: {
      displayName: row.display_name ?? null,
      id: row.id,
      isPublic: Boolean(row.is_public),
      username: row.username,
    },
    error: null,
  }
}
