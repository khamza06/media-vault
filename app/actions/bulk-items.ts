'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '../../lib/auth/dal'
import { createSupabaseServerClient } from '../../lib/supabase/server'
import { needsBulkItemChange, parseBulkItemChange, parseBulkItemIds, type BulkItemChange } from '../../lib/bulk-item-changes'
import { shelfDefinitions } from '../../lib/shelves'

export type BulkItemChangeResult = {
  success: boolean
  error: string | null
  updated: number
  updatedIds: string[]
  skipped: number
  failed: number
}

export async function bulkUpdateItemsAction(itemIds: string[], input: BulkItemChange): Promise<BulkItemChangeResult> {
  const empty = { success: false, error: null, updated: 0, updatedIds: [] as string[], skipped: 0, failed: 0 }
  const user = await getCurrentUser()
  if (!user) return { ...empty, error: 'Sign in to update your vault.' }
  const ids = parseBulkItemIds(itemIds)
  const change = parseBulkItemChange(input)
  if (!ids || !change) return { ...empty, error: 'Select up to 500 valid items and a supported change.' }

  let result: BulkItemChangeResult
  try {
    const supabase = createSupabaseServerClient(user.accessToken)
    const owned = await supabase.from('items').select('id, type, status, favorite')
      .eq('user_id', user.id).in('id', ids)
    if (owned.error) return { ...empty, error: 'Could not verify your selected items. Nothing was changed.', failed: ids.length }
    const eligible = (owned.data ?? []).filter((item) => needsBulkItemChange(item, change)).map((item) => item.id as string)
    const eligibleSet = new Set(eligible)
    if (eligible.length === 0) return { ...empty, success: true, skipped: ids.length }
    const payload = change.kind === 'status' ? { status: change.status } : { favorite: change.favorite }
    const write = await supabase.from('items').update(payload).eq('user_id', user.id)
      .in('id', eligible).select('id')
    if (write.error) return { ...empty, error: 'Could not save these changes. Please try again.', skipped: ids.length - eligible.length, failed: eligible.length }
    const updatedIds = [...new Set((write.data ?? []).map((item) => item.id as string).filter((id) => eligibleSet.has(id)))]
    const failed = eligible.length - updatedIds.length
    result = { success: failed === 0, error: failed ? 'Some items could not be updated. You can retry them.' : null,
      updated: updatedIds.length, updatedIds, skipped: ids.length - eligible.length, failed }
  } catch {
    return { ...empty, error: 'Connection interrupted. Refresh your vault to check the saved state before retrying.', failed: ids.length }
  }

  if (result.updated > 0) {
    try {
      for (const path of ['/', '/library', '/lists', '/stats', '/summary', '/backup']) revalidatePath(path)
      for (const shelf of shelfDefinitions) revalidatePath(`/shelves/${shelf.slug}`)
      revalidatePath('/items/[id]', 'page')
      revalidatePath('/items/[id]/edit', 'page')
      revalidatePath('/lists/[id]', 'page')
      revalidatePath('/u/[username]', 'page')
      revalidatePath('/u/[username]/lists/[listSlug]', 'page')
    } catch {
      console.warn('Bulk update saved, but view invalidation was unavailable.')
    }
  }
  return result
}
