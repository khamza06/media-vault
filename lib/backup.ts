import { formatExternalRatingValue, type MediaItem, type MediaItemInput, type MediaItemRecord } from './media'

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

export type BackupPayload = {
  app: typeof APP_NAME
  exported_at: string
  items: VaultExportItem[]
  version: 1
}

type RestorableBackupItem = MediaItem | VaultExportItem

export function createBackupPayload(items: RestorableBackupItem[]): BackupPayload {
  return {
    app: APP_NAME,
    exported_at: new Date().toISOString(),
    items: items.map(toVaultExportItem),
    version: 1,
  }
}

export function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== 'object') {
    return false
  }

  const payload = value as Partial<BackupPayload>

  return payload.version === 1 && Array.isArray(payload.items)
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

export function serializeVaultExportJson(items: RestorableBackupItem[]) {
  return JSON.stringify(createBackupPayload(items), null, 2)
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
