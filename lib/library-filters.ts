import { mediaStatuses, type MediaItem } from './media'

export type LibraryCoverFilter = 'all' | 'has-cover' | 'no-cover'
export type LibraryRatingFilter = 'all' | 'rated' | 'unrated' | '9-plus' | '8-plus' | '7-plus'
export type LibrarySortMode =
  | 'created-desc'
  | 'progress-desc'
  | 'rating-asc'
  | 'rating-desc'
  | 'status'
  | 'title-asc'
  | 'title-desc'
export type LibrarySourceFilter = 'all' | 'anilist' | 'manual' | 'myanimelist' | 'tmdb'

export type LibraryFilters = {
  cover: LibraryCoverFilter
  query: string
  rating: LibraryRatingFilter
  sort: LibrarySortMode
  source: LibrarySourceFilter
  status: string
}

export const defaultLibraryFilters: LibraryFilters = {
  cover: 'all',
  query: '',
  rating: 'all',
  sort: 'created-desc',
  source: 'all',
  status: 'all',
}

export const libraryStatusOptions = [
  { label: 'All statuses', value: 'all' },
  ...mediaStatuses.map((status) => ({ label: status, value: status })),
]

export const libraryCoverOptions: Array<{ label: string; value: LibraryCoverFilter }> = [
  { label: 'All items', value: 'all' },
  { label: 'Has cover', value: 'has-cover' },
  { label: 'No cover', value: 'no-cover' },
]

export const librarySourceOptions: Array<{ label: string; value: LibrarySourceFilter }> = [
  { label: 'All sources', value: 'all' },
  { label: 'MyAnimeList', value: 'myanimelist' },
  { label: 'AniList', value: 'anilist' },
  { label: 'TMDB', value: 'tmdb' },
  { label: 'Manual / Unknown', value: 'manual' },
]

export const libraryRatingOptions: Array<{ label: string; value: LibraryRatingFilter }> = [
  { label: 'All ratings', value: 'all' },
  { label: 'Rated', value: 'rated' },
  { label: 'Unrated', value: 'unrated' },
  { label: '9+', value: '9-plus' },
  { label: '8+', value: '8-plus' },
  { label: '7+', value: '7-plus' },
]

export const librarySortOptions: Array<{ label: string; value: LibrarySortMode }> = [
  { label: 'Recently added', value: 'created-desc' },
  { label: 'Title A-Z', value: 'title-asc' },
  { label: 'Title Z-A', value: 'title-desc' },
  { label: 'Highest rating', value: 'rating-desc' },
  { label: 'Lowest rating', value: 'rating-asc' },
  { label: 'Most progress', value: 'progress-desc' },
  { label: 'Status', value: 'status' },
]

export function hasSourceMetadata(items: MediaItem[]) {
  return items.some((item) => Boolean(item.externalSource?.trim()))
}

export function hasActiveLibraryFilters(filters: LibraryFilters, options?: { includeSort?: boolean }) {
  const includeSort = options?.includeSort ?? true

  return (
    filters.cover !== defaultLibraryFilters.cover ||
    filters.query.trim().length > 0 ||
    filters.rating !== defaultLibraryFilters.rating ||
    filters.source !== defaultLibraryFilters.source ||
    filters.status !== defaultLibraryFilters.status ||
    (includeSort && filters.sort !== defaultLibraryFilters.sort)
  )
}

export function filterAndSortMediaItems(
  items: MediaItem[],
  filters: LibraryFilters,
  options?: {
    enableSourceFilter?: boolean
  }
) {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase('en-US')
  const enableSourceFilter = options?.enableSourceFilter ?? true

  return items
    .filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.title.toLocaleLowerCase('en-US').includes(normalizedQuery) ||
        item.type.toLocaleLowerCase('en-US').includes(normalizedQuery) ||
        item.status.toLocaleLowerCase('en-US').includes(normalizedQuery) ||
        item.genres.some((genre) => genre.toLocaleLowerCase('en-US').includes(normalizedQuery)) ||
        (item.notes ?? '').toLocaleLowerCase('en-US').includes(normalizedQuery)

      if (!matchesQuery) {
        return false
      }

      if (filters.status !== 'all' && item.status !== filters.status) {
        return false
      }

      const hasCover = Boolean(item.imageUrl?.trim())
      if (filters.cover === 'has-cover' && !hasCover) {
        return false
      }

      if (filters.cover === 'no-cover' && hasCover) {
        return false
      }

      if (enableSourceFilter && filters.source !== 'all') {
        const source = normalizeSource(item.externalSource)

        if (source !== filters.source) {
          return false
        }
      }

      return matchesRatingFilter(item.rating, filters.rating)
    })
    .sort((left, right) => compareItems(left, right, filters.sort))
}

export function normalizeSource(source: string | null | undefined): LibrarySourceFilter {
  const normalized = source?.trim().toLocaleLowerCase('en-US') ?? ''

  if (normalized === 'myanimelist' || normalized === 'mal') {
    return 'myanimelist'
  }

  if (normalized === 'anilist') {
    return 'anilist'
  }

  if (normalized === 'tmdb') {
    return 'tmdb'
  }

  return 'manual'
}

function matchesRatingFilter(rating: number | null, filter: LibraryRatingFilter) {
  const hasRating = typeof rating === 'number' && rating > 0

  switch (filter) {
    case 'rated':
      return hasRating
    case 'unrated':
      return !hasRating
    case '9-plus':
      return hasRating && rating >= 9
    case '8-plus':
      return hasRating && rating >= 8
    case '7-plus':
      return hasRating && rating >= 7
    case 'all':
    default:
      return true
  }
}

function compareItems(left: MediaItem, right: MediaItem, sort: LibrarySortMode) {
  switch (sort) {
    case 'title-asc':
      return compareTitle(left, right)
    case 'title-desc':
      return compareTitle(right, left)
    case 'rating-desc':
      return compareRating(right, left)
    case 'rating-asc':
      return compareRating(left, right)
    case 'progress-desc':
      return right.progress - left.progress || compareLatestProgress(right, left)
    case 'status':
      return left.status.localeCompare(right.status) || compareTitle(left, right)
    case 'created-desc':
    default:
      return compareDate(right.createdAt, left.createdAt) || compareTitle(left, right)
  }
}

function compareTitle(left: MediaItem, right: MediaItem) {
  return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' })
}

function compareRating(left: MediaItem, right: MediaItem) {
  const leftRating = typeof left.rating === 'number' ? left.rating : null
  const rightRating = typeof right.rating === 'number' ? right.rating : null

  if (leftRating === null && rightRating === null) {
    return compareTitle(left, right)
  }

  if (leftRating === null) {
    return 1
  }

  if (rightRating === null) {
    return -1
  }

  return leftRating - rightRating || compareTitle(left, right)
}

function compareLatestProgress(left: MediaItem, right: MediaItem) {
  return compareDate(left.lastProgressAt ?? left.lastActivityAt, right.lastProgressAt ?? right.lastActivityAt)
}

function compareDate(left: string | null, right: string | null) {
  return new Date(left ?? 0).getTime() - new Date(right ?? 0).getTime()
}
