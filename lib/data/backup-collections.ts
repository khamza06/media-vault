import 'server-only'

import { getCurrentUser } from '../auth/dal'
import { createSupabaseServerClient } from '../supabase/server'
import type { VaultExportList } from '../backup-collections'
import { readAllOwnedBackupRows } from './backup-items'

type ListRow = { id: string; name: string; description: string | null }
type Membership = { id: string; list_id: string; item_id: string }

export async function getCollectionsForBackupExport(ownedItemIds: string[]): Promise<{
  lists: VaultExportList[] | undefined; error: string | null; warning: string | null
}> {
  const user = await getCurrentUser()
  if (!user) return { lists: undefined, error: 'Sign in to export lists.', warning: null }
  const supabase = createSupabaseServerClient(user.accessToken)
  const lists = await readAllOwnedBackupRows<ListRow>(supabase, user.id, 'id, name, description', 'lists')
  if (lists.error) {
    if (lists.error.code === '42P01' || lists.error.code === 'PGRST205') {
      return { lists: undefined, error: null, warning: 'List tables are not available. JSON will contain items only (v1).' }
    }
    return { lists: undefined, error: 'Could not read all lists. Export cancelled to avoid an incomplete backup.', warning: null }
  }
  const links = await readAllOwnedBackupRows<Membership>(supabase, user.id, 'id, list_id, item_id', 'list_items')
  if (links.error) return { lists: undefined, error: 'Could not read all list memberships. Export cancelled.', warning: null }
  const items = new Set(ownedItemIds)
  const listIds = new Set((lists.data ?? []).map((list) => list.id))
  const refs = new Map<string, Set<string>>()
  for (const row of links.data ?? []) {
    if (!items.has(row.item_id) || !listIds.has(row.list_id)) {
      return { lists: undefined, error: 'Your vault changed during export or contains unavailable list items. Refresh and try again.', warning: null }
    }
    const ids = refs.get(row.list_id) ?? new Set<string>()
    ids.add(row.item_id)
    refs.set(row.list_id, ids)
  }
  return {
    lists: (lists.data ?? []).map((list) => ({ ...list, item_ids: [...(refs.get(list.id) ?? [])] })),
    error: null, warning: null,
  }
}
