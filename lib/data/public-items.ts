import 'server-only'

import type { MediaItemRecord } from '../media'
import { createSupabaseServerClient } from '../supabase/server'
import { readAllOwnedBackupRows } from './backup-items'

// Fixed projection: never add private fields or fall back to the base table.
export const publicItemFields = [
  'id', 'user_id', 'title', 'type', 'status', 'progress', 'total_progress',
  'last_progress_at', 'rating', 'image_url', 'started_at', 'completed_at',
  'favorite', 'genres', 'external_rating_label', 'external_rating_value',
  'external_source', 'external_id', 'created_at',
] as const
export const publicItemSelectFields = publicItemFields.join(', ')

export function publicItemRecords(rows: unknown): MediaItemRecord[] {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => Object.fromEntries(publicItemFields
    .filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]])) as MediaItemRecord)
}

export async function getPublicItemsByUserId(userId: string) {
  const result = await readAllOwnedBackupRows<MediaItemRecord>(
    createSupabaseServerClient(), userId, publicItemSelectFields, 'public_items'
  )
  return { ...result, data: result.error ? null : sortRecentItems(publicItemRecords(result.data)) }
}

export function sortRecentItems<T extends { id: string; last_progress_at?: string | null; created_at?: string | null }>(rows: T[]) {
  const date = (value?: string | null) => value ? new Date(value).getTime() || 0 : 0
  return [...rows].sort((a, b) => date(b.last_progress_at) - date(a.last_progress_at) ||
    date(b.created_at) - date(a.created_at) || a.id.localeCompare(b.id))
}
