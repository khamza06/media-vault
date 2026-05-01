'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '../../lib/auth/dal'
import { findAniListImportMetadata } from '../../lib/anilist-import-enrichment'
import { deleteOwnedCoverByPublicUrl } from '../../lib/data/storage'
import { normalizeGenreList } from '../../lib/genres'
import {
  getAllowedStatuses,
  getDefaultStatus,
  mediaTypes,
  type MediaType,
} from '../../lib/media'
import { shelfDefinitions } from '../../lib/shelves'
import { createSupabaseServerClient } from '../../lib/supabase/server'

export type MalImportCandidate = {
  title: string
  type: 'anime' | 'manga'
  status?: string
  rating?: number | null
  progress?: number | null
  external_source: 'myanimelist'
  external_id?: string | null
  external_url?: string | null
  notes: string
}

export type AniListImportCandidate = {
  description?: string | null
  external_id?: string | null
  external_score?: number | null
  external_source: 'anilist'
  genres?: string[] | null
  image_url?: string | null
  notes: string
  progress?: number | null
  rating?: number | null
  status?: string
  title: string
  total_progress?: number | null
  type: 'anime' | 'manga' | 'manhwa' | 'manhua'
}

export type CsvImportCandidate = {
  external_id?: string | null
  external_source?: string | null
  image_url?: string | null
  notes: string
  progress?: number | null
  rating?: number | null
  status?: string
  title: string
  type: 'anime' | 'book' | 'manga' | 'manhua' | 'manhwa' | 'movie' | 'series'
}

type ValidatedMalImportItem = {
  externalId: string | null
  externalUrl: string | null
  image_url: null
  notes: string
  progress: number
  rating: number | null
  status: string
  title: string
  type: 'Anime' | 'Manga'
}

type ValidatedAniListImportItem = {
  externalId: string | null
  externalRatingValue: number | null
  genres: string[]
  image_url: string | null
  notes: string
  progress: number
  rating: number | null
  status: string
  title: string
  totalProgress: number | null
  type: 'Anime' | 'Manga' | 'Manhwa' | 'Manhua'
}

type ValidatedCsvImportItem = {
  externalId: string | null
  externalSource: string | null
  image_url: string | null
  notes: string
  progress: number
  rating: number | null
  status: string
  title: string
  type: MediaType
}

type ImportRow = {
  completed_at: null
  external_rating_label: string | null
  external_rating_value: number | null
  favorite: false
  genres: string[]
  image_url: string | null
  last_progress_at: string | null
  notes: string
  progress: number
  rating: number | null
  started_at: null
  status: string
  title: string
  total_progress: number | null
  type: MediaType
  user_id: string
}

type ExistingItemLookup = {
  external_id?: string | null
  external_source?: string | null
  title?: string | null
  type?: string | null
}

type ImportRowWithExternalMetadata = ImportRow & {
  external_id?: string | null
  external_source?: string | null
  external_url?: string | null
}

export type MalImportResult = {
  enriched: number
  error: string | null
  imported: number
  skipped: number
  failed: number
  usedExternalIdColumns: boolean
}

export type AniListFetchResult = {
  candidates: AniListImportCandidate[]
  error: string | null
  warning: string | null
}

export type AniListImportResult = {
  error: string | null
  failed: number
  imported: number
  skipped: number
  usedExternalIdColumns: boolean
}

export type CsvImportResult = {
  error: string | null
  failed: number
  imported: number
  invalid: number
  skipped: number
  usedExternalIdColumns: boolean
}

export type MissingCoverEnrichmentResult = {
  checked: number
  error: string | null
  failed: number
  foundByJikan: number
  foundByMalId: number
  foundByTitle: number
  skipped: number
  updated: number
}

export type DeleteMyAnimeListImportsResult = {
  deleted: number
  error: string | null
  success: boolean
}

type ImportQueueItem = {
  item: ValidatedMalImportItem
  row: ImportRowWithExternalMetadata
}

type AniListImportQueueItem = {
  item: ValidatedAniListImportItem
  row: ImportRowWithExternalMetadata
}

type MissingCoverItem = {
  external_id?: string | null
  external_source?: string | null
  id: string
  image_url?: string | null
  title?: string | null
  type?: string | null
}

type MissingCoverUpdateRow = {
  external_rating_label?: string | null
  external_rating_value?: number | null
  genres?: string[]
  image_url: string
  total_progress?: number | null
}

const ENRICHMENT_BATCH_SIZE = 4
const MISSING_COVER_BATCH_SIZE = 25
const MAX_IMPORT_ITEMS = 2000
const ANIME_MANGA_TYPES = ['Anime', 'Manga', 'Manhwa', 'Manhua'] as const
const ANILIST_LIST_QUERY = `
  query AniListImportCollection($userName: String!, $type: MediaType!) {
    MediaListCollection(userName: $userName, type: $type) {
      lists {
        name
        entries {
          status
          score
          progress
          media {
            id
            idMal
            type
            format
            countryOfOrigin
            episodes
            chapters
            averageScore
            genres
            description(asHtml: false)
            siteUrl
            coverImage {
              extraLarge
              large
            }
            title {
              english
              romaji
              native
            }
          }
        }
      }
    }
  }
`

type AniListMediaType = 'ANIME' | 'MANGA'
type AniListMediaListStatus =
  | 'COMPLETED'
  | 'CURRENT'
  | 'DROPPED'
  | 'PAUSED'
  | 'PLANNING'
  | 'REPEATING'
  | string

type AniListListEntry = {
  media?: {
    averageScore?: number | null
    chapters?: number | null
    countryOfOrigin?: string | null
    coverImage?: {
      extraLarge?: string | null
      large?: string | null
    } | null
    description?: string | null
    episodes?: number | null
    format?: string | null
    genres?: string[] | null
    id?: number | null
    idMal?: number | null
    siteUrl?: string | null
    title?: {
      english?: string | null
      native?: string | null
      romaji?: string | null
    } | null
    type?: AniListMediaType | null
  } | null
  progress?: number | null
  score?: number | null
  status?: AniListMediaListStatus | null
}

type AniListCollectionResponse = {
  data?: {
    MediaListCollection?: {
      lists?: Array<{
        entries?: AniListListEntry[] | null
        name?: string | null
      }> | null
    } | null
  } | null
  errors?: Array<{ message?: string | null }> | null
}

type AniListCollectionResult = {
  entries: AniListListEntry[]
  error: string | null
}

function normalizeComparableTitle(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
}

function normalizeRating(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const rating = typeof value === 'number' ? value : Number(value)

  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    return null
  }

  return rating
}

function normalizeProgress(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return 0
  }

  const progress = typeof value === 'number' ? value : Number(value)

  if (!Number.isInteger(progress) || progress < 0) {
    return 0
  }

  return progress
}

function normalizeStatus(value: string | undefined, type: ValidatedMalImportItem['type']) {
  const status = (value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ')

  if (type === 'Anime') {
    switch (status) {
      case 'watching':
        return 'Watching'
      case 'completed':
        return 'Completed'
      case 'dropped':
        return 'Dropped'
      case 'plan to watch':
      case 'planning':
      case 'planned':
      case 'on hold':
      default:
        return 'Planning'
    }
  }

  switch (status) {
    case 'reading':
    case 'watching':
      return 'Reading'
    case 'completed':
      return 'Completed'
    case 'dropped':
      return 'Dropped'
    case 'plan to read':
    case 'planning':
    case 'planned':
    case 'on hold':
    default:
      return 'Planning'
  }
}

function normalizeAniListStatus(
  value: string | undefined | null,
  type: ValidatedAniListImportItem['type']
) {
  const status = (value ?? '').trim().toUpperCase()
  const isPaged = type === 'Manga' || type === 'Manhwa' || type === 'Manhua'

  switch (status) {
    case 'WATCHING':
      return 'Watching'
    case 'READING':
      return 'Reading'
    case 'CURRENT':
      return isPaged ? 'Reading' : 'Watching'
    case 'COMPLETED':
      return 'Completed'
    case 'DROPPED':
      return 'Dropped'
    case 'REPEATING':
      return isPaged ? 'Reading' : 'Re-Watching'
    case 'PAUSED':
    case 'PLANNING':
    default:
      return 'Planning'
  }
}

function normalizeAniListUserRating(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const rating = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(rating) || rating <= 0) {
    return null
  }

  const normalized = rating > 10 ? rating / 10 : rating
  const rounded = Math.round(normalized)

  if (rounded < 1 || rounded > 10) {
    return null
  }

  return rounded
}

function normalizeAniListExternalScore(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const score = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(score) || score <= 0) {
    return null
  }

  const normalized = score > 10 ? score / 10 : score

  if (normalized < 0 || normalized > 10) {
    return null
  }

  return Math.round(normalized * 10) / 10
}

function normalizeNullableProgress(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const progress = typeof value === 'number' ? value : Number(value)

  if (!Number.isInteger(progress) || progress < 0) {
    return null
  }

  return progress
}

function getAniListTitle(entry: AniListListEntry) {
  const title = entry.media?.title
  return title?.english?.trim() || title?.romaji?.trim() || title?.native?.trim() || ''
}

function getAniListCover(entry: AniListListEntry) {
  return entry.media?.coverImage?.extraLarge ?? entry.media?.coverImage?.large ?? null
}

function getAniListAppType(entry: AniListListEntry): AniListImportCandidate['type'] | null {
  if (entry.media?.type === 'ANIME') {
    return 'anime'
  }

  if (entry.media?.type !== 'MANGA') {
    return null
  }

  switch ((entry.media.countryOfOrigin ?? '').toUpperCase()) {
    case 'KR':
      return 'manhwa'
    case 'CN':
    case 'TW':
    case 'HK':
      return 'manhua'
    default:
      return 'manga'
  }
}

function getAppTypeFromAniListCandidateType(
  type: AniListImportCandidate['type']
): ValidatedAniListImportItem['type'] | null {
  switch (type) {
    case 'anime':
      return 'Anime'
    case 'manga':
      return 'Manga'
    case 'manhwa':
      return 'Manhwa'
    case 'manhua':
      return 'Manhua'
    default:
      return null
  }
}

function toAniListImportCandidate(entry: AniListListEntry): AniListImportCandidate | null {
  const title = getAniListTitle(entry)
  const type = getAniListAppType(entry)

  if (!title || !type || !entry.media?.id) {
    return null
  }

  const totalProgress =
    entry.media.type === 'ANIME'
      ? normalizeNullableProgress(entry.media.episodes)
      : normalizeNullableProgress(entry.media.chapters)

  return {
    description: entry.media.description ?? null,
    external_id: String(entry.media.id),
    external_score: normalizeAniListExternalScore(entry.media.averageScore),
    external_source: 'anilist',
    genres: normalizeGenreList(entry.media.genres ?? []),
    image_url: getAniListCover(entry),
    notes: '',
    progress: normalizeNullableProgress(entry.progress),
    rating: normalizeAniListUserRating(entry.score),
    status: normalizeAniListStatus(
      entry.status,
      getAppTypeFromAniListCandidateType(type) ?? 'Manga'
    ),
    title,
    total_progress: totalProgress,
    type,
  }
}

function validateCandidate(candidate: MalImportCandidate): ValidatedMalImportItem | null {
  if (candidate.external_source !== 'myanimelist') {
    return null
  }

  const title = typeof candidate.title === 'string' ? candidate.title.trim() : ''

  if (!title) {
    return null
  }

  const type =
    candidate.type === 'anime' ? 'Anime' : candidate.type === 'manga' ? 'Manga' : null

  if (!type) {
    return null
  }

  const providedExternalId =
    typeof candidate.external_id === 'string' && candidate.external_id.trim()
      ? candidate.external_id.trim()
      : null
  const externalId = providedExternalId ?? buildStableMyAnimeListId(title, type)

  return {
    externalId,
    externalUrl: normalizeMyAnimeListUrl(candidate.external_url, type, externalId),
    image_url: null,
    notes: typeof candidate.notes === 'string' ? candidate.notes : '',
    progress: normalizeProgress(candidate.progress),
    rating: normalizeRating(candidate.rating),
    status: normalizeStatus(candidate.status, type),
    title,
    type,
  }
}

function buildStableMyAnimeListId(title: string, type: 'Anime' | 'Manga') {
  const titleKey = normalizeComparableTitle(title)

  if (!titleKey) {
    return null
  }

  return `${type.toLowerCase()}::${titleKey}`
}

function buildMyAnimeListUrl(type: 'Anime' | 'Manga', externalId: string | null) {
  if (!externalId || !/^\d+$/.test(externalId)) {
    return null
  }

  return `https://myanimelist.net/${type === 'Anime' ? 'anime' : 'manga'}/${externalId}`
}

function normalizeMyAnimeListUrl(
  value: unknown,
  type: 'Anime' | 'Manga',
  externalId: string | null
) {
  const fallbackUrl = buildMyAnimeListUrl(type, externalId)

  if (typeof value !== 'string' || !value.trim()) {
    return fallbackUrl
  }

  try {
    const url = new URL(value.trim())
    const hostname = url.hostname.toLowerCase()

    if (url.protocol === 'https:' && (hostname === 'myanimelist.net' || hostname === 'www.myanimelist.net')) {
      return url.toString()
    }
  } catch {
    return fallbackUrl
  }

  return fallbackUrl
}

function validateAniListCandidate(
  candidate: AniListImportCandidate
): ValidatedAniListImportItem | null {
  if (candidate.external_source !== 'anilist') {
    return null
  }

  const title = typeof candidate.title === 'string' ? candidate.title.trim() : ''

  if (!title) {
    return null
  }

  const type = getAppTypeFromAniListCandidateType(candidate.type)

  if (!type) {
    return null
  }

  const externalId =
    typeof candidate.external_id === 'string' && candidate.external_id.trim()
      ? candidate.external_id.trim()
      : null
  const progress = normalizeProgress(candidate.progress)
  const totalProgress = normalizeNullableProgress(candidate.total_progress)

  return {
    externalId,
    externalRatingValue: normalizeAniListExternalScore(candidate.external_score),
    genres: normalizeGenreList(candidate.genres ?? []),
    image_url:
      typeof candidate.image_url === 'string' && candidate.image_url.trim()
        ? candidate.image_url.trim()
        : null,
    notes: typeof candidate.notes === 'string' ? candidate.notes : '',
    progress:
      totalProgress !== null && progress > totalProgress ? totalProgress : progress,
    rating: normalizeRating(candidate.rating),
    status: normalizeAniListStatus(candidate.status, type),
    title,
    totalProgress,
    type,
  }
}

function normalizeCsvMediaType(value: unknown): MediaType | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ')

  switch (normalized) {
    case 'anime':
      return 'Anime'
    case 'manga':
      return 'Manga'
    case 'manhwa':
      return 'Manhwa'
    case 'manhua':
      return 'Manhua'
    case 'film':
    case 'movie':
      return 'Movie'
    case 'series':
    case 'show':
    case 'tv':
    case 'tv series':
    case 'tv show':
      return 'TV Series'
    case 'book':
    case 'books':
      return 'Book'
    default:
      return mediaTypes.find((type) => type.toLowerCase() === normalized) ?? null
  }
}

function normalizeCsvStatus(value: unknown, type: MediaType) {
  const allowedStatuses = getAllowedStatuses(type)
  const defaultStatus = getDefaultStatus(type)

  if (typeof value !== 'string' || !value.trim()) {
    return defaultStatus
  }

  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ')
  const directMatch = allowedStatuses.find((status) => status.toLowerCase() === normalized)

  if (directMatch) {
    return directMatch
  }

  switch (normalized) {
    case 'current':
    case 'in progress':
    case 'watching':
      return allowedStatuses.includes('Watching') ? 'Watching' : 'Reading'
    case 'reading':
      return allowedStatuses.includes('Reading') ? 'Reading' : defaultStatus
    case 'completed':
    case 'complete':
    case 'finished':
      return 'Completed'
    case 'dropped':
      return 'Dropped'
    case 'on hold':
    case 'paused':
    case 'plan to read':
    case 'plan to watch':
    case 'planned':
    case 'planning':
      return 'Planning'
    case 'rewatching':
    case 're watching':
    case 're-watching':
      return allowedStatuses.includes('Re-Watching') ? 'Re-Watching' : defaultStatus
    default:
      return defaultStatus
  }
}

function sanitizeCsvExternalSource(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const source = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')

  return source || null
}

function sanitizeCsvText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function validateCsvCandidate(candidate: CsvImportCandidate): ValidatedCsvImportItem | null {
  const title = sanitizeCsvText(candidate.title)
  const type = normalizeCsvMediaType(candidate.type)

  if (!title || !type) {
    return null
  }

  return {
    externalId: sanitizeCsvText(candidate.external_id ?? '') || null,
    externalSource: sanitizeCsvExternalSource(candidate.external_source),
    image_url: sanitizeCsvText(candidate.image_url ?? '') || null,
    notes: typeof candidate.notes === 'string' ? candidate.notes : '',
    progress: normalizeProgress(candidate.progress),
    rating: normalizeRating(candidate.rating),
    status: normalizeCsvStatus(candidate.status, type),
    title,
    type,
  }
}

function toFullImportRow(item: ValidatedMalImportItem, userId: string): ImportRow {
  return {
    completed_at: null,
    external_rating_label: null,
    external_rating_value: null,
    favorite: false,
    genres: [],
    image_url: item.image_url,
    last_progress_at: item.progress > 0 ? new Date().toISOString() : null,
    notes: item.notes,
    progress: item.progress,
    rating: item.rating,
    started_at: null,
    status: item.status,
    title: item.title,
    total_progress: null,
    type: item.type,
    user_id: userId,
  }
}

function toFullAniListImportRow(item: ValidatedAniListImportItem, userId: string): ImportRow {
  return {
    completed_at: null,
    external_rating_label: item.externalRatingValue === null ? null : 'AniList',
    external_rating_value: item.externalRatingValue,
    favorite: false,
    genres: item.genres,
    image_url: item.image_url,
    last_progress_at: item.progress > 0 ? new Date().toISOString() : null,
    notes: item.notes,
    progress: item.progress,
    rating: item.rating,
    started_at: null,
    status: item.status,
    title: item.title,
    total_progress: item.totalProgress,
    type: item.type,
    user_id: userId,
  }
}

function toFullCsvImportRow(item: ValidatedCsvImportItem, userId: string): ImportRow {
  const totalProgress = item.type === 'Movie' ? 1 : null
  const progress = item.type === 'Movie' ? Math.min(item.progress, 1) : item.progress
  const status = item.type === 'Movie' && progress >= 1 ? 'Completed' : item.status

  return {
    completed_at: null,
    external_rating_label: null,
    external_rating_value: null,
    favorite: false,
    genres: [],
    image_url: item.image_url,
    last_progress_at: progress > 0 ? new Date().toISOString() : null,
    notes: item.notes,
    progress,
    rating: item.rating,
    started_at: null,
    status,
    title: item.title,
    total_progress: totalProgress,
    type: item.type,
    user_id: userId,
  }
}

function toCompatibilityImportRow(row: ImportRow) {
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

function toMetadataImportRow(row: ImportRow) {
  return {
    completed_at: row.completed_at,
    external_rating_label: row.external_rating_label,
    external_rating_value: row.external_rating_value,
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

function buildMetadataImportRows(
  rows: ImportRowWithExternalMetadata[],
  usedExternalIdColumns: boolean
) {
  return rows.map((row) => {
    const metadataRow = toMetadataImportRow(row)

    if (!usedExternalIdColumns || !row.external_source) {
      return metadataRow
    }

    return {
      ...metadataRow,
      external_id: row.external_id ?? null,
      external_source: row.external_source,
      external_url: row.external_url,
    }
  })
}

function buildCompatibilityImportRows(
  rows: ImportRowWithExternalMetadata[],
  usedExternalIdColumns: boolean
) {
  return rows.map((row) => {
    const compatibilityRow = toCompatibilityImportRow(row)

    if (!usedExternalIdColumns || !row.external_source) {
      return compatibilityRow
    }

    return {
      ...compatibilityRow,
      external_id: row.external_id ?? null,
      external_source: row.external_source,
    }
  })
}

function withExternalMetadata(row: ImportRow, item: ValidatedMalImportItem) {
  return {
    ...row,
    external_id: item.externalId,
    external_source: 'myanimelist' as const,
    external_url: item.externalUrl,
  }
}

function withAniListExternalMetadata(row: ImportRow, item: ValidatedAniListImportItem) {
  return {
    ...row,
    external_id: item.externalId,
    external_source: 'anilist' as const,
  }
}

function withCsvExternalMetadata(row: ImportRow, item: ValidatedCsvImportItem) {
  return {
    ...row,
    external_id: item.externalId,
    external_source: item.externalSource,
  }
}

async function enrichImportRows(queue: ImportQueueItem[]) {
  const rows: ImportRowWithExternalMetadata[] = []
  let enriched = 0

  for (let index = 0; index < queue.length; index += ENRICHMENT_BATCH_SIZE) {
    const batch = queue.slice(index, index + ENRICHMENT_BATCH_SIZE)
    const enrichedBatch = await Promise.all(
      batch.map(async ({ item, row }) => {
        const metadata = await findAniListImportMetadata(item.title, item.type, {
          malId: item.externalId,
        })

        if (!metadata) {
          return row
        }

        if (metadata.imageUrl) {
          enriched += 1
        }

        return {
          ...row,
          external_rating_label: metadata.externalRatingLabel,
          external_rating_value: metadata.externalRatingValue,
          genres: metadata.genres,
          image_url: metadata.imageUrl,
          total_progress: metadata.totalProgress,
        }
      })
    )

    rows.push(...enrichedBatch)
  }

  return { enriched, rows }
}

function isMissingColumnError(message?: string | null) {
  return Boolean(
    message &&
      (/column .* does not exist/i.test(message) ||
        /Could not find the .* column/i.test(message) ||
        /schema cache/i.test(message))
  )
}

async function revalidateImportPaths() {
  revalidatePath('/')
  revalidatePath('/backup')
  revalidatePath('/import')
  revalidatePath('/library')
  revalidatePath('/lists')
  revalidatePath('/stats')
  revalidatePath('/summary')

  for (const shelf of shelfDefinitions) {
    revalidatePath(`/shelves/${shelf.slug}`)
  }
}

function sanitizeAniListUsername(value: string) {
  return value.trim().replace(/^@+/, '')
}

async function fetchAniListCollection(
  userName: string,
  type: AniListMediaType
): Promise<AniListCollectionResult> {
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: ANILIST_LIST_QUERY,
        variables: { userName, type },
      }),
    })

    if (!response.ok) {
      return {
        entries: [],
        error: `AniList ${type.toLowerCase()} request failed.`,
      }
    }

    const payload = (await response.json()) as AniListCollectionResponse
    const graphQlError = payload.errors?.find((error) => error.message)?.message ?? null

    if (graphQlError) {
      return {
        entries: [],
        error: graphQlError,
      }
    }

    const lists = payload.data?.MediaListCollection?.lists ?? []
    const entries = lists.flatMap((list) => list.entries ?? [])

    return {
      entries,
      error: null,
    }
  } catch {
    return {
      entries: [],
      error: `Could not fetch AniList ${type.toLowerCase()} list.`,
    }
  }
}

export async function fetchAniListLibraryByUsername(
  rawUserName: string
): Promise<AniListFetchResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      candidates: [],
      error: 'Please sign in before fetching an AniList library.',
      warning: null,
    }
  }

  const userName = sanitizeAniListUsername(rawUserName)

  if (!/^[A-Za-z0-9_-]{2,32}$/.test(userName)) {
    return {
      candidates: [],
      error: 'Enter a valid public AniList username.',
      warning: null,
    }
  }

  const [animeResult, mangaResult] = await Promise.all([
    fetchAniListCollection(userName, 'ANIME'),
    fetchAniListCollection(userName, 'MANGA'),
  ])
  const candidates = [...animeResult.entries, ...mangaResult.entries]
    .map(toAniListImportCandidate)
    .filter((candidate): candidate is AniListImportCandidate => candidate !== null)

  const errors = [animeResult.error, mangaResult.error].filter(
    (error): error is string => Boolean(error)
  )

  if (candidates.length === 0) {
    return {
      candidates: [],
      error:
        errors.length > 0
          ? `AniList could not return public lists for this username. ${errors[0]}`
          : 'No public anime or manga entries were found for this AniList username.',
      warning: null,
    }
  }

  return {
    candidates,
    error: null,
    warning:
      errors.length > 0
        ? `Partial import preview: ${errors.join(' ')}`
        : null,
  }
}

function getAniListLookupType(type: string | null | undefined): 'Anime' | 'Manga' | null {
  if (type === 'Anime') {
    return 'Anime'
  }

  if (type === 'Manga' || type === 'Manhwa' || type === 'Manhua') {
    return 'Manga'
  }

  return null
}

function buildMissingCoverUpdate(metadata: Awaited<ReturnType<typeof findAniListImportMetadata>>) {
  if (!metadata?.imageUrl) {
    return null
  }

  const row: MissingCoverUpdateRow = {
    image_url: metadata.imageUrl,
  }

  if (metadata.externalRatingLabel && metadata.externalRatingValue !== null) {
    row.external_rating_label = metadata.externalRatingLabel
    row.external_rating_value = metadata.externalRatingValue
  }

  if (metadata.genres.length > 0) {
    row.genres = metadata.genres
  }

  if (metadata.totalProgress !== null) {
    row.total_progress = metadata.totalProgress
  }

  return row
}

function getMyAnimeListId(item: MissingCoverItem) {
  if (item.external_source !== 'myanimelist') {
    return null
  }

  const externalId = item.external_id?.trim()
  return externalId || null
}

function countMetadataSource(
  metadata: NonNullable<Awaited<ReturnType<typeof findAniListImportMetadata>>>,
  counters: {
    foundByJikan: number
    foundByMalId: number
    foundByTitle: number
  }
) {
  if (metadata.source === 'anilist-mal-id') {
    counters.foundByMalId += 1
    return
  }

  if (metadata.source === 'jikan-mal-id') {
    counters.foundByJikan += 1
    return
  }

  counters.foundByTitle += 1
}

async function updateMissingCover(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  item: MissingCoverItem,
  row: MissingCoverUpdateRow,
  userId: string
) {
  const fullUpdate = await supabase
    .from('items')
    .update(row)
    .eq('id', item.id)
    .eq('user_id', userId)
    .or('image_url.is.null,image_url.eq.')
    .select('id, image_url')

  if (!fullUpdate.error) {
    return (fullUpdate.data ?? []).some((updatedItem) => Boolean(updatedItem.image_url?.trim()))
  }

  if (!isMissingColumnError(fullUpdate.error.message)) {
    throw new Error(fullUpdate.error.message)
  }

  const fallbackUpdate = await supabase
    .from('items')
    .update({ image_url: row.image_url })
    .eq('id', item.id)
    .eq('user_id', userId)
    .or('image_url.is.null,image_url.eq.')
    .select('id, image_url')

  if (fallbackUpdate.error) {
    throw new Error(fallbackUpdate.error.message)
  }

  return (fallbackUpdate.data ?? []).some((updatedItem) =>
    Boolean(updatedItem.image_url?.trim())
  )
}

export async function enrichMissingAnimeMangaCovers(): Promise<MissingCoverEnrichmentResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      checked: 0,
      error: 'Please sign in before filling missing covers.',
      failed: 0,
      foundByJikan: 0,
      foundByMalId: 0,
      foundByTitle: 0,
      skipped: 0,
      updated: 0,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const itemsWithExternalResult = await supabase
    .from('items')
    .select('id, title, type, image_url, external_source, external_id')
    .eq('user_id', user.id)
    .in('type', [...ANIME_MANGA_TYPES])
    .or('image_url.is.null,image_url.eq.')
    .limit(MISSING_COVER_BATCH_SIZE)

  let items: MissingCoverItem[] = []
  let queryError = itemsWithExternalResult.error?.message ?? null

  if (itemsWithExternalResult.error && isMissingColumnError(itemsWithExternalResult.error.message)) {
    const fallbackItemsResult = await supabase
      .from('items')
      .select('id, title, type, image_url')
      .eq('user_id', user.id)
      .in('type', [...ANIME_MANGA_TYPES])
      .or('image_url.is.null,image_url.eq.')
      .limit(MISSING_COVER_BATCH_SIZE)

    queryError = fallbackItemsResult.error?.message ?? null
    items = (fallbackItemsResult.data ?? []) as MissingCoverItem[]
  } else {
    items = (itemsWithExternalResult.data ?? []) as MissingCoverItem[]
  }

  if (queryError) {
    return {
      checked: 0,
      error: queryError,
      failed: 0,
      foundByJikan: 0,
      foundByMalId: 0,
      foundByTitle: 0,
      skipped: 0,
      updated: 0,
    }
  }

  let failed = 0
  const foundCounters = {
    foundByJikan: 0,
    foundByMalId: 0,
    foundByTitle: 0,
  }
  let skipped = 0
  let updated = 0

  for (const item of items) {
    const title = item.title?.trim() ?? ''
    const lookupType = getAniListLookupType(item.type)

    if (!title || !lookupType || item.image_url?.trim()) {
      skipped += 1
      continue
    }

    const metadata = await findAniListImportMetadata(title, lookupType, {
      malId: getMyAnimeListId(item),
    })
    const updateRow = buildMissingCoverUpdate(metadata)

    if (!metadata || !updateRow) {
      skipped += 1
      continue
    }

    countMetadataSource(metadata, foundCounters)

    try {
      const didUpdate = await updateMissingCover(supabase, item, updateRow, user.id)

      if (didUpdate) {
        updated += 1
      } else {
        skipped += 1
      }
    } catch {
      failed += 1
    }
  }

  if (updated > 0) {
    await revalidateImportPaths()
  }

  return {
    checked: items.length,
    error: null,
    failed,
    ...foundCounters,
    skipped,
    updated,
  }
}

export async function deleteMyAnimeListImports(): Promise<DeleteMyAnimeListImportsResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      deleted: 0,
      error: 'Please sign in before deleting MyAnimeList imports.',
      success: false,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const importsResult = await supabase
    .from('items')
    .select('id, image_url')
    .eq('user_id', user.id)
    .eq('external_source', 'myanimelist')

  if (importsResult.error) {
    if (isMissingColumnError(importsResult.error.message)) {
      return {
        deleted: 0,
        error:
          'MyAnimeList cleanup needs the external_source column so imports can be identified safely.',
        success: false,
      }
    }

    return {
      deleted: 0,
      error: importsResult.error.message,
      success: false,
    }
  }

  const importRows = importsResult.data ?? []

  if (importRows.length === 0) {
    return {
      deleted: 0,
      error: null,
      success: true,
    }
  }

  const deleteResult = await supabase
    .from('items')
    .delete()
    .eq('user_id', user.id)
    .eq('external_source', 'myanimelist')
    .select('id')

  if (deleteResult.error) {
    return {
      deleted: 0,
      error: deleteResult.error.message,
      success: false,
    }
  }

  const deletedIds = new Set((deleteResult.data ?? []).map((item) => item.id))
  const deleted = deletedIds.size
  const coverUrls = importRows
    .filter((item) => deletedIds.has(item.id))
    .map((item) => item.image_url)
    .filter((url): url is string => typeof url === 'string' && url.length > 0)

  for (const url of coverUrls) {
    try {
      await deleteOwnedCoverByPublicUrl(url)
    } catch {
      // Owned storage cleanup is best-effort; the database delete is the source of truth.
    }
  }

  await revalidateImportPaths()
  revalidatePath(`/share/${user.id}`)
  revalidatePath(`/public/${user.id}`)

  return {
    deleted,
    error: null,
    success: true,
  }
}

export async function importAniListItems(
  candidates: AniListImportCandidate[]
): Promise<AniListImportResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      error: 'Please sign in before importing items.',
      failed: 0,
      imported: 0,
      skipped: 0,
      usedExternalIdColumns: false,
    }
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      error: 'Select at least one AniList item to import.',
      failed: 0,
      imported: 0,
      skipped: 0,
      usedExternalIdColumns: false,
    }
  }

  if (candidates.length > MAX_IMPORT_ITEMS) {
    return {
      error: `Please import ${MAX_IMPORT_ITEMS} items or fewer at once.`,
      failed: candidates.length,
      imported: 0,
      skipped: 0,
      usedExternalIdColumns: false,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const validatedItems = candidates
    .map(validateAniListCandidate)
    .filter((item): item is ValidatedAniListImportItem => item !== null)

  if (validatedItems.length === 0) {
    return {
      error: 'No valid AniList items were found in the selected preview.',
      failed: candidates.length,
      imported: 0,
      skipped: 0,
      usedExternalIdColumns: false,
    }
  }

  const existingWithExternalResult = await supabase
    .from('items')
    .select('title, type, external_source, external_id')
    .eq('user_id', user.id)
    .in('type', [...ANIME_MANGA_TYPES])

  let usedExternalIdColumns = !existingWithExternalResult.error
  let existingRows: ExistingItemLookup[] = existingWithExternalResult.data ?? []

  if (existingWithExternalResult.error) {
    if (!isMissingColumnError(existingWithExternalResult.error.message)) {
      return {
        error: existingWithExternalResult.error.message,
        failed: validatedItems.length,
        imported: 0,
        skipped: candidates.length - validatedItems.length,
        usedExternalIdColumns: false,
      }
    }

    const existingTitleResult = await supabase
      .from('items')
      .select('title, type')
      .eq('user_id', user.id)
      .in('type', [...ANIME_MANGA_TYPES])

    usedExternalIdColumns = false
    existingRows = existingTitleResult.data ?? []

    if (existingTitleResult.error) {
      return {
        error: existingTitleResult.error.message,
        failed: validatedItems.length,
        imported: 0,
        skipped: candidates.length - validatedItems.length,
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
      .filter((item) => item.external_source === 'anilist' && item.external_id)
      .map((item) => `anilist::${item.external_id}`)
  )
  const incomingTitleKeys = new Set<string>()
  const incomingExternalKeys = new Set<string>()
  const importQueue: AniListImportQueueItem[] = []
  let skipped = candidates.length - validatedItems.length

  for (const item of validatedItems) {
    const titleKey = `${item.type}::${normalizeComparableTitle(item.title)}`
    const externalKey =
      usedExternalIdColumns && item.externalId ? `anilist::${item.externalId}` : null

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

    const row = toFullAniListImportRow(item, user.id)
    importQueue.push({
      item,
      row: usedExternalIdColumns ? withAniListExternalMetadata(row, item) : row,
    })
  }

  if (importQueue.length === 0) {
    return {
      error: null,
      failed: 0,
      imported: 0,
      skipped,
      usedExternalIdColumns,
    }
  }

  const rowsToInsert = importQueue.map(({ row }) => row)
  const fullInsert = await supabase.from('items').insert(rowsToInsert).select('id')

  if (!fullInsert.error) {
    await revalidateImportPaths()
    return {
      error: null,
      failed: 0,
      imported: fullInsert.data?.length ?? rowsToInsert.length,
      skipped,
      usedExternalIdColumns,
    }
  }

  if (!isMissingColumnError(fullInsert.error.message)) {
    return {
      error: fullInsert.error.message,
      failed: rowsToInsert.length,
      imported: 0,
      skipped,
      usedExternalIdColumns,
    }
  }

  const metadataRows = buildMetadataImportRows(rowsToInsert, usedExternalIdColumns)
  const metadataInsert = await supabase.from('items').insert(metadataRows).select('id')

  if (!metadataInsert.error) {
    await revalidateImportPaths()
    return {
      error: null,
      failed: 0,
      imported: metadataInsert.data?.length ?? metadataRows.length,
      skipped,
      usedExternalIdColumns,
    }
  }

  if (!isMissingColumnError(metadataInsert.error.message)) {
    return {
      error: metadataInsert.error.message,
      failed: rowsToInsert.length,
      imported: 0,
      skipped,
      usedExternalIdColumns,
    }
  }

  const compatibilityRows = buildCompatibilityImportRows(rowsToInsert, usedExternalIdColumns)
  const compatibilityInsert = await supabase.from('items').insert(compatibilityRows).select('id')

  if (compatibilityInsert.error) {
    return {
      error: compatibilityInsert.error.message,
      failed: rowsToInsert.length,
      imported: 0,
      skipped,
      usedExternalIdColumns,
    }
  }

  await revalidateImportPaths()
  return {
    error: null,
    failed: 0,
    imported: compatibilityInsert.data?.length ?? compatibilityRows.length,
    skipped,
    usedExternalIdColumns,
  }
}

export async function importCsvItems(candidates: CsvImportCandidate[]): Promise<CsvImportResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      error: 'Please sign in before importing CSV items.',
      failed: 0,
      imported: 0,
      invalid: 0,
      skipped: 0,
      usedExternalIdColumns: false,
    }
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      error: 'Select at least one CSV row to import.',
      failed: 0,
      imported: 0,
      invalid: 0,
      skipped: 0,
      usedExternalIdColumns: false,
    }
  }

  if (candidates.length > MAX_IMPORT_ITEMS) {
    return {
      error: `Please import ${MAX_IMPORT_ITEMS} rows or fewer at once.`,
      failed: candidates.length,
      imported: 0,
      invalid: 0,
      skipped: 0,
      usedExternalIdColumns: false,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const validatedItems = candidates
    .map(validateCsvCandidate)
    .filter((item): item is ValidatedCsvImportItem => item !== null)
  const invalid = candidates.length - validatedItems.length

  if (validatedItems.length === 0) {
    return {
      error: 'No valid CSV rows were found in the selected preview.',
      failed: candidates.length,
      imported: 0,
      invalid,
      skipped: 0,
      usedExternalIdColumns: false,
    }
  }

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
        imported: 0,
        invalid,
        skipped: 0,
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
        imported: 0,
        invalid,
        skipped: 0,
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
  const rowsToInsert: ImportRowWithExternalMetadata[] = []
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

    const row = toFullCsvImportRow(item, user.id)
    rowsToInsert.push(
      usedExternalIdColumns && item.externalSource
        ? withCsvExternalMetadata(row, item)
        : row
    )
  }

  if (rowsToInsert.length === 0) {
    return {
      error: null,
      failed: 0,
      imported: 0,
      invalid,
      skipped,
      usedExternalIdColumns,
    }
  }

  const fullInsert = await supabase.from('items').insert(rowsToInsert).select('id')

  if (!fullInsert.error) {
    await revalidateImportPaths()
    return {
      error: null,
      failed: 0,
      imported: fullInsert.data?.length ?? rowsToInsert.length,
      invalid,
      skipped,
      usedExternalIdColumns,
    }
  }

  if (!isMissingColumnError(fullInsert.error.message)) {
    return {
      error: fullInsert.error.message,
      failed: rowsToInsert.length,
      imported: 0,
      invalid,
      skipped,
      usedExternalIdColumns,
    }
  }

  const metadataRows = buildMetadataImportRows(rowsToInsert, usedExternalIdColumns)
  const metadataInsert = await supabase.from('items').insert(metadataRows).select('id')

  if (!metadataInsert.error) {
    await revalidateImportPaths()
    return {
      error: null,
      failed: 0,
      imported: metadataInsert.data?.length ?? metadataRows.length,
      invalid,
      skipped,
      usedExternalIdColumns,
    }
  }

  if (!isMissingColumnError(metadataInsert.error.message)) {
    return {
      error: metadataInsert.error.message,
      failed: rowsToInsert.length,
      imported: 0,
      invalid,
      skipped,
      usedExternalIdColumns,
    }
  }

  const compatibilityRows = buildCompatibilityImportRows(rowsToInsert, usedExternalIdColumns)
  const compatibilityInsert = await supabase.from('items').insert(compatibilityRows).select('id')

  if (compatibilityInsert.error) {
    return {
      error: compatibilityInsert.error.message,
      failed: rowsToInsert.length,
      imported: 0,
      invalid,
      skipped,
      usedExternalIdColumns,
    }
  }

  await revalidateImportPaths()
  return {
    error: null,
    failed: 0,
    imported: compatibilityInsert.data?.length ?? compatibilityRows.length,
    invalid,
    skipped,
    usedExternalIdColumns,
  }
}

export async function importMyAnimeListItems(
  candidates: MalImportCandidate[]
): Promise<MalImportResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      enriched: 0,
      error: 'Please sign in before importing items.',
      failed: 0,
      imported: 0,
      skipped: 0,
      usedExternalIdColumns: false,
    }
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      enriched: 0,
      error: 'Select at least one parsed item to import.',
      failed: 0,
      imported: 0,
      skipped: 0,
      usedExternalIdColumns: false,
    }
  }

  if (candidates.length > MAX_IMPORT_ITEMS) {
    return {
      enriched: 0,
      error: `Please import ${MAX_IMPORT_ITEMS} items or fewer at once.`,
      failed: candidates.length,
      imported: 0,
      skipped: 0,
      usedExternalIdColumns: false,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const validatedItems = candidates
    .map(validateCandidate)
    .filter((item): item is ValidatedMalImportItem => item !== null)

  if (validatedItems.length === 0) {
    return {
      enriched: 0,
      error: 'No valid MyAnimeList items were found in the selected preview.',
      failed: candidates.length,
      imported: 0,
      skipped: 0,
      usedExternalIdColumns: false,
    }
  }

  const existingWithExternalResult = await supabase
    .from('items')
    .select('title, type, external_source, external_id')
    .eq('user_id', user.id)
    .in('type', ['Anime', 'Manga'])

  let usedExternalIdColumns = !existingWithExternalResult.error
  let existingRows: ExistingItemLookup[] = existingWithExternalResult.data ?? []

  if (existingWithExternalResult.error) {
    if (!isMissingColumnError(existingWithExternalResult.error.message)) {
      return {
        enriched: 0,
        error: existingWithExternalResult.error.message,
        failed: validatedItems.length,
        imported: 0,
        skipped: candidates.length - validatedItems.length,
        usedExternalIdColumns: false,
      }
    }

    const existingTitleResult = await supabase
      .from('items')
      .select('title, type')
      .eq('user_id', user.id)
      .in('type', ['Anime', 'Manga'])

    usedExternalIdColumns = false
    existingRows = existingTitleResult.data ?? []

    if (existingTitleResult.error) {
      return {
        enriched: 0,
        error: existingTitleResult.error.message,
        failed: validatedItems.length,
        imported: 0,
        skipped: candidates.length - validatedItems.length,
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
      .filter((item) => item.external_source === 'myanimelist' && item.external_id)
      .map((item) => `myanimelist::${item.external_id}`)
  )
  const incomingTitleKeys = new Set<string>()
  const incomingExternalKeys = new Set<string>()
  const importQueue: ImportQueueItem[] = []
  let skipped = candidates.length - validatedItems.length

  for (const item of validatedItems) {
    const titleKey = `${item.type}::${normalizeComparableTitle(item.title)}`
    const externalKey =
      usedExternalIdColumns && item.externalId ? `myanimelist::${item.externalId}` : null

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

    const row = toFullImportRow(item, user.id)
    importQueue.push({
      item,
      row: usedExternalIdColumns ? withExternalMetadata(row, item) : row,
    })
  }

  if (importQueue.length === 0) {
    return {
      enriched: 0,
      error: null,
      failed: 0,
      imported: 0,
      skipped,
      usedExternalIdColumns,
    }
  }

  const { enriched, rows: rowsToInsert } = await enrichImportRows(importQueue)
  const fullInsert = await supabase.from('items').insert(rowsToInsert).select('id')

  if (!fullInsert.error) {
    await revalidateImportPaths()
    return {
      enriched,
      error: null,
      failed: 0,
      imported: fullInsert.data?.length ?? rowsToInsert.length,
      skipped,
      usedExternalIdColumns,
    }
  }

  if (!isMissingColumnError(fullInsert.error.message)) {
    return {
      enriched,
      error: fullInsert.error.message,
      failed: rowsToInsert.length,
      imported: 0,
      skipped,
      usedExternalIdColumns,
    }
  }

  const metadataRows = buildMetadataImportRows(rowsToInsert, usedExternalIdColumns)
  const metadataInsert = await supabase.from('items').insert(metadataRows).select('id')

  if (!metadataInsert.error) {
    await revalidateImportPaths()
    return {
      enriched,
      error: null,
      failed: 0,
      imported: metadataInsert.data?.length ?? metadataRows.length,
      skipped,
      usedExternalIdColumns,
    }
  }

  if (!isMissingColumnError(metadataInsert.error.message)) {
    return {
      enriched,
      error: metadataInsert.error.message,
      failed: rowsToInsert.length,
      imported: 0,
      skipped,
      usedExternalIdColumns,
    }
  }

  const compatibilityRows = buildCompatibilityImportRows(rowsToInsert, usedExternalIdColumns)
  const compatibilityInsert = await supabase.from('items').insert(compatibilityRows).select('id')

  if (compatibilityInsert.error) {
    return {
      enriched,
      error: compatibilityInsert.error.message,
      failed: rowsToInsert.length,
      imported: 0,
      skipped,
      usedExternalIdColumns,
    }
  }

  await revalidateImportPaths()
  return {
    enriched,
    error: null,
    failed: 0,
    imported: compatibilityInsert.data?.length ?? compatibilityRows.length,
    skipped,
    usedExternalIdColumns,
  }
}
