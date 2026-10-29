import type { MediaItem } from './media'
import { canAdvanceProgress } from './progress'

export function isInProgressItem(item: Pick<MediaItem, 'status'>) {
  return ['watching', 'reading', 're-watching'].includes(item.status.trim().toLowerCase())
}

function validTimestamp(value: string | null) {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

function activityTimestamp(item: MediaItem) {
  return validTimestamp(item.lastProgressAt)
    ?? validTimestamp(item.lastActivityAt)
    ?? validTimestamp(item.createdAt)
    ?? 0
}

// Call with the current filtered vault, not a separately fetched library.
export function getContinueItems(items: readonly MediaItem[]) {
  return items
    .filter(item => isInProgressItem(item) && canAdvanceProgress(item))
    .sort((left, right) => activityTimestamp(right) - activityTimestamp(left)
      || left.id.localeCompare(right.id))
    .slice(0, 6)
}
