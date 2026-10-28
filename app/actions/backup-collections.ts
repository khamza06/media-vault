'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '../../lib/auth/dal'
import { getBackupTrackingError, type VaultExportItem } from '../../lib/backup'
import {
  isBackupId, mapBackupItemIds, normalizeBackupName, parseBackupCollections, planBackupMemberships,
  MAX_BACKUP_RESTORE_BYTES, MAX_BACKUP_RESTORE_ITEMS, MAX_BACKUP_RESTORE_LINKS, MAX_BACKUP_RESTORE_LISTS,
  type VaultExportList,
} from '../../lib/backup-collections'
import { readAllOwnedBackupItems, readAllOwnedBackupRows } from '../../lib/data/backup-items'
import { getAllowedStatuses, mediaTypes, type MediaType } from '../../lib/media'
import { createSupabaseServerClient } from '../../lib/supabase/server'
import { restoreBackupItemsAction } from './backup'

type ItemResult = Awaited<ReturnType<typeof restoreBackupItemsAction>>
export type CollectionRestoreResult = ItemResult & {
  listsRestored: number; listsSkipped: number; listsFailed: number
  membershipsRestored: number; membershipsSkipped: number; membershipsFailed: number
  warnings: string[]
}
type OwnedItem = { id: string; title: string; type: string; external_source?: string | null; external_id?: string | null }

function emptyResult(): CollectionRestoreResult {
  return { error: null, failed: 0, invalid: 0, restored: 0, skipped: 0, success: false, usedExternalIdColumns: true,
    listsRestored: 0, listsSkipped: 0, listsFailed: 0, membershipsRestored: 0, membershipsSkipped: 0, membershipsFailed: 0, warnings: [] }
}

export async function restoreBackupCollectionsAction(input: { items: VaultExportItem[]; lists: VaultExportList[] }): Promise<CollectionRestoreResult> {
  const result = emptyResult()
  const changedListIds: string[] = []
  try {
    const user = await getCurrentUser()
    if (!user) return { ...result, error: 'Please sign in before restoring a backup.' }
    if (!input || !Array.isArray(input.items) || !Array.isArray(input.lists) || (!input.items.length && !input.lists.length)) {
      return { ...result, error: 'Select items or lists to restore.' }
    }
    if (input.items.length > MAX_BACKUP_RESTORE_ITEMS || input.lists.length > MAX_BACKUP_RESTORE_LISTS ||
      new TextEncoder().encode(JSON.stringify(input)).byteLength > MAX_BACKUP_RESTORE_BYTES) {
      return { ...result, error: 'Selection is too large. Choose fewer items/lists and restore in smaller groups.' }
    }
    const parsed = parseBackupCollections({ ...input, app: 'Media Vault', version: 2 }, false)
    if (parsed.error) return { ...result, error: parsed.error }
    const linksCount = parsed.lists.reduce((sum, list) => sum + list.item_ids.length, 0)
    if (linksCount > MAX_BACKUP_RESTORE_LINKS) return { ...result, error: 'Select fewer lists: at most 20,000 membership references per restore.' }
    const supabase = createSupabaseServerClient(user.accessToken)
    const existingLists = parsed.lists.length ? await readAllOwnedBackupRows<{ id: string; name: string }>(supabase, user.id, 'id, name', 'lists') : { data: [], error: null }
    if (existingLists.error) return { ...result, error: 'Could not check your lists. Check the Lists setup before restoring. Nothing was restored.' }

    // Keep the established, independently validated item restore path.
    if (input.items.length) {
      Object.assign(result, await restoreBackupItemsAction(input.items))
      if (!result.success) {
        result.warnings.push('List restore was not started. Review item results and refresh your vault before retrying.')
        return result
      }
    }
    if (!parsed.lists.length) return { ...result, success: true }
    let itemIds = new Map<string, string>()
    if (input.items.length && linksCount) {
      const fields = result.usedExternalIdColumns ? 'id, title, type, external_source, external_id' : 'id, title, type'
      const owned = await readAllOwnedBackupItems<OwnedItem>(supabase, user.id, fields)
      if (owned.error) return { ...result, success: false, error: 'Items were processed, but list item mapping could not be checked. No lists were restored.' }
      const valid = input.items.filter((item) => !getBackupTrackingError(item) && typeof item.title === 'string' && item.title.trim() &&
        mediaTypes.includes(item.type as MediaType) && getAllowedStatuses(item.type).includes(item.status as ReturnType<typeof getAllowedStatuses>[number]))
      itemIds = mapBackupItemIds(valid, owned.data ?? [])
    }
    const names = new Set((existingLists.data ?? []).map((list) => normalizeBackupName(list.name)))
    for (const list of parsed.lists) {
      const name = normalizeBackupName(list.name)
      if (names.has(name)) {
        result.listsSkipped++
        result.membershipsSkipped += list.item_ids.length
        continue
      }
      const plan = planBackupMemberships(list, itemIds)
      result.membershipsSkipped += plan.skipped
      names.add(name)
      const created = await supabase.from('lists').insert({ name: list.name, description: list.description, user_id: user.id, is_public: false, slug: null }).select('id').single()
      if (created.error || !isBackupId(created.data?.id)) {
        result.listsFailed++
        result.membershipsFailed += plan.itemIds.length
        continue
      }
      const listId = created.data.id
      changedListIds.push(listId)
      result.listsRestored++
      for (let start = 0; start < plan.itemIds.length; start += 500) {
        const ids = plan.itemIds.slice(start, start + 500)
        const rows = ids.map((itemId) => ({ list_id: listId, item_id: itemId, user_id: user.id }))
        const added = await supabase.from('list_items').upsert(rows, { onConflict: 'list_id,item_id', ignoreDuplicates: true }).select('item_id')
        if (added.error) { result.membershipsFailed += ids.length; continue }
        if (!Array.isArray(added.data)) { result.membershipsFailed += ids.length; continue }
        const allowed = new Set(ids)
        const confirmed = new Set(added.data.map((row: { item_id: string }) => row.item_id).filter((id: string) => allowed.has(id)))
        result.membershipsRestored += confirmed.size
        result.membershipsFailed += ids.length - confirmed.size
      }
    }
    if (result.membershipsSkipped) result.warnings.push('Some links were skipped: unselected/ambiguous items, duplicate links or lists with an existing name. Existing lists were not modified.')
    if (result.listsFailed || result.membershipsFailed) result.warnings.push('Restore is partial. Review the new private lists before retrying. Matching list names are skipped, not merged or overwritten.')
    result.success = result.listsFailed === 0 && result.membershipsFailed === 0
    if (!result.success) result.error = 'Some lists or memberships could not be restored. Successfully restored items/lists remain in your vault.'
    return result
  } catch {
    return { ...result, success: false, error: 'Connection interrupted. Some changes may have saved. Refresh and review your vault and lists before retrying.' }
  } finally {
    if (changedListIds.length) {
      try {
        for (const path of ['/', '/backup', '/lists', ...changedListIds.map((id) => `/lists/${id}`)]) revalidatePath(path)
      } catch { console.warn('Backup lists saved, but view invalidation was unavailable.') }
    }
  }
}
