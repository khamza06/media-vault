import 'server-only'

import { requireCurrentUser } from '../auth/dal'
import { createSupabaseServerClient } from '../supabase/server'
import { getPublicCoverPath, isOwnedCoverPath, MEDIA_COVERS_BUCKET } from '../storage'

export async function deleteOwnedCoverByPublicUrl(url: string | null | undefined) {
  if (!url) {
    return
  }

  try {
    const user = await requireCurrentUser()
    const path = getPublicCoverPath(url)
    if (!path || !isOwnedCoverPath(path, user.id)) return
    const supabase = createSupabaseServerClient(user.accessToken)
    // Backups and pasted URLs can make several owned items share one cover.
    const references = await supabase.from('items').select('id').eq('user_id', user.id)
      .eq('image_url', url).limit(1)
    if (references.error || references.data?.length) return
    const removed = await supabase.storage.from(MEDIA_COVERS_BUCKET).remove([path])
    if (removed.error) console.warn('Cover cleanup was unavailable; item change is already saved.')
  } catch {
    // Cleanup follows the database commit. Do not invite duplicate write retries.
    console.warn('Cover cleanup was unavailable; item change is already saved.')
  }
}
