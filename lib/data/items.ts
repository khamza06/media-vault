import 'server-only'

import { requireCurrentUser } from '../auth/dal'
import { normalizeGenreList } from '../genres'
import type { MediaItemRecord, NormalizedMediaItemWriteInput } from '../media'
import { getDefaultStatus, isMovieType, usesPageProgress } from '../media'
import { isMissingColumnError, isMissingUserIdError } from './ownership'
import { createSupabaseServerClient } from '../supabase/server'

const fullItemSelectFieldsWithSource =
  'id, user_id, title, type, status, progress, total_progress, last_progress_at, rating, image_url, notes, started_at, completed_at, favorite, genres, external_rating_label, external_rating_value, external_source, external_id, created_at'
const metadataItemSelectFieldsWithSource =
  'id, user_id, title, type, status, progress, total_progress, rating, image_url, notes, started_at, completed_at, favorite, genres, external_rating_label, external_rating_value, external_source, external_id, created_at'
const fullItemSelectFields =
  'id, user_id, title, type, status, progress, total_progress, last_progress_at, rating, image_url, notes, started_at, completed_at, favorite, genres, external_rating_label, external_rating_value, created_at'
const metadataItemSelectFields =
  'id, user_id, title, type, status, progress, total_progress, rating, image_url, notes, started_at, completed_at, favorite, genres, external_rating_label, external_rating_value, created_at'
const backupExportItemSelectFields =
  'id, user_id, title, type, status, progress, total_progress, last_progress_at, rating, image_url, notes, started_at, completed_at, favorite, genres, external_rating_label, external_rating_value, external_source, external_id, created_at'
const compatibilityItemSelectFields =
  'id, user_id, title, type, status, progress, total_progress, rating, image_url, notes, started_at, completed_at, favorite, genres, created_at'
const legacyItemSelectFields = 'id, title, type, status, progress, rating, image_url, created_at'
const discoveryExtendedSelectFields =
  'id, user_id, title, type, status, progress, total_progress, last_progress_at, rating, image_url, notes, started_at, completed_at, favorite, genres, external_rating_label, external_rating_value, created_at'
const discoveryMetadataSelectFields =
  'id, user_id, title, type, status, progress, total_progress, rating, image_url, notes, started_at, completed_at, favorite, genres, external_rating_label, external_rating_value, created_at'
const discoveryCompatibilitySelectFields =
  'id, user_id, title, type, status, progress, total_progress, rating, image_url, notes, started_at, completed_at, favorite, genres, created_at'

type OrderableQuery<T> = {
  order: (
    column: string,
    options?: {
      ascending?: boolean
      nullsFirst?: boolean
    }
  ) => T
}

interface DiscoveryQueryBuilderShim extends OrderableQuery<DiscoveryQueryBuilderShim> {
  contains: (column: string, value: readonly string[]) => DiscoveryQueryBuilderShim
  eq: (column: string, value: unknown) => DiscoveryQueryBuilderShim
  gte: (column: string, value: unknown) => DiscoveryQueryBuilderShim
  ilike: (column: string, pattern: string) => DiscoveryQueryBuilderShim
  in: (column: string, values: readonly unknown[]) => DiscoveryQueryBuilderShim
  lte: (column: string, value: unknown) => DiscoveryQueryBuilderShim
  or: (filters: string) => DiscoveryQueryBuilderShim
}

type OwnedProgressSnapshot = {
  id: string
  last_progress_at?: string | null
  progress?: number | null
  type?: string | null
}

export type DiscoveryHubDateAdded = 'all' | '7d' | '30d' | 'year'
export type DiscoveryHubPreset = 'all' | 'masters' | 'consuming' | 'recent'
export type DiscoveryHubSort = 'recent' | 'title' | 'rating' | 'year'

export type DiscoveryHubFilters = {
  dateAdded: DiscoveryHubDateAdded
  genres: string[]
  preset: DiscoveryHubPreset
  query: string
  ratingMax: number | null
  ratingMin: number | null
  sortBy: DiscoveryHubSort
  status: string | null
  types: string[]
}

export type DiscoveryHubItemsResult = {
  data: MediaItemRecord[] | null
  error: { message?: string | null } | null
  filteredCount: number
  totalCount: number
}

type GenreRowsResult = {
  data: Array<{ genres?: string[] | null }> | null
  error: { message?: string | null } | null
}

function isExtendedSchemaError(message?: string | null) {
  return isMissingColumnError(message, 'last_progress_at')
}

function isMetadataColumnError(message?: string | null) {
  return (
    isMissingColumnError(message, 'total_progress') ||
    isMissingColumnError(message, 'notes') ||
    isMissingColumnError(message, 'started_at') ||
    isMissingColumnError(message, 'completed_at') ||
    isMissingColumnError(message, 'favorite') ||
    isMissingColumnError(message, 'genres') ||
    isMissingColumnError(message, 'external_rating_label') ||
    isMissingColumnError(message, 'external_rating_value')
  )
}

function isExternalSourceColumnError(message?: string | null) {
  return (
    isMissingColumnError(message, 'external_source') ||
    isMissingColumnError(message, 'external_id')
  )
}

function sanitizeDiscoveryQuery(value: string) {
  return value
    .trim()
    .replace(/[%*,()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
}

function getDiscoveryCutoff(dateAdded: DiscoveryHubDateAdded) {
  const now = new Date()

  switch (dateAdded) {
    case '7d':
      now.setDate(now.getDate() - 7)
      return now.toISOString()
    case '30d':
      now.setDate(now.getDate() - 30)
      return now.toISOString()
    case 'year':
      return new Date(now.getFullYear(), 0, 1).toISOString()
    case 'all':
    default:
      return null
  }
}

function expandDiscoveryTypes(types: string[]) {
  const expanded = new Set<string>()

  for (const type of types) {
    switch (type) {
      case 'Anime':
        expanded.add('Anime')
        break
      case 'Manga':
        expanded.add('Manga')
        expanded.add('Manhwa')
        expanded.add('Manhua')
        break
      case 'Movie':
        expanded.add('Movie')
        break
      case 'Series':
        expanded.add('TV Series')
        break
      case 'Book':
        expanded.add('Book')
        break
      default:
        break
    }
  }

  return [...expanded]
}

function applyDiscoverySorting<T>(
  builder: T,
  sortBy: DiscoveryHubSort,
  options?: {
    supportsLastProgressAt?: boolean
    supportsStartedAt?: boolean
  }
): T {
  const query = builder as unknown as DiscoveryQueryBuilderShim
  const supportsLastProgressAt = options?.supportsLastProgressAt ?? true
  const supportsStartedAt = options?.supportsStartedAt ?? true

  switch (sortBy) {
    case 'title':
      return query.order('title', { ascending: true }) as unknown as T
    case 'rating':
      return query
        .order('rating', { ascending: false, nullsFirst: false })
        .order('title', { ascending: true }) as unknown as T
    case 'year':
      if (supportsStartedAt) {
        return query
          .order('started_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false }) as unknown as T
      }

      return query.order('created_at', { ascending: false }) as unknown as T
    case 'recent':
    default:
      if (supportsLastProgressAt) {
        return query
          .order('last_progress_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false }) as unknown as T
      }

      return query.order('created_at', { ascending: false }) as unknown as T
  }
}

function applyDiscoveryFilters<T>(
  builder: T,
  filters: DiscoveryHubFilters,
  options?: {
    supportsGenres?: boolean
    supportsLastProgressAt?: boolean
    supportsNotes?: boolean
    supportsStartedAt?: boolean
  }
) {
  const queryBuilder = builder as unknown as DiscoveryQueryBuilderShim
  const supportsGenres = options?.supportsGenres ?? true
  const supportsLastProgressAt = options?.supportsLastProgressAt ?? true
  const supportsNotes = options?.supportsNotes ?? true
  const supportsStartedAt = options?.supportsStartedAt ?? true
  const query = sanitizeDiscoveryQuery(filters.query)
  const expandedTypes = expandDiscoveryTypes(filters.types)
  const cutoff = getDiscoveryCutoff(filters.dateAdded)
  let nextBuilder = queryBuilder

  if (query) {
    if (supportsNotes) {
      nextBuilder = nextBuilder.or(`title.ilike.*${query}*,notes.ilike.*${query}*`)
    } else {
      nextBuilder = nextBuilder.ilike('title', `*${query}*`)
    }
  }

  if (expandedTypes.length > 0) {
    nextBuilder = nextBuilder.in('type', expandedTypes)
  }

  if (supportsGenres && filters.genres.length > 0) {
    nextBuilder = nextBuilder.contains('genres', filters.genres)
  }

  if (filters.status) {
    nextBuilder = nextBuilder.eq('status', filters.status)
  }

  if (filters.ratingMin !== null) {
    nextBuilder = nextBuilder.gte('rating', filters.ratingMin)
  }

  if (filters.ratingMax !== null) {
    nextBuilder = nextBuilder.lte('rating', filters.ratingMax)
  }

  if (cutoff) {
    nextBuilder = nextBuilder.gte('created_at', cutoff)
  }

  switch (filters.preset) {
    case 'masters':
      nextBuilder = nextBuilder.gte('rating', 10).lte('rating', 10)
      break
    case 'consuming':
      nextBuilder = nextBuilder.in('status', ['Watching', 'Reading'])
      break
    case 'recent':
      nextBuilder = nextBuilder.gte(
        'created_at',
        getDiscoveryCutoff('30d') ?? new Date().toISOString()
      )
      break
    case 'all':
    default:
      break
  }

  return applyDiscoverySorting(nextBuilder, filters.sortBy, {
    supportsLastProgressAt,
    supportsStartedAt,
  }) as T
}

function toDatabasePayload(input: NormalizedMediaItemWriteInput) {
  return {
    completed_at: input.completed_at,
    external_rating_label: input.external_rating_label,
    external_rating_value: input.external_rating_value,
    favorite: input.favorite,
    genres: input.genres,
    image_url: input.image_url,
    last_progress_at: input.last_progress_at,
    notes: input.notes,
    progress: input.progress,
    rating: input.rating,
    started_at: input.started_at,
    status: input.status,
    title: input.title,
    total_progress: input.total_progress,
    type: input.type,
  }
}

function toMetadataInput(input: NormalizedMediaItemWriteInput) {
  return {
    completed_at: input.completed_at,
    external_rating_label: input.external_rating_label,
    external_rating_value: input.external_rating_value,
    favorite: input.favorite,
    genres: input.genres,
    image_url: input.image_url,
    notes: input.notes,
    progress: input.progress,
    rating: input.rating,
    started_at: input.started_at,
    status: input.status,
    title: input.title,
    total_progress: input.total_progress,
    type: input.type,
  }
}

function toLegacyInput(input: NormalizedMediaItemWriteInput) {
  return {
    image_url: input.image_url,
    progress: input.progress,
    rating: input.rating,
    status: input.status,
    title: input.title,
    total_progress: input.total_progress,
    type: input.type,
  }
}

function toCompatibilityInput(input: NormalizedMediaItemWriteInput) {
  return {
    completed_at: input.completed_at,
    favorite: input.favorite,
    genres: input.genres,
    image_url: input.image_url,
    notes: input.notes,
    progress: input.progress,
    rating: input.rating,
    started_at: input.started_at,
    status: input.status,
    title: input.title,
    total_progress: input.total_progress,
    type: input.type,
  }
}

function isLegacyWriteFallbackError(message?: string | null) {
  return Boolean(
    message &&
      (isMissingUserIdError(message) || isExtendedSchemaError(message) || isMetadataColumnError(message))
  )
}

function orderFullQuery<T extends OrderableQuery<T>>(query: T): T {
  return query
    .order('last_progress_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
}

function orderCompatibilityQuery<T extends OrderableQuery<T>>(query: T): T {
  return query.order('created_at', { ascending: false })
}

async function getExistingOwnedProgressSnapshot(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  id: string
): Promise<{ data: OwnedProgressSnapshot | null; error: { message?: string | null } | null }> {
  const fullSnapshot = await supabase
    .from('items')
    .select('id, type, progress, last_progress_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!fullSnapshot.error || !isExtendedSchemaError(fullSnapshot.error?.message)) {
    return fullSnapshot
  }

  const legacySnapshot = await supabase
    .from('items')
    .select('id, type, progress')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  return {
    data: legacySnapshot.data as OwnedProgressSnapshot | null,
    error: legacySnapshot.error,
  }
}

function getStoredProgressValue(
  item:
    | {
        progress?: number | null
        type?: string | null
      }
    | null
    | undefined,
  inputType?: string
) {
  void inputType
  return item?.progress ?? 0
}

function buildOwnedPayload(
  input: NormalizedMediaItemWriteInput,
  options?: {
    preserveLastProgressAt?: string | null
  }
) {
  const payload = {
    ...toDatabasePayload(input),
    last_progress_at:
      options && 'preserveLastProgressAt' in options
        ? options.preserveLastProgressAt ?? null
        : input.last_progress_at,
  }

  return payload
}

export async function getItems() {
  const user = await requireCurrentUser()
  const supabase = createSupabaseServerClient(user.accessToken)

  const sourceResult = await orderFullQuery(
    supabase.from('items').select(fullItemSelectFieldsWithSource).eq('user_id', user.id)
  )

  if (!sourceResult.error) {
    return sourceResult
  }

  if (sourceResult.error.message && isExtendedSchemaError(sourceResult.error.message)) {
    const metadataSourceResult = await orderCompatibilityQuery(
      supabase.from('items').select(metadataItemSelectFieldsWithSource).eq('user_id', user.id)
    )

    if (!metadataSourceResult.error) {
      return metadataSourceResult
    }

    if (
      metadataSourceResult.error.message &&
      !isExternalSourceColumnError(metadataSourceResult.error.message) &&
      !isMetadataColumnError(metadataSourceResult.error.message) &&
      !isMissingUserIdError(metadataSourceResult.error.message)
    ) {
      return metadataSourceResult
    }
  }

  if (
    sourceResult.error.message &&
    !isExternalSourceColumnError(sourceResult.error.message)
  ) {
    const shouldReturnSourceError =
      !isExtendedSchemaError(sourceResult.error.message) &&
      !isMetadataColumnError(sourceResult.error.message) &&
      !isMissingUserIdError(sourceResult.error.message)

    if (shouldReturnSourceError) {
      return sourceResult
    }
  }

  const fullResult = await orderFullQuery(
    supabase.from('items').select(fullItemSelectFields).eq('user_id', user.id)
  )

  if (!fullResult.error) {
    return fullResult
  }

  if (isExtendedSchemaError(fullResult.error.message)) {
    const metadataResult = await orderCompatibilityQuery(
      supabase.from('items').select(metadataItemSelectFields).eq('user_id', user.id)
    )

    if (!metadataResult.error) {
      return metadataResult
    }

    if (
      metadataResult.error.message &&
      !isMetadataColumnError(metadataResult.error.message) &&
      !isMissingUserIdError(metadataResult.error.message)
    ) {
      return metadataResult
    }

    const compatibilityResult = await orderCompatibilityQuery(
      supabase.from('items').select(compatibilityItemSelectFields).eq('user_id', user.id)
    )

    if (!compatibilityResult.error || !isMetadataColumnError(compatibilityResult.error?.message)) {
      return compatibilityResult
    }
  }

  if (isMissingUserIdError(fullResult.error.message)) {
    return supabase.from('items').select(legacyItemSelectFields).order('created_at', { ascending: false })
  }

  if (isMetadataColumnError(fullResult.error.message)) {
    return orderCompatibilityQuery(
      supabase.from('items').select(legacyItemSelectFields).eq('user_id', user.id)
    )
  }

  return fullResult
}

export async function getItemsForBackupExport() {
  const user = await requireCurrentUser()
  const supabase = createSupabaseServerClient(user.accessToken)

  const exportResult = await orderFullQuery(
    supabase.from('items').select(backupExportItemSelectFields).eq('user_id', user.id)
  )

  if (!exportResult.error) {
    return exportResult
  }

  return getItems()
}

export async function getItemById(id: string) {
  const user = await requireCurrentUser()
  const supabase = createSupabaseServerClient(user.accessToken)

  const fullResult = await supabase
    .from('items')
    .select(fullItemSelectFields)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!fullResult.error) {
    return fullResult
  }

  if (isExtendedSchemaError(fullResult.error.message)) {
    const metadataResult = await supabase
      .from('items')
      .select(metadataItemSelectFields)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!metadataResult.error) {
      return metadataResult
    }

    if (
      metadataResult.error.message &&
      !isMetadataColumnError(metadataResult.error.message) &&
      !isMissingUserIdError(metadataResult.error.message)
    ) {
      return metadataResult
    }

    const compatibilityResult = await supabase
      .from('items')
      .select(compatibilityItemSelectFields)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!compatibilityResult.error || !isMetadataColumnError(compatibilityResult.error?.message)) {
      return compatibilityResult
    }
  }

  if (isMissingUserIdError(fullResult.error.message)) {
    return supabase.from('items').select(legacyItemSelectFields).eq('id', id).single()
  }

  if (isMetadataColumnError(fullResult.error.message)) {
    return supabase.from('items').select(legacyItemSelectFields).eq('id', id).single()
  }

  return fullResult
}

export async function createItem(input: NormalizedMediaItemWriteInput) {
  const user = await requireCurrentUser()
  const supabase = createSupabaseServerClient(user.accessToken)

  const ownedInsert = await supabase
    .from('items')
    .insert({
      ...toDatabasePayload(input),
      user_id: user.id,
    })
    .select('id')
    .single()

  if (!ownedInsert.error) {
    return ownedInsert
  }

  if (isExtendedSchemaError(ownedInsert.error.message)) {
    const metadataInsert = await supabase
      .from('items')
      .insert({
        ...toMetadataInput(input),
        user_id: user.id,
      })
      .select('id')
      .single()

    if (!metadataInsert.error) {
      return metadataInsert
    }

    if (!isLegacyWriteFallbackError(metadataInsert.error.message)) {
      return metadataInsert
    }
  }

  if (isLegacyWriteFallbackError(ownedInsert.error.message)) {
    const compatibilityInsert = await supabase
      .from('items')
      .insert({
        ...toCompatibilityInput(input),
        user_id: user.id,
      })
      .select('id')
      .single()

    if (
      !compatibilityInsert.error ||
      !isLegacyWriteFallbackError(compatibilityInsert.error?.message)
    ) {
      return compatibilityInsert
    }

    return supabase.from('items').insert(toLegacyInput(input)).select('id').single()
  }

  return ownedInsert
}

export async function updateItem(id: string, input: NormalizedMediaItemWriteInput) {
  const user = await requireCurrentUser()
  const supabase = createSupabaseServerClient(user.accessToken)

  const snapshot = await getExistingOwnedProgressSnapshot(supabase, user.id, id)
  const currentProgress = getStoredProgressValue(snapshot.data, input.type)
  const shouldBumpProgressTimestamp = currentProgress !== input.progress
  const existingLastProgressAt =
    snapshot.data && 'last_progress_at' in snapshot.data ? snapshot.data.last_progress_at ?? null : null
  const ownedPayload = buildOwnedPayload(input, {
    preserveLastProgressAt: shouldBumpProgressTimestamp
      ? input.progress > 0
        ? new Date().toISOString()
        : null
      : existingLastProgressAt,
  })

  const ownedUpdate = await supabase
    .from('items')
    .update(ownedPayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (!ownedUpdate.error) {
    return ownedUpdate
  }

  if (isExtendedSchemaError(ownedUpdate.error.message)) {
    const metadataPayload = {
      ...toMetadataInput(input),
    }
    const metadataUpdate = await supabase
      .from('items')
      .update(metadataPayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle()

    if (!metadataUpdate.error) {
      return metadataUpdate
    }

    if (!isLegacyWriteFallbackError(metadataUpdate.error.message)) {
      return metadataUpdate
    }
  }

  if (isLegacyWriteFallbackError(ownedUpdate.error.message)) {
    const compatibilityUpdate = await supabase
      .from('items')
      .update(toCompatibilityInput(input))
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle()

    if (
      !compatibilityUpdate.error ||
      !isLegacyWriteFallbackError(compatibilityUpdate.error?.message)
    ) {
      return compatibilityUpdate
    }

    return supabase
      .from('items')
      .update(toLegacyInput(input))
      .eq('id', id)
      .select('id')
      .maybeSingle()
  }

  return ownedUpdate
}

export async function deleteItem(id: string) {
  const user = await requireCurrentUser()
  const supabase = createSupabaseServerClient(user.accessToken)
  const ownedDelete = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (!ownedDelete.error || !isMissingUserIdError(ownedDelete.error.message)) {
    return ownedDelete
  }

  return supabase.from('items').delete().eq('id', id).select('id').maybeSingle()
}

export async function updateItemFavorite(id: string, favorite: boolean) {
  const user = await requireCurrentUser()
  const supabase = createSupabaseServerClient(user.accessToken)
  const ownedUpdate = await supabase
    .from('items')
    .update({ favorite })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, favorite')
    .maybeSingle()

  if (
    !ownedUpdate.error ||
    (!isMissingUserIdError(ownedUpdate.error.message) && !isMetadataColumnError(ownedUpdate.error.message))
  ) {
    return ownedUpdate
  }

  if (isMissingColumnError(ownedUpdate.error.message, 'favorite')) {
    return ownedUpdate
  }

  return supabase
    .from('items')
    .update({ favorite })
    .eq('id', id)
    .select('id, favorite')
    .maybeSingle()
}

export async function incrementItemProgress(id: string) {
  const user = await requireCurrentUser()
  const supabase = createSupabaseServerClient(user.accessToken)

  const currentItem = await supabase
    .from('items')
    .select('id, type, status, progress, total_progress, last_progress_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (currentItem.error) {
    if (!isMissingUserIdError(currentItem.error.message) && !isExtendedSchemaError(currentItem.error.message)) {
      return currentItem
    }

    const legacyItem = await supabase
      .from('items')
      .select('id, type, status, progress, total_progress')
      .eq('id', id)
      .maybeSingle()

    if (legacyItem.error || !legacyItem.data) {
      return legacyItem
    }

    const totalProgress =
      isMovieType(legacyItem.data.type ?? '') ? 1 : legacyItem.data.total_progress ?? null
    const nextProgress =
      typeof totalProgress === 'number' && totalProgress > 0
        ? Math.min((legacyItem.data.progress ?? 0) + 1, totalProgress)
        : (legacyItem.data.progress ?? 0) + 1

    let nextStatus = legacyItem.data.status ?? getDefaultStatus(legacyItem.data.type ?? '')

    if (isMovieType(legacyItem.data.type ?? '') && nextProgress >= 1) {
      nextStatus = 'Completed'
    } else if (usesPageProgress(legacyItem.data.type ?? '') && nextStatus === 'Planning') {
      nextStatus = 'Reading'
    } else if (!usesPageProgress(legacyItem.data.type ?? '') && nextStatus === 'Planning') {
      nextStatus = 'Watching'
    }

    return supabase
      .from('items')
      .update({
        progress: nextProgress,
        status: nextStatus,
        total_progress: totalProgress,
      })
      .eq('id', id)
      .select('id, progress, total_progress')
      .maybeSingle()
  }

  if (!currentItem.data) {
    return currentItem
  }

  const isPaged = usesPageProgress(currentItem.data.type)
  const totalProgress = isPaged
    ? currentItem.data.total_progress
    : isMovieType(currentItem.data.type)
      ? 1
      : currentItem.data.total_progress
  const currentProgress = getStoredProgressValue(currentItem.data)
  const nextProgress =
    typeof totalProgress === 'number' && totalProgress > 0
      ? Math.min(currentProgress + 1, totalProgress)
      : currentProgress + 1

  let nextStatus = currentItem.data.status ?? getDefaultStatus(currentItem.data.type)

  if (isMovieType(currentItem.data.type) && nextProgress >= 1) {
    nextStatus = 'Completed'
  } else if (isPaged && nextStatus === 'Planning') {
    nextStatus = 'Reading'
  } else if (!isPaged && nextStatus === 'Planning') {
    nextStatus = 'Watching'
  }

  return supabase
    .from('items')
    .update({
      last_progress_at: new Date().toISOString(),
      progress: nextProgress,
      status: nextStatus,
      total_progress: totalProgress ?? null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, progress, total_progress')
    .maybeSingle()
}

export async function getPublicItemsByUserId(userId: string) {
  const supabase = createSupabaseServerClient()

  const fullResult = await orderFullQuery(
    supabase.from('items').select(fullItemSelectFields).eq('user_id', userId)
  )

  if (!fullResult.error) {
    return fullResult
  }

  if (isExtendedSchemaError(fullResult.error.message) || isMetadataColumnError(fullResult.error.message)) {
    if (isExtendedSchemaError(fullResult.error.message)) {
      const metadataResult = await orderCompatibilityQuery(
        supabase.from('items').select(metadataItemSelectFields).eq('user_id', userId)
      )

      if (!metadataResult.error) {
        return metadataResult
      }

      if (
        metadataResult.error.message &&
        !isMetadataColumnError(metadataResult.error.message) &&
        !isMissingUserIdError(metadataResult.error.message)
      ) {
        return metadataResult
      }
    }

    const compatibilityResult = await orderCompatibilityQuery(
      supabase.from('items').select(compatibilityItemSelectFields).eq('user_id', userId)
    )

    if (!compatibilityResult.error) {
      return compatibilityResult
    }

    if (
      isMissingUserIdError(compatibilityResult.error?.message) ||
      isMetadataColumnError(compatibilityResult.error?.message)
    ) {
      return supabase.from('items').select(legacyItemSelectFields).order('created_at', { ascending: false })
    }
  }

  if (isMissingUserIdError(fullResult.error.message) || isMetadataColumnError(fullResult.error.message)) {
    return supabase.from('items').select(legacyItemSelectFields).order('created_at', { ascending: false })
  }

  return fullResult
}

export async function getSharedItemsByUserId(userId: string) {
  const supabase = createSupabaseServerClient()

  const fullResult = await orderFullQuery(
    supabase.from('items').select(fullItemSelectFields).eq('user_id', userId)
  )

  if (!fullResult.error) {
    return fullResult
  }

  if (isExtendedSchemaError(fullResult.error.message)) {
    const metadataResult = await orderCompatibilityQuery(
      supabase.from('items').select(metadataItemSelectFields).eq('user_id', userId)
    )

    if (!metadataResult.error) {
      return metadataResult
    }

    if (
      metadataResult.error.message &&
      !isMetadataColumnError(metadataResult.error.message) &&
      !isMissingUserIdError(metadataResult.error.message)
    ) {
      return metadataResult
    }

    const compatibilityResult = await orderCompatibilityQuery(
      supabase.from('items').select(compatibilityItemSelectFields).eq('user_id', userId)
    )

    if (!compatibilityResult.error || !isMetadataColumnError(compatibilityResult.error?.message)) {
      return compatibilityResult
    }
  }

  if (isMissingUserIdError(fullResult.error.message)) {
    return {
      data: null,
      error: {
        message: 'Shared discovery needs the ownership migration so items can be filtered by owner id.',
      },
    }
  }

  return fullResult
}

export async function getDiscoveryHubItemsByUserId(
  userId: string,
  filters: DiscoveryHubFilters,
  viewer?: { accessToken: string; id: string } | null
): Promise<DiscoveryHubItemsResult> {
  const supabase =
    viewer?.id === userId ? createSupabaseServerClient(viewer.accessToken) : createSupabaseServerClient()

  const totalResult = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  const totalCount = totalResult.count ?? 0

  const fullQuery = applyDiscoveryFilters(
    supabase
      .from('items')
      .select(discoveryExtendedSelectFields, { count: 'exact' })
      .eq('user_id', userId),
    filters,
    {
      supportsGenres: true,
      supportsLastProgressAt: true,
      supportsNotes: true,
      supportsStartedAt: true,
    }
  )
  const fullResult = await fullQuery

  if (!fullResult.error) {
    return {
      data: (fullResult.data ?? []) as MediaItemRecord[],
      error: null,
      filteredCount: fullResult.count ?? fullResult.data?.length ?? 0,
      totalCount,
    }
  }

  if (isExtendedSchemaError(fullResult.error.message)) {
    const metadataQuery = applyDiscoveryFilters(
      supabase
        .from('items')
        .select(discoveryMetadataSelectFields, { count: 'exact' })
        .eq('user_id', userId),
      filters,
      {
        supportsGenres: true,
        supportsLastProgressAt: false,
        supportsNotes: true,
        supportsStartedAt: true,
      }
    )
    const metadataResult = await metadataQuery

    if (!metadataResult.error) {
      return {
        data: (metadataResult.data ?? []) as MediaItemRecord[],
        error: null,
        filteredCount: metadataResult.count ?? metadataResult.data?.length ?? 0,
        totalCount,
      }
    }

    if (
      metadataResult.error.message &&
      !isMetadataColumnError(metadataResult.error.message) &&
      !isMissingUserIdError(metadataResult.error.message)
    ) {
      return {
        data: null,
        error: metadataResult.error,
        filteredCount: 0,
        totalCount,
      }
    }

    const compatibilityQuery = applyDiscoveryFilters(
      supabase
        .from('items')
        .select(discoveryCompatibilitySelectFields, { count: 'exact' })
        .eq('user_id', userId),
      filters,
      {
        supportsGenres: true,
        supportsLastProgressAt: false,
        supportsNotes: true,
        supportsStartedAt: true,
      }
    )
    const compatibilityResult = await compatibilityQuery

    if (!compatibilityResult.error) {
      return {
        data: (compatibilityResult.data ?? []) as MediaItemRecord[],
        error: null,
        filteredCount: compatibilityResult.count ?? compatibilityResult.data?.length ?? 0,
        totalCount,
      }
    }

    if (
      isMissingUserIdError(compatibilityResult.error?.message) ||
      isMetadataColumnError(compatibilityResult.error?.message)
    ) {
      const legacyQuery = applyDiscoveryFilters(
        supabase.from('items').select(legacyItemSelectFields, { count: 'exact' }).eq('user_id', userId),
        filters,
        {
          supportsGenres: false,
          supportsLastProgressAt: false,
          supportsNotes: false,
          supportsStartedAt: false,
        }
      )
      const legacyResult = await legacyQuery

      return {
        data: (legacyResult.data ?? []) as MediaItemRecord[],
        error: legacyResult.error,
        filteredCount: legacyResult.count ?? legacyResult.data?.length ?? 0,
        totalCount,
      }
    }
  }

  if (isMissingUserIdError(fullResult.error.message) || isMetadataColumnError(fullResult.error.message)) {
    const legacyQuery = applyDiscoveryFilters(
      supabase.from('items').select(legacyItemSelectFields, { count: 'exact' }).eq('user_id', userId),
      filters,
      {
        supportsGenres: false,
        supportsLastProgressAt: false,
        supportsNotes: false,
        supportsStartedAt: false,
      }
    )
    const legacyResult = await legacyQuery

    return {
      data: (legacyResult.data ?? []) as MediaItemRecord[],
      error: legacyResult.error,
      filteredCount: legacyResult.count ?? legacyResult.data?.length ?? 0,
      totalCount,
    }
  }

  return {
    data: null,
    error: fullResult.error,
    filteredCount: 0,
    totalCount,
  }
}

export async function getDiscoveryHubGenresByUserId(
  userId: string,
  viewer?: { accessToken: string; id: string } | null
) {
  const supabase =
    viewer?.id === userId ? createSupabaseServerClient(viewer.accessToken) : createSupabaseServerClient()

  const fullResult: GenreRowsResult = await supabase
    .from('items')
    .select('genres')
    .eq('user_id', userId)

  if (!fullResult.error) {
    return normalizeDiscoveryHubGenres(fullResult.data)
  }

  if (isMissingColumnError(fullResult.error.message, 'genres')) {
    return []
  }

  if (isMissingUserIdError(fullResult.error.message)) {
    return []
  }

  return []
}

function normalizeDiscoveryHubGenres(rows: Array<{ genres?: string[] | null }> | null) {
  if (!rows || rows.length === 0) {
    return [] as string[]
  }

  return normalizeGenreList(
    rows.flatMap((row) => row.genres ?? []).filter((genre): genre is string => Boolean(genre))
  ).sort((left, right) => left.localeCompare(right))
}
