'use server'

import { revalidatePath } from 'next/cache'

import {
  findAniListImportMetadata,
  type AnimeMangaImportMetadata,
} from '../../lib/anilist-import-enrichment'
import {
  isCatalogSearchProviderError,
  searchTmdbCandidatesByType,
} from '../../lib/catalog-search'
import type { CatalogSearchCandidate } from '../../lib/catalog-types'
import { getCurrentUser } from '../../lib/auth/dal'
import { normalizeGenreList } from '../../lib/genres'
import { shelfDefinitions } from '../../lib/shelves'
import { createSupabaseServerClient } from '../../lib/supabase/server'

export type MetadataRefreshResult = {
  checked: number
  coversAdded: number
  error: string | null
  failed: number
  genresUpdated: number
  ratingsAdded: number
  skipped: number
  totalsUpdated: number
  updated: number
}

type RefreshableItem = {
  external_id?: string | null
  external_rating_label?: string | null
  external_rating_value?: number | null
  external_source?: string | null
  genres?: string[] | null
  id: string
  image_url?: string | null
  title?: string | null
  total_progress?: number | null
  type?: string | null
}

type MetadataUpdateRow = {
  external_rating_label?: string | null
  external_rating_value?: number | null
  genres?: string[]
  image_url?: string | null
  total_progress?: number | null
}

type ProviderMetadata = {
  externalRatingLabel: string | null
  externalRatingValue: number | null
  genres: string[]
  imageUrl: string | null
  totalProgress: number | null
}

type MetadataUpdateCounters = Pick<
  MetadataRefreshResult,
  'coversAdded' | 'genresUpdated' | 'ratingsAdded' | 'totalsUpdated'
>

const REFRESHABLE_ITEM_SELECT =
  'id, title, type, image_url, genres, total_progress, external_rating_label, external_rating_value, external_source, external_id'

function getAniListLookupType(type: string | null | undefined): 'Anime' | 'Manga' | null {
  if (type === 'Anime') {
    return 'Anime'
  }

  if (type === 'Manga' || type === 'Manhwa' || type === 'Manhua') {
    return 'Manga'
  }

  return null
}

function getTmdbLookupType(type: string | null | undefined): 'movie' | 'tv' | null {
  if (type === 'Movie') {
    return 'movie'
  }

  if (type === 'TV Series') {
    return 'tv'
  }

  return null
}

function getMyAnimeListId(item: RefreshableItem) {
  if (item.external_source !== 'myanimelist') {
    return null
  }

  const externalId = item.external_id?.trim()
  return externalId || null
}

function parsePositiveInteger(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null
  }

  return parsed
}

function isMissingValue(value: string | number | null | undefined) {
  if (typeof value === 'string') {
    return value.trim().length === 0
  }

  return value === null || value === undefined
}

function ratingsDiffer(current: number | null | undefined, next: number) {
  if (current === null || current === undefined) {
    return true
  }

  return Math.abs(current - next) >= 0.05
}

function mergeGenres(currentGenres: string[] | null | undefined, providerGenres: string[]) {
  return normalizeGenreList([...(currentGenres ?? []), ...providerGenres])
}

function genresChanged(currentGenres: string[] | null | undefined, nextGenres: string[]) {
  const current = normalizeGenreList(currentGenres ?? [])

  if (current.length !== nextGenres.length) {
    return true
  }

  return current.some((genre, index) => genre !== nextGenres[index])
}

function fromAniListMetadata(
  metadata: AnimeMangaImportMetadata | null
): ProviderMetadata | null {
  if (!metadata) {
    return null
  }

  return {
    externalRatingLabel: metadata.externalRatingLabel,
    externalRatingValue: metadata.externalRatingValue,
    genres: metadata.genres,
    imageUrl: metadata.imageUrl,
    totalProgress: metadata.totalProgress,
  }
}

function fromTmdbCandidate(
  candidate: CatalogSearchCandidate | null,
  mediaType: 'movie' | 'tv'
): ProviderMetadata | null {
  if (!candidate) {
    return null
  }

  return {
    externalRatingLabel:
      candidate.externalRatingValue === null || candidate.externalRatingValue === undefined
        ? null
        : 'TMDB',
    externalRatingValue: candidate.externalRatingValue ?? null,
    genres: normalizeGenreList(
      candidate.genres
        .split(',')
        .map((genre) => genre.trim())
        .filter(Boolean)
    ),
    imageUrl: candidate.imageUrl || null,
    totalProgress:
      parsePositiveInteger(candidate.totalProgress) ?? (mediaType === 'movie' ? 1 : null),
  }
}

async function fetchProviderMetadata(item: RefreshableItem): Promise<ProviderMetadata | null> {
  const title = item.title?.trim()

  if (!title) {
    return null
  }

  const aniListType = getAniListLookupType(item.type)

  if (aniListType) {
    return fromAniListMetadata(
      await findAniListImportMetadata(title, aniListType, {
        malId: getMyAnimeListId(item),
      })
    )
  }

  const tmdbType = getTmdbLookupType(item.type)

  if (!tmdbType) {
    return null
  }

  try {
    const candidates = await searchTmdbCandidatesByType([title], tmdbType)
    const providerType = tmdbType === 'tv' ? 'TV Series' : 'Movie'
    const candidate =
      candidates.find((entry) => entry.type === providerType && entry.score >= 0.7) ?? null

    return fromTmdbCandidate(candidate, tmdbType)
  } catch (error) {
    if (isCatalogSearchProviderError(error)) {
      return null
    }

    throw error
  }
}

function buildMetadataUpdateRow(
  item: RefreshableItem,
  metadata: ProviderMetadata,
  counters: MetadataUpdateCounters
) {
  const row: MetadataUpdateRow = {}

  if (metadata.externalRatingLabel && metadata.externalRatingValue !== null) {
    const currentLabel = item.external_rating_label?.trim() ?? ''

    if (
      currentLabel !== metadata.externalRatingLabel ||
      ratingsDiffer(item.external_rating_value, metadata.externalRatingValue)
    ) {
      if (
        !currentLabel ||
        item.external_rating_value === null ||
        item.external_rating_value === undefined
      ) {
        counters.ratingsAdded += 1
      }

      row.external_rating_label = metadata.externalRatingLabel
      row.external_rating_value = metadata.externalRatingValue
    }
  }

  if (isMissingValue(item.image_url) && metadata.imageUrl) {
    row.image_url = metadata.imageUrl
    counters.coversAdded += 1
  }

  if (metadata.genres.length > 0) {
    const mergedGenres = mergeGenres(item.genres, metadata.genres)

    if (genresChanged(item.genres, mergedGenres)) {
      row.genres = mergedGenres
      counters.genresUpdated += 1
    }
  }

  if (
    (item.total_progress === null ||
      item.total_progress === undefined ||
      item.total_progress < 1) &&
    metadata.totalProgress !== null
  ) {
    row.total_progress = metadata.totalProgress
    counters.totalsUpdated += 1
  }

  return row
}

function hasMetadataUpdate(row: MetadataUpdateRow) {
  return Object.keys(row).length > 0
}

function createMetadataUpdateCounters(): MetadataUpdateCounters {
  return {
    coversAdded: 0,
    genresUpdated: 0,
    ratingsAdded: 0,
    totalsUpdated: 0,
  }
}

function addMetadataUpdateCounters(
  result: MetadataRefreshResult,
  counters: MetadataUpdateCounters
) {
  result.coversAdded += counters.coversAdded
  result.genresUpdated += counters.genresUpdated
  result.ratingsAdded += counters.ratingsAdded
  result.totalsUpdated += counters.totalsUpdated
}

async function revalidateMetadataRefreshPaths() {
  revalidatePath('/')
  revalidatePath('/backup')
  revalidatePath('/import')
  revalidatePath('/library')
  revalidatePath('/lists')
  revalidatePath('/settings')
  revalidatePath('/stats')
  revalidatePath('/summary')

  for (const shelf of shelfDefinitions) {
    revalidatePath(`/shelves/${shelf.slug}`)
  }
}

export async function refreshCurrentUserItemMetadata(): Promise<MetadataRefreshResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      checked: 0,
      coversAdded: 0,
      error: 'Please sign in before refreshing metadata.',
      failed: 0,
      genresUpdated: 0,
      ratingsAdded: 0,
      skipped: 0,
      totalsUpdated: 0,
      updated: 0,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const itemsResult = await supabase
    .from('items')
    .select(REFRESHABLE_ITEM_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (itemsResult.error) {
    return {
      checked: 0,
      coversAdded: 0,
      error: 'Could not load your vault items for metadata refresh.',
      failed: 0,
      genresUpdated: 0,
      ratingsAdded: 0,
      skipped: 0,
      totalsUpdated: 0,
      updated: 0,
    }
  }

  const items = (itemsResult.data ?? []) as RefreshableItem[]
  const result: MetadataRefreshResult = {
    checked: items.length,
    coversAdded: 0,
    error: null,
    failed: 0,
    genresUpdated: 0,
    ratingsAdded: 0,
    skipped: 0,
    totalsUpdated: 0,
    updated: 0,
  }

  for (const item of items) {
    try {
      const metadata = await fetchProviderMetadata(item)

      if (!metadata) {
        result.skipped += 1
        continue
      }

      const counters = createMetadataUpdateCounters()
      const updateRow = buildMetadataUpdateRow(item, metadata, counters)

      if (!hasMetadataUpdate(updateRow)) {
        result.skipped += 1
        continue
      }

      const updateResult = await supabase
        .from('items')
        .update(updateRow)
        .eq('id', item.id)
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle()

      if (updateResult.error || !updateResult.data) {
        result.failed += 1
        continue
      }

      result.updated += 1
      addMetadataUpdateCounters(result, counters)
    } catch {
      result.failed += 1
    }
  }

  if (result.updated > 0) {
    await revalidateMetadataRefreshPaths()
  }

  return result
}
