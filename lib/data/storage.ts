import 'server-only'

import { requireCurrentUser } from '../auth/dal'
import { createSupabaseServerClient } from '../supabase/server'
import { getPublicCoverPath, isOwnedCoverPath, MEDIA_COVERS_BUCKET } from '../storage'

export async function deleteOwnedCoverByPublicUrl(url: string | null | undefined) {
  if (!url) {
    return
  }

  const user = await requireCurrentUser()
  const path = getPublicCoverPath(url)

  if (!path || !isOwnedCoverPath(path, user.id)) {
    return
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  await supabase.storage.from(MEDIA_COVERS_BUCKET).remove([path])
}
