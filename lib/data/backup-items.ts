import 'server-only'

import type { createSupabaseServerClient } from '../supabase/server'

export async function readAllOwnedBackupItems<T extends { id: string }>(
  supabase: ReturnType<typeof createSupabaseServerClient>, userId: string, fields: string
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  return readAllOwnedBackupRows<T>(supabase, userId, fields, 'items')
}

export async function readAllOwnedBackupRows<T extends { id: string }>(
  supabase: ReturnType<typeof createSupabaseServerClient>, userId: string, fields: string,
  table: 'items' | 'public_items' | 'lists' | 'list_items',
  filters?: { listId?: string; publicListsOnly?: boolean }
): Promise<{ data: T[] | null; error: { message: string; code?: string } | null }> {
  const rows: T[] = []
  let cursor: string | null = null
  while (true) {
    let query = supabase.from(table).select(fields).eq('user_id', userId)
      .order('id', { ascending: true }).limit(500)
    if (filters?.listId) query = query.eq('list_id', filters.listId)
    if (filters?.publicListsOnly) query = query.eq('is_public', true).not('slug', 'is', null)
    if (cursor) query = query.gt('id', cursor)
    const page = await query.overrideTypes<T[], { merge: false }>()
    if (page.error) return { data: null, error: page.error }
    const items = page.data ?? []
    if (items.length === 0) return { data: rows, error: null }
    const next = items.at(-1)?.id
    if (typeof next !== 'string' || !next || (cursor !== null && next <= cursor)) {
      return { data: null, error: { message: 'Could not read all backup items safely.' } }
    }
    rows.push(...items)
    cursor = next
    // Continue to an empty page: a project may configure a lower API row cap.
  }
}
