import { formatExternalRatingValue, getAllowedStatuses, type MediaItem, type MediaItemInput, type MediaItemRecord } from './media'
import { getProviderReference } from './provider-details'
import type { VaultExportList } from './backup-collections'

const APP_NAME = 'Media Vault'

export type VaultExportItem = {
  completed_at: string | null
  created_at: string | null
  external_id?: string | null
  external_rating_label: string | null
  external_rating_value: number | null
  external_source?: string | null
  favorite: boolean
  genres: string[]
  id: string
  image_url: string | null
  last_progress_at: string | null
  notes: string
  progress: number
  rating: number | null
  started_at: string | null
  status: string
  title: string
  total_progress: number | null
  type: string
}

type BackupBase = {
  app: typeof APP_NAME
  exported_at: string
  items: VaultExportItem[]
}
export type BackupPayload = BackupBase & ({ version: 1 } | { version: 2; lists: VaultExportList[] })

type RestorableBackupItem = MediaItem | VaultExportItem

export function createBackupPayload(items: RestorableBackupItem[], lists?: VaultExportList[]): BackupPayload {
  return {
    app: APP_NAME,
    exported_at: new Date().toISOString(),
    items: items.map(toVaultExportItem),
    ...(lists === undefined ? { version: 1 as const } : {
      version: 2 as const,
      lists: lists.map((list) => ({ id: list.id, name: list.name, description: list.description, item_ids: [...list.item_ids] })),
    }),
  }
}

export function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== 'object') {
    return false
  }

  const payload = value as Partial<BackupPayload>

  return Array.isArray(payload.items) && ((payload.version === 1 && (payload.app === undefined || payload.app === APP_NAME)) ||
    (payload.version === 2 && payload.app === APP_NAME && 'lists' in payload && Array.isArray(payload.lists)))
}

export function extractBackupItems(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return null
  const payload = value as Record<string, unknown>
  if (payload.app !== undefined && payload.app !== APP_NAME) return null
  if (payload.version !== undefined && payload.version !== 1 && payload.version !== 2) return null
  if (payload.version === 2 && (payload.app !== APP_NAME || !Array.isArray(payload.lists))) return null
  return Array.isArray(payload.items) ? payload.items : null
}

export function getBackupExternalKey(item: { type?: string | null; external_source?: string | null; external_id?: string | null }) {
  const source = item.external_source?.trim().toLowerCase()
  const id = item.external_id?.trim()
  if (!source || !id || !item.type) return null
  const ref = getProviderReference({ type: item.type, externalSource: source, externalId: id })
  if (ref?.provider === 'anilist') return `${ref.isMalId ? 'myanimelist' : 'anilist'}::${ref.type}::${ref.id}`
  if (ref?.provider === 'tmdb') return `tmdb::${ref.type}::${ref.id}`
  return `${source}::${item.type}::${id}`
}

export function getBackupTrackingError(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Invalid backup row.'
  const item = value as Record<string, unknown>
  if (item.notes != null && typeof item.notes !== 'string') return 'Notes must be text.'
  if (item.created_at != null && item.created_at !== '' && (
    typeof item.created_at !== 'string' || Number.isNaN(new Date(item.created_at).getTime())
  )) return 'Added date must be a valid timestamp or empty.'
  if (item.progress != null && (typeof item.progress !== 'number' || !Number.isInteger(item.progress) || item.progress < 0)) return 'Progress must be a whole number of 0 or more.'
  if (item.total_progress != null && (typeof item.total_progress !== 'number' || !Number.isInteger(item.total_progress) || item.total_progress < 1)) return 'Total progress must be a positive whole number.'
  const total = item.type === 'Movie' ? 1 : item.total_progress
  if (typeof item.progress === 'number' && typeof total === 'number' && item.progress > total) return 'Progress cannot exceed the total.'
  if (item.rating != null && (typeof item.rating !== 'number' || !Number.isInteger(item.rating) || item.rating < 1 || item.rating > 10)) return 'Rating must be 1-10.'
  if (item.external_rating_value != null && (typeof item.external_rating_value !== 'number' || !Number.isFinite(item.external_rating_value) || item.external_rating_value < 0 || item.external_rating_value > 10)) return 'Official rating must be 0-10.'
  if (typeof item.type === 'string' && typeof item.status === 'string' && !getAllowedStatuses(item.type).includes(item.status as ReturnType<typeof getAllowedStatuses>[number])) return 'Unsupported status for this media type.'
  return null
}

export function recordToVaultExportItem(record: MediaItemRecord): VaultExportItem {
  const item: VaultExportItem = {
    completed_at: record.completed_at ?? null,
    created_at: record.created_at ?? null,
    external_rating_label: record.external_rating_label ?? null,
    external_rating_value: numberOrNull(record.external_rating_value),
    favorite: record.favorite ?? false,
    genres: Array.isArray(record.genres) ? record.genres : [],
    id: record.id,
    image_url: record.image_url ?? null,
    last_progress_at: record.last_progress_at ?? null,
    notes: record.notes ?? '',
    progress: numberOrZero(record.progress),
    rating: numberOrNull(record.rating),
    started_at: record.started_at ?? null,
    status: record.status,
    title: record.title,
    total_progress: numberOrNull(record.total_progress),
    type: record.type,
  }

  if ('external_id' in record) {
    item.external_id = record.external_id ?? null
  }

  if ('external_source' in record) {
    item.external_source = record.external_source ?? null
  }

  return item
}

export function mediaItemToInput(item: RestorableBackupItem): MediaItemInput {
  return {
    completedAt: getDateValue(item, 'completedAt', 'completed_at'),
    externalRatingLabel: getStringValue(item, 'externalRatingLabel', 'external_rating_label'),
    externalRatingValue: getNumberInputValue(item, 'externalRatingValue', 'external_rating_value'),
    favorite: getBooleanValue(item, 'favorite'),
    genres: getGenresValue(item).join(', '),
    imageUrl: getStringValue(item, 'imageUrl', 'image_url'),
    notes: getStringValue(item, 'notes', 'notes'),
    progress: getNumberInputValue(item, 'progress', 'progress'),
    rating: getNumberInputValue(item, 'rating', 'rating'),
    startedAt: getDateValue(item, 'startedAt', 'started_at'),
    status: item.status,
    title: item.title,
    totalProgress: getNumberInputValue(item, 'totalProgress', 'total_progress'),
    type: item.type,
  }
}

export function getBackupFilename(date = new Date()) {
  return getVaultExportFilename('json', date)
}

export function getVaultExportFilename(format: 'json' | 'csv', date = new Date()) {
  const stamp = date.toISOString().slice(0, 10)
  return `media-vault-export-${stamp}.${format}`
}

export function serializeVaultExportJson(items: RestorableBackupItem[], lists?: VaultExportList[]) {
  return JSON.stringify(createBackupPayload(items, lists), null, 2)
}

export function serializeVaultExportCsv(items: RestorableBackupItem[]) {
  const exportItems = items.map(toVaultExportItem)
  const headers = [
    'ID',
    'Title',
    'Type',
    'Status',
    'Progress',
    'Total Progress',
    'My Rating',
    'Official Rating',
    'Official Rating Label',
    'Official Rating Value',
    'Favorite',
    'Genres',
    'Image URL',
    'External Source',
    'External ID',
    'Started At',
    'Completed At',
    'Last Progress At',
    'Created At',
    'Notes',
  ]

  const rows = exportItems.map((item) => [
    item.id,
    item.title,
    item.type,
    item.status,
    item.progress,
    item.total_progress,
    item.rating,
    formatExternalRating(item.external_rating_label, item.external_rating_value),
    item.external_rating_label,
    item.external_rating_value,
    item.favorite ? 'true' : 'false',
    item.genres.join('; '),
    item.image_url,
    item.external_source ?? '',
    item.external_id ?? '',
    item.started_at,
    item.completed_at,
    item.last_progress_at,
    item.created_at,
    item.notes,
  ])

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
}

function toVaultExportItem(item: RestorableBackupItem): VaultExportItem {
  if (isVaultExportItem(item)) {
    return {
      ...item,
      genres: [...item.genres],
      notes: item.notes ?? '',
      progress: numberOrZero(item.progress),
      rating: numberOrNull(item.rating),
      total_progress: numberOrNull(item.total_progress),
    }
  }

  return {
    completed_at: item.completedAt,
    created_at: item.createdAt,
    external_source: item.externalSource,
    external_id: item.externalId,
    external_rating_label: item.externalRatingLabel,
    external_rating_value: numberOrNull(item.externalRatingValue),
    favorite: item.favorite,
    genres: [...item.genres],
    id: item.id,
    image_url: item.imageUrl,
    last_progress_at: item.lastProgressAt,
    notes: item.notes ?? '',
    progress: numberOrZero(item.progress),
    rating: numberOrNull(item.rating),
    started_at: item.startedAt,
    status: item.status,
    title: item.title,
    total_progress: numberOrNull(item.totalProgress),
    type: item.type,
  }
}

function isVaultExportItem(item: RestorableBackupItem): item is VaultExportItem {
  return 'image_url' in item || 'total_progress' in item
}

function getDateValue(
  item: RestorableBackupItem,
  mediaKey: keyof MediaItem,
  exportKey: keyof VaultExportItem
) {
  const value = isVaultExportItem(item) ? item[exportKey] : item[mediaKey]
  return typeof value === 'string' ? value : ''
}

function getStringValue(
  item: RestorableBackupItem,
  mediaKey: keyof MediaItem,
  exportKey: keyof VaultExportItem
) {
  const value = isVaultExportItem(item) ? item[exportKey] : item[mediaKey]
  return typeof value === 'string' ? value : ''
}

function getNumberInputValue(
  item: RestorableBackupItem,
  mediaKey: keyof MediaItem,
  exportKey: keyof VaultExportItem
) {
  const value = isVaultExportItem(item) ? item[exportKey] : item[mediaKey]
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function getBooleanValue(item: RestorableBackupItem, key: keyof MediaItem & keyof VaultExportItem) {
  return isVaultExportItem(item) ? item[key] === true : item[key] === true
}

function getGenresValue(item: RestorableBackupItem) {
  return Array.isArray(item.genres) ? item.genres : []
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatExternalRating(label: string | null, value: number | null) {
  if (!label || typeof value !== 'number') {
    return ''
  }

  return formatExternalRatingValue(label, value)
}

function escapeCsvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ''
      : Array.isArray(value)
        ? value.join('; ')
        : String(value)

  return `"${text.replace(/"/g, '""')}"`
}
