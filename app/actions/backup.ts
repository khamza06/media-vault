'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '../../lib/auth/dal'
import { createBackupPayload, type VaultExportItem } from '../../lib/backup'
import { getItems } from '../../lib/data/items'
import {
  getAllowedStatuses,
  isMovieType,
  mediaTypes,
  toMediaItem,
  type MediaItemRecord,
  type MediaType,
} from '../../lib/media'
import { shelfDefinitions } from '../../lib/shelves'
import { createSupabaseServerClient } from '../../lib/supabase/server'

type BackupRestoreResult = {
  error: string | null
  failed: number
  invalid: number
  restored: number
  skipped: number
  success: boolean
  usedExternalIdColumns: boolean
}

type ExistingItemLookup = {
  external_id?: string | null
  external_source?: string | null
  title?: string | null
  type?: string | null
}

type ValidatedBackupRestoreItem = {
  completedAt: string | null
  externalId: string | null
  externalRatingLabel: string | null
  externalRatingValue: number | null
  externalSource: string | null
  favorite: boolean
  genres: string[]
  imageUrl: string | null
  lastProgressAt: string | null
  notes: string
  progress: number
  rating: number | null
  startedAt: string | null
  status: string
  title: string
  totalProgress: number | null
  type: MediaType
}

type RestoreInsertRow = {
  completed_at: string | null
  external_rating_label: string | null
  external_rating_value: number | null
  favorite: boolean
  genres: string[]
  image_url: string | null
  last_progress_at: string | null
  notes: string
  progress: number
  rating: number | null
  started_at: string | null
  status: string
  title: string
  total_progress: number | null
  type: MediaType
  user_id: string
}

type RestoreInsertRowWithExternalMetadata = RestoreInsertRow & {
  external_id?: string | null
  external_source?: string | null
}

const MAX_RESTORE_ITEMS = 2000

function isMissingColumnError(message?: string | null) {
  return Boolean(
    message &&
      (/column .* does not exist/i.test(message) ||
        /Could not find the .* column/i.test(message) ||
        /schema cache/i.test(message))
  )
}

function normalizeComparableTitle(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
}

function sanitizeText(value: unknown, options?: { maxLength?: number; preserveWhitespace?: boolean }) {
  if (typeof value !== 'string') {
    return ''
  }

  const text = options?.preserveWhitespace ? value : value.trim()
  return options?.maxLength ? text.slice(0, options.maxLength) : text
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : value
}

function normalizeInteger(value: unknown, options: { max?: number; min: number }) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = typeof value === 'number' ? value : Number(value)

  if (!Number.isInteger(number) || number < options.min) {
    return null
  }

  if (typeof options.max === 'number' && number > options.max) {
    return null
  }

  return number
}

function normalizeNumber(value: unknown, options: { max: number; min: number }) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(number) || number < options.min || number > options.max) {
    return null
  }

  return number
}

function normalizeBoolean(value: unknown) {
  return value === true
}

function normalizeGenres(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((genre) => (typeof genre === 'string' ? genre.trim() : ''))
    .filter(Boolean)
    .slice(0, 24)
}

function validateBackupRestoreItem(value: unknown): ValidatedBackupRestoreItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const item = value as Partial<VaultExportItem>
  const title = sanitizeText(item.title, { maxLength: 180 })
  const type = sanitizeText(item.type)

  if (!title || !mediaTypes.includes(type as MediaType)) {
    return null
  }

  const allowedStatuses = getAllowedStatuses(type)
  const status = sanitizeText(item.status)

  if (!allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
    return null
  }

  const progress = normalizeInteger(item.progress, { min: 0 }) ?? 0
  const totalProgress = normalizeInteger(item.total_progress, { min: 1 })
  const movieTotalProgress = isMovieType(type) ? 1 : totalProgress
  const nextProgress =
    typeof movieTotalProgress === 'number' && movieTotalProgress > 0
      ? Math.min(progress, movieTotalProgress)
      : progress
  const nextStatus = isMovieType(type) && nextProgress >= 1 ? 'Completed' : status

  return {
    completedAt: normalizeDate(item.completed_at),
    externalId: sanitizeText(item.external_id ?? '', { maxLength: 120 }) || null,
    externalRatingLabel:
      sanitizeText(item.external_rating_label ?? '', { maxLength: 40 }) || null,
    externalRatingValue: normalizeNumber(item.external_rating_value, { max: 10, min: 0 }),
    externalSource:
      sanitizeText(item.external_source ?? '', { maxLength: 40 }).toLocaleLowerCase('en-US') ||
      null,
    favorite: normalizeBoolean(item.favorite),
    genres: normalizeGenres(item.genres),
    imageUrl: sanitizeText(item.image_url ?? '', { maxLength: 1000 }) || null,
    lastProgressAt: normalizeDate(item.last_progress_at) ?? (nextProgress > 0 ? new Date().toISOString() : null),
    notes: sanitizeText(item.notes ?? '', { preserveWhitespace: true }),
    progress: nextProgress,
    rating: normalizeInteger(item.rating, { max: 10, min: 1 }),
    startedAt: normalizeDate(item.started_at),
    status: nextStatus,
    title,
    totalProgress: movieTotalProgress,
    type: type as MediaType,
  }
}

function toRestoreInsertRow(item: ValidatedBackupRestoreItem, userId: string): RestoreInsertRow {
  return {
    completed_at: item.completedAt,
    external_rating_label: item.externalRatingLabel,
    external_rating_value: item.externalRatingValue,
    favorite: item.favorite,
    genres: item.genres,
    image_url: item.imageUrl,
    last_progress_at: item.lastProgressAt,
    notes: item.notes,
    progress: item.progress,
    rating: item.rating,
    started_at: item.startedAt,
    status: item.status,
    title: item.title,
    total_progress: item.totalProgress,
    type: item.type,
    user_id: userId,
  }
}

function toCompatibilityRestoreRow(row: RestoreInsertRow) {
  return {
    completed_at: row.completed_at,
    favorite: row.favorite,
    genres: row.genres,
    image_url: row.image_url,
    notes: row.notes,
    progress: row.progress,
    rating: row.rating,
    started_at: row.started_at,
    status: row.status,
    title: row.title,
    total_progress: row.total_progress,
    type: row.type,
    user_id: row.user_id,
  }
}

async function revalidateBackupRestorePaths(userId: string) {
  revalidatePath('/')
  revalidatePath('/backup')
  revalidatePath('/import')
  revalidatePath('/library')
  revalidatePath('/lists')
  revalidatePath('/stats')
  revalidatePath('/summary')
  revalidatePath(`/public/${userId}`)
  revalidatePath(`/share/${userId}`)

  for (const shelf of shelfDefinitions) {
    revalidatePath(`/shelves/${shelf.slug}`)
  }
}

export async function restoreBackupItemsAction(
  candidates: VaultExportItem[]
): Promise<BackupRestoreResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      error: 'Please sign in before restoring a backup.',
      failed: 0,
      invalid: 0,
      restored: 0,
      skipped: 0,
      success: false,
      usedExternalIdColumns: false,
    }
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      error: 'Select at least one backup item to restore.',
      failed: 0,
      invalid: 0,
      restored: 0,
      skipped: 0,
      success: false,
      usedExternalIdColumns: false,
    }
  }

  if (candidates.length > MAX_RESTORE_ITEMS) {
    return {
      error: `Please restore ${MAX_RESTORE_ITEMS} items or fewer at once.`,
      failed: candidates.length,
      invalid: 0,
      restored: 0,
      skipped: 0,
      success: false,
      usedExternalIdColumns: false,
    }
  }

  const validatedItems = candidates
    .map(validateBackupRestoreItem)
    .filter((item): item is ValidatedBackupRestoreItem => item !== null)
  const invalid = candidates.length - validatedItems.length

  if (validatedItems.length === 0) {
    return {
      error: 'No valid Media Vault items were found in the selected backup.',
      failed: candidates.length,
      invalid,
      restored: 0,
      skipped: 0,
      success: false,
      usedExternalIdColumns: false,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const existingWithExternalResult = await supabase
    .from('items')
    .select('title, type, external_source, external_id')
    .eq('user_id', user.id)

  let usedExternalIdColumns = !existingWithExternalResult.error
  let existingRows: ExistingItemLookup[] = existingWithExternalResult.data ?? []

  if (existingWithExternalResult.error) {
    if (!isMissingColumnError(existingWithExternalResult.error.message)) {
      return {
        error: existingWithExternalResult.error.message,
        failed: validatedItems.length,
        invalid,
        restored: 0,
        skipped: 0,
        success: false,
        usedExternalIdColumns: false,
      }
    }

    const existingTitleResult = await supabase
      .from('items')
      .select('title, type')
      .eq('user_id', user.id)

    usedExternalIdColumns = false
    existingRows = existingTitleResult.data ?? []

    if (existingTitleResult.error) {
      return {
        error: existingTitleResult.error.message,
        failed: validatedItems.length,
        invalid,
        restored: 0,
        skipped: 0,
        success: false,
        usedExternalIdColumns: false,
      }
    }
  }

  const existingTitleKeys = new Set(
    existingRows.map(
      (item) => `${item.type ?? ''}::${normalizeComparableTitle(item.title ?? '')}`
    )
  )
  const existingExternalKeys = new Set(
    existingRows
      .filter((item) => item.external_source && item.external_id)
      .map((item) => `${item.external_source}::${item.external_id}`)
  )
  const incomingTitleKeys = new Set<string>()
  const incomingExternalKeys = new Set<string>()
  const rowsToInsert: RestoreInsertRowWithExternalMetadata[] = []
  let skipped = invalid

  for (const item of validatedItems) {
    const titleKey = `${item.type}::${normalizeComparableTitle(item.title)}`
    const externalKey =
      usedExternalIdColumns && item.externalSource && item.externalId
        ? `${item.externalSource}::${item.externalId}`
        : null

    if (
      existingTitleKeys.has(titleKey) ||
      incomingTitleKeys.has(titleKey) ||
      (externalKey !== null &&
        (existingExternalKeys.has(externalKey) || incomingExternalKeys.has(externalKey)))
    ) {
      skipped += 1
      continue
    }

    incomingTitleKeys.add(titleKey)

    if (externalKey) {
      incomingExternalKeys.add(externalKey)
    }

    const row = toRestoreInsertRow(item, user.id)
    rowsToInsert.push(
      usedExternalIdColumns && item.externalSource
        ? {
            ...row,
            external_id: item.externalId,
            external_source: item.externalSource,
          }
        : row
    )
  }

  if (rowsToInsert.length === 0) {
    return {
      error: null,
      failed: 0,
      invalid,
      restored: 0,
      skipped,
      success: true,
      usedExternalIdColumns,
    }
  }

  const fullInsert = await supabase.from('items').insert(rowsToInsert).select('id')

  if (!fullInsert.error) {
    await revalidateBackupRestorePaths(user.id)
    return {
      error: null,
      failed: 0,
      invalid,
      restored: fullInsert.data?.length ?? rowsToInsert.length,
      skipped,
      success: true,
      usedExternalIdColumns,
    }
  }

  if (!isMissingColumnError(fullInsert.error.message)) {
    return {
      error: fullInsert.error.message,
      failed: rowsToInsert.length,
      invalid,
      restored: 0,
      skipped,
      success: false,
      usedExternalIdColumns,
    }
  }

  const compatibilityRows = rowsToInsert.map((row) => {
    const compatibilityRow = toCompatibilityRestoreRow(row)

    if (!usedExternalIdColumns || !row.external_source) {
      return compatibilityRow
    }

    return {
      ...compatibilityRow,
      external_id: row.external_id ?? null,
      external_source: row.external_source,
    }
  })
  let compatibilityInsert = await supabase.from('items').insert(compatibilityRows).select('id')

  if (compatibilityInsert.error && usedExternalIdColumns) {
    const rowsWithoutExternalMetadata = rowsToInsert.map((row) =>
      toCompatibilityRestoreRow(row)
    )
    compatibilityInsert = await supabase.from('items').insert(rowsWithoutExternalMetadata).select('id')
    usedExternalIdColumns = false
  }

  if (compatibilityInsert.error) {
    return {
      error: compatibilityInsert.error.message,
      failed: rowsToInsert.length,
      invalid,
      restored: 0,
      skipped,
      success: false,
      usedExternalIdColumns,
    }
  }

  await revalidateBackupRestorePaths(user.id)
  return {
    error: null,
    failed: 0,
    invalid,
    restored: compatibilityInsert.data?.length ?? compatibilityRows.length,
    skipped,
    success: true,
    usedExternalIdColumns,
  }
}

export async function previewBackupAction() {
  const result = await getItems()
  if (result.error) {
    throw new Error(result.error.message)
  }

  return createBackupPayload(((result.data ?? []) as MediaItemRecord[]).map(toMediaItem))
}
