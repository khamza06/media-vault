import 'server-only'

import type { MediaItemRecord } from '../media'
import { createSupabaseServerClient } from '../supabase/server'

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
  const result = await createSupabaseServerClient().from('public_items')
    .select(publicItemSelectFields).eq('user_id', userId)
    .order('last_progress_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  return { ...result, data: result.error ? null : publicItemRecords(result.data) }
}
