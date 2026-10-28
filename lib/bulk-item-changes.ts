import { getAllowedStatuses, mediaTypes, mediaStatuses, type MediaItem } from './media'

export type BulkItemChange = { kind: 'status'; status: string } | { kind: 'favorite'; favorite: boolean }

export function parseBulkItemChange(value: unknown): BulkItemChange | null {
  if (!value || typeof value !== 'object' || !('kind' in value)) return null
  if (value.kind === 'favorite' && 'favorite' in value && typeof value.favorite === 'boolean') {
    return { kind: 'favorite', favorite: value.favorite }
  }
  if (value.kind === 'status' && 'status' in value && typeof value.status === 'string'
    && mediaStatuses.includes(value.status as typeof mediaStatuses[number])) {
    return { kind: 'status', status: value.status }
  }
  return null
}

export function parseBulkItemIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) return null
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (value.some((id) => typeof id !== 'string' || !pattern.test(id))) return null
  return [...new Set((value as string[]).map((id) => id.toLowerCase()))]
}

export function needsBulkItemChange(item: { type: string; status: string; favorite: boolean | null }, change: BulkItemChange) {
  if (change.kind === 'favorite') return Boolean(item.favorite) !== change.favorite
  return (mediaTypes as readonly string[]).includes(item.type) && getAllowedStatuses(item.type).includes(change.status as typeof mediaStatuses[number])
    && item.status.trim().toLowerCase() !== change.status.toLowerCase()
}

export function applyBulkItemChange(items: MediaItem[], change: BulkItemChange, updatedIds: string[]) {
  const ids = new Set(updatedIds)
  return items.map((item) => !ids.has(item.id) ? item : change.kind === 'status'
    ? { ...item, status: change.status } : { ...item, favorite: change.favorite })
}
