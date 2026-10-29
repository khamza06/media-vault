import { isMovieType, usesPageProgress, type MediaItem } from './media'

export type ProgressSnapshot = {
  id: string
  progress: number
  total_progress: number | null
  status: string
  last_progress_at: string | null
  outcome: 'updated' | 'conflict' | 'complete'
}
export type ProgressExpectation = { progress: number; lastProgressAt: string | null }

export function canAdvanceProgress(item: Pick<MediaItem, 'type' | 'progress' | 'totalProgress'>) {
  const total = isMovieType(item.type) ? 1 : item.totalProgress
  return item.progress < 2147483647 && !(total && total > 0 && item.progress >= total)
}

export function applyProgressSnapshot(item: MediaItem, snapshot: ProgressSnapshot): MediaItem {
  return { ...item, progress: snapshot.progress, totalProgress: snapshot.total_progress,
    currentPage: usesPageProgress(item.type) ? snapshot.progress : null,
    currentEpisode: usesPageProgress(item.type) ? null : snapshot.progress,
    status: snapshot.status, lastProgressAt: snapshot.last_progress_at,
    lastActivityAt: snapshot.last_progress_at ?? item.lastActivityAt }
}

export function isProgressSnapshot(value: unknown, id: string): value is ProgressSnapshot {
  if (!value || typeof value !== 'object') return false
  const row = value as ProgressSnapshot
  return row.id === id && Number.isInteger(row.progress) && row.progress >= 0 &&
    (row.total_progress === null || (Number.isInteger(row.total_progress) && row.total_progress >= 0)) &&
    typeof row.status === 'string' && ['updated', 'conflict', 'complete'].includes(row.outcome) &&
    (row.last_progress_at === null || (typeof row.last_progress_at === 'string' && Number.isFinite(Date.parse(row.last_progress_at))))
}
