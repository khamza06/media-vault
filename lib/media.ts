import { normalizeGenreList } from './genres'

export const mediaStatuses = [
  'Planning',
  'Watching',
  'Reading',
  'Completed',
  'Dropped',
  'Re-Watching',
] as const

export const mediaTypes = [
  'Anime',
  'Manga',
  'Manhwa',
  'Manhua',
  'Movie',
  'TV Series',
  'Book',
] as const

export type MediaStatus = (typeof mediaStatuses)[number]
export type MediaType = (typeof mediaTypes)[number]
export type MediaProgressMode = 'episode' | 'chapter' | 'page'
export type MediaShelfKey = 'anime' | 'manga-family' | 'movies' | 'series' | 'books'

export type MediaItem = {
  completedAt: string | null
  createdAt: string | null
  currentEpisode: number | null
  currentPage: number | null
  externalId: string | null
  externalRatingLabel: string | null
  externalRatingValue: number | null
  externalSource: string | null
  favorite: boolean
  genres: string[]
  id: string
  imageUrl: string | null
  lastActivityAt: string | null
  lastProgressAt: string | null
  notes: string | null
  progress: number
  rating: number | null
  startedAt: string | null
  status: string
  title: string
  totalEpisodes: number | null
  totalPages: number | null
  totalProgress: number | null
  type: string
  userId: string | null
}

export type MediaItemRecord = {
  completed_at?: string | null
  created_at?: string | null
  external_id?: string | null
  external_rating_label?: string | null
  external_rating_value?: number | null
  external_source?: string | null
  favorite?: boolean | null
  genres?: string[] | null
  id: string
  image_url?: string | null
  last_progress_at?: string | null
  notes?: string | null
  progress?: number | null
  rating?: number | null
  started_at?: string | null
  status: string
  title: string
  total_episodes?: number | null
  total_pages?: number | null
  total_progress?: number | null
  type: string
  user_id?: string | null
}

export type MediaItemInput = {
  completedAt: string
  externalRatingLabel: string
  externalRatingValue: string
  favorite: boolean
  genres: string
  imageUrl: string
  notes: string
  progress: string
  rating: string
  startedAt: string
  status: string
  title: string
  totalProgress: string
  type: string
}

export type NormalizedMediaItemWriteInput = {
  completed_at: string | null
  external_rating_label: string | null
  external_rating_value: number | null
  favorite: boolean
  genres: string[]
  image_url: string | null
  last_progress_at: string | null
  notes: string | null
  progress: number
  rating: number | null
  started_at: string | null
  status: string
  title: string
  total_progress: number | null
  type: string
}

const pagedMediaTypes: MediaType[] = ['Manga', 'Manhwa', 'Manhua', 'Book']
const chapterMediaTypes: MediaType[] = ['Manga', 'Manhwa', 'Manhua']
const episodicMediaTypes: MediaType[] = ['Anime', 'Movie', 'TV Series']

const genreStopwords = new Set([
  'chapter',
  'chapters',
  'manga',
  'manhua',
  'manhwa',
  'new chapter',
  'new chapters',
  'online',
  'read',
  'watch',
  'watch online',
  'book',
  'books',
  'anime',
  'читать',
  'читать онлайн',
  'глава',
  'главы',
  'книга',
  'книги',
  'манга',
  'манхва',
  'маньхуа',
  'новая глава',
  'новые главы',
  'онлайн',
  'смотреть',
  'смотреть онлайн',
  'аниме',
])

const allowedStatusesByType: Record<MediaType, MediaStatus[]> = {
  Anime: ['Watching', 'Dropped', 'Completed', 'Planning', 'Re-Watching'],
  Manga: ['Reading', 'Planning', 'Dropped', 'Completed'],
  Manhwa: ['Reading', 'Planning', 'Dropped', 'Completed'],
  Manhua: ['Reading', 'Planning', 'Dropped', 'Completed'],
  Movie: ['Watching', 'Dropped', 'Completed', 'Planning', 'Re-Watching'],
  'TV Series': ['Watching', 'Dropped', 'Completed', 'Planning', 'Re-Watching'],
  Book: ['Reading', 'Planning', 'Dropped', 'Completed'],
}

const defaultStatusesByType: Record<MediaType, MediaStatus> = {
  Anime: 'Planning',
  Manga: 'Reading',
  Manhwa: 'Reading',
  Manhua: 'Reading',
  Movie: 'Planning',
  'TV Series': 'Planning',
  Book: 'Reading',
}

function isValidMediaType(value: string): value is MediaType {
  return mediaTypes.includes(value as MediaType)
}

function isValidMediaStatus(value: string): value is MediaStatus {
  return mediaStatuses.includes(value as MediaStatus)
}

function coercePositiveInteger(value: string, min: number) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)

  if (!Number.isInteger(parsed) || parsed < min) {
    return Number.NaN
  }

  return parsed
}

function getMaxIsoDate(...values: Array<string | null | undefined>) {
  const timestamps = values
    .map((value) => {
      if (!value) {
        return null
      }

      const timestamp = new Date(value).getTime()
      return Number.isNaN(timestamp) ? null : timestamp
    })
    .filter((value): value is number => value !== null)

  if (timestamps.length === 0) {
    return null
  }

  return new Date(Math.max(...timestamps)).toISOString()
}

export function usesPageProgress(type: string) {
  return pagedMediaTypes.includes(type as MediaType)
}

export function usesChapterProgress(type: string) {
  return chapterMediaTypes.includes(type as MediaType)
}

export function usesEpisodeProgress(type: string) {
  return episodicMediaTypes.includes(type as MediaType)
}

export function isMovieType(type: string) {
  return type === 'Movie'
}

export function getProgressMode(type: string): MediaProgressMode {
  if (usesChapterProgress(type)) {
    return 'chapter'
  }

  return usesPageProgress(type) ? 'page' : 'episode'
}

export function getAllowedStatuses(type: string) {
  if (!isValidMediaType(type)) {
    return [...allowedStatusesByType.Anime]
  }

  return [...allowedStatusesByType[type]]
}

export function getDefaultStatus(type: string): MediaStatus {
  if (!isValidMediaType(type)) {
    return defaultStatusesByType.Anime
  }

  return defaultStatusesByType[type]
}

export function getCurrentProgressLabel(type: string) {
  if (usesChapterProgress(type)) {
    return 'Current Chapter'
  }

  return usesPageProgress(type) ? 'Current Page' : 'Current Episode'
}

export function getTotalProgressLabel(type: string) {
  if (usesChapterProgress(type)) {
    return 'Total Chapters'
  }

  return usesPageProgress(type) ? 'Total Pages' : 'Total Episodes'
}

export function getProgressUnitLabel(type: string) {
  if (usesChapterProgress(type)) {
    return 'ch.'
  }

  if (usesPageProgress(type)) {
    return 'pg.'
  }

  if (isMovieType(type)) {
    return 'watch'
  }

  return 'ep.'
}

export function getMediaShelfKey(type: string): MediaShelfKey {
  switch (type) {
    case 'Anime':
      return 'anime'
    case 'Movie':
      return 'movies'
    case 'TV Series':
      return 'series'
    case 'Book':
      return 'books'
    case 'Manga':
    case 'Manhwa':
    case 'Manhua':
    default:
      return 'manga-family'
  }
}

export function normalizeGenresInput(value: string) {
  const cleaned = value
    .split(',')
    .map((genre) => genre.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .filter((genre) => !genreStopwords.has(genre.toLowerCase()))
    .filter((genre) => genre.length <= 32)

  return normalizeGenreList(cleaned).slice(0, 12)
}

export function normalizeMediaItemInput(
  input: MediaItemInput
): { data: NormalizedMediaItemWriteInput | null; error: string | null } {
  const title = input.title.trim()

  if (!title) {
    return { data: null, error: 'Title is required.' }
  }

  if (!isValidMediaType(input.type)) {
    return { data: null, error: 'Invalid media type.' }
  }

  if (!isValidMediaStatus(input.status)) {
    return { data: null, error: 'Invalid media status.' }
  }

  const allowedStatuses = getAllowedStatuses(input.type)

  if (!allowedStatuses.includes(input.status as MediaStatus)) {
    return {
      data: null,
      error: `Status "${input.status}" is not allowed for ${input.type}.`,
    }
  }

  const parsedProgress = coercePositiveInteger(input.progress, 0)
  const parsedTotalProgress = coercePositiveInteger(input.totalProgress, 1)
  const parsedRating = coercePositiveInteger(input.rating, 1)
  const parsedExternalRating =
    input.externalRatingValue.trim().length > 0 ? Number(input.externalRatingValue.trim()) : null
  const notes = input.notes.trim()
  const genres = normalizeGenresInput(input.genres)
  const startedAt = input.startedAt.trim()
  const completedAt = input.completedAt.trim()
  const externalRatingLabel = input.externalRatingLabel.trim()

  if (Number.isNaN(parsedProgress)) {
    return {
      data: null,
      error: `${getCurrentProgressLabel(input.type)} must be a whole number of 0 or more.`,
    }
  }

  if (Number.isNaN(parsedTotalProgress)) {
    return {
      data: null,
      error: `${getTotalProgressLabel(input.type)} must be a whole number of 1 or more.`,
    }
  }

  if (
    input.rating.trim() &&
    (parsedRating === null || Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 10)
  ) {
    return { data: null, error: 'Rating must be a whole number from 1 to 10.' }
  }

  if (startedAt && Number.isNaN(new Date(startedAt).getTime())) {
    return { data: null, error: 'Started date is invalid.' }
  }

  if (completedAt && Number.isNaN(new Date(completedAt).getTime())) {
    return { data: null, error: 'Completed date is invalid.' }
  }

  if (startedAt && completedAt && new Date(completedAt) < new Date(startedAt)) {
    return { data: null, error: 'Completed date cannot be earlier than started date.' }
  }

  if (
    parsedExternalRating !== null &&
    (Number.isNaN(parsedExternalRating) || parsedExternalRating < 0 || parsedExternalRating > 10)
  ) {
    return { data: null, error: 'External rating must be a number from 0 to 10.' }
  }

  let progress = parsedProgress ?? 0
  let totalProgress = parsedTotalProgress
  let status = input.status as MediaStatus

  if (isMovieType(input.type)) {
    totalProgress = 1
    progress = Math.min(progress, 1)

    if (status === 'Completed' && progress === 0) {
      progress = 1
    }

    if (progress >= 1) {
      status = 'Completed'
    }
  }

  if (totalProgress !== null && progress > totalProgress) {
    return {
      data: null,
      error: `${getCurrentProgressLabel(input.type)} cannot be greater than ${getTotalProgressLabel(
        input.type
      ).toLowerCase()}.`,
    }
  }

  const lastProgressAt = progress > 0 ? new Date().toISOString() : null

  return {
    data: {
      completed_at: completedAt || null,
      external_rating_label: externalRatingLabel || null,
      external_rating_value: parsedExternalRating,
      favorite: input.favorite,
      genres,
      image_url: input.imageUrl.trim() || null,
      last_progress_at: lastProgressAt,
      notes: notes || null,
      progress,
      rating: parsedRating,
      started_at: startedAt || null,
      status,
      title,
      total_progress: totalProgress,
      type: input.type,
    },
    error: null,
  }
}

export function toMediaItem(record: MediaItemRecord): MediaItem {
  const isPaged = usesPageProgress(record.type)
  const currentPage = isPaged ? record.progress ?? 0 : null
  const currentEpisode = !isPaged ? record.progress ?? 0 : null
  const totalPages = isPaged ? (record.total_pages ?? record.total_progress ?? null) : null
  const totalEpisodes = !isPaged
    ? record.type === 'Movie'
      ? record.total_episodes ?? record.total_progress ?? 1
      : record.total_episodes ?? record.total_progress ?? null
    : null
  const progress = isPaged ? currentPage ?? 0 : currentEpisode ?? 0
  const totalProgress = isPaged ? totalPages : totalEpisodes
  const lastProgressAt = record.last_progress_at ?? null

  return {
    completedAt: record.completed_at ?? null,
    createdAt: record.created_at ?? null,
    currentEpisode,
    currentPage,
    externalId: record.external_id ?? null,
    externalRatingLabel: record.external_rating_label ?? null,
    externalRatingValue: record.external_rating_value ?? null,
    externalSource: record.external_source ?? null,
    favorite: record.favorite ?? false,
    genres: normalizeGenreList(record.genres ?? []),
    id: record.id,
    imageUrl: record.image_url ?? null,
    lastActivityAt: getMaxIsoDate(lastProgressAt, record.created_at),
    lastProgressAt,
    notes: record.notes ?? null,
    progress,
    rating: record.rating ?? null,
    startedAt: record.started_at ?? null,
    status: record.status,
    title: record.title,
    totalEpisodes,
    totalPages,
    totalProgress,
    type: record.type,
    userId: record.user_id ?? null,
  }
}

export function formatGenres(genres: string[]) {
  if (genres.length === 0) {
    return 'No genres'
  }

  return genres.join(', ')
}

export function formatProgressValue(item: Pick<MediaItem, 'progress' | 'totalProgress' | 'type'>) {
  const unit = getProgressUnitLabel(item.type)

  if (item.totalProgress && item.totalProgress > 0) {
    return `${unit} ${item.progress} / ${item.totalProgress}`
  }

  if (item.progress > 0) {
    return `${unit} ${item.progress}`
  }

  return 'Not started yet'
}
