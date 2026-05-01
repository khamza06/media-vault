import 'server-only'

import type { CatalogProvider, CatalogSearchCandidate } from './catalog-types'
import { normalizeGenreList } from './genres'
import type { Locale } from './i18n'
import type { QuickImportTypeHint } from './quick-import-parser'
import { mapCatalogSearchTypeToMediaType, type CatalogSearchType } from './search-safety'

const ANILIST_ANIME_FORMATS = new Set([
  'MOVIE',
  'MUSIC',
  'ONA',
  'OVA',
  'SPECIAL',
  'TV',
  'TV_SHORT',
])

export class CatalogSearchProviderError extends Error {
  provider: CatalogProvider
  status: number | null

  constructor(provider: CatalogProvider, message: string, status: number | null = null) {
    super(message)
    this.name = 'CatalogSearchProviderError'
    this.provider = provider
    this.status = status
  }
}

export function isCatalogSearchProviderError(
  error: unknown
): error is CatalogSearchProviderError {
  return error instanceof CatalogSearchProviderError
}

function sanitizeGenres(genres: string[]) {
  return normalizeGenreList(genres).join(', ')
}

function normalizeExternalRating(value: number | string | null | undefined) {
  const parsed = typeof value === 'number' ? value : value ? Number(value) : null

  if (parsed === null || Number.isNaN(parsed) || parsed <= 0) {
    return null
  }

  return Math.round(parsed * 10) / 10
}

function getTmdbLanguage() {
  return 'en-US'
}

function getTmdbApiKey() {
  return process.env.NEXT_PUBLIC_TMDB_API_KEY ?? process.env.TMDB_API_KEY ?? ''
}

function getSafeImageUrl(imageUrl: string, isAdult?: boolean) {
  return isAdult ? '' : imageUrl
}

function getPreferredAniListTitle(
  title:
    | {
        english?: string | null
        native?: string | null
        romaji?: string | null
        userPreferred?: string | null
      }
    | null
    | undefined
) {
  if (!title) {
    return ''
  }

  return (
    title.english?.trim() ||
    title.romaji?.trim() ||
    title.userPreferred?.trim() ||
    title.native?.trim() ||
    ''
  )
}

function normalizeComparableText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactComparableText(value: string) {
  return normalizeComparableText(value).replace(/\s+/g, '')
}

function scoreCandidateTitle(title: string, searchTerms: string[]) {
  const normalizedTitle = normalizeComparableText(title)
  const compactTitle = compactComparableText(title)

  if (!normalizedTitle) {
    return 0
  }

  let bestScore = 0

  for (const rawSearchTerm of searchTerms) {
    const normalizedSearchTerm = normalizeComparableText(rawSearchTerm)
    const compactSearchTerm = compactComparableText(rawSearchTerm)

    if (!normalizedSearchTerm) {
      continue
    }

    if (
      normalizedTitle === normalizedSearchTerm ||
      compactTitle === compactSearchTerm ||
      compactTitle === compactSearchTerm.replace(/^\d+/, '')
    ) {
      return 1
    }

    if (normalizedTitle.includes(normalizedSearchTerm) || normalizedSearchTerm.includes(normalizedTitle)) {
      bestScore = Math.max(bestScore, 0.88)
      continue
    }

    const titleTokens = normalizedTitle.split(' ')
    const searchTokens = normalizedSearchTerm.split(' ')
    const sharedTokens = searchTokens.filter((token) => titleTokens.includes(token))
    const coverage = sharedTokens.length / Math.max(searchTokens.length, 1)

    if (coverage > 0) {
      bestScore = Math.max(bestScore, Math.min(0.82, 0.5 + coverage * 0.3))
    }

    if (compactTitle.startsWith(compactSearchTerm) || compactSearchTerm.startsWith(compactTitle)) {
      bestScore = Math.max(bestScore, 0.76)
    }
  }

  return bestScore
}

function getProviderPriority(provider: CatalogSearchCandidate['provider']) {
  switch (provider) {
    case 'Shikimori':
      return 5
    case 'TMDB':
      return 4
    case 'AniList':
      return 3
    case 'Jikan':
      return 2
    case 'Kitsu':
      return 1
    case 'OpenLibrary':
      return 1
    default:
      return 0
  }
}

function dedupeCandidates(candidates: CatalogSearchCandidate[]) {
  const seen = new Set<string>()
  const unique: CatalogSearchCandidate[] = []

  for (const candidate of candidates) {
    const key = `${compactComparableText(candidate.title)}::${candidate.type}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    unique.push(candidate)
  }

  return unique
}

function rankCandidates(candidates: CatalogSearchCandidate[]) {
  return dedupeCandidates(candidates).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }

    return getProviderPriority(right.provider) - getProviderPriority(left.provider)
  })
}

function buildCandidate(
  candidate: Omit<CatalogSearchCandidate, 'score'>,
  searchTerms: string[]
): CatalogSearchCandidate {
  const baseScore = scoreCandidateTitle(candidate.title, searchTerms)
  const metadataBonus = Math.min(
    0.08,
    (candidate.imageUrl ? 0.02 : 0) +
      (candidate.genres ? 0.03 : 0) +
      (candidate.totalProgress ? 0.03 : 0)
  )

  return {
    ...candidate,
    imageUrl: getSafeImageUrl(candidate.imageUrl, candidate.isAdult),
    score: Math.min(1, baseScore + metadataBonus),
  }
}

function resolveAniListType(
  mediaType: QuickImportTypeHint,
  country: string | null | undefined,
  format: string | null | undefined
) {
  if (mediaType === 'ANIME' || ANILIST_ANIME_FORMATS.has(format ?? '')) {
    return 'Anime'
  }

  if (format === 'NOVEL') {
    return 'Book'
  }

  if (country === 'KR') {
    return 'Manhwa'
  }

  if (country === 'CN') {
    return 'Manhua'
  }

  return 'Manga'
}

function getShikimoriImageUrl(image?: {
  original?: string | null
  preview?: string | null
  x160?: string | null
} | null) {
  const path = image?.original ?? image?.preview ?? image?.x160 ?? ''

  if (!path) {
    return ''
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  return `https://shikimori.one${path}`
}

async function safeFetchJson<T>(input: string, init?: RequestInit) {
  try {
    const response = await fetch(input, init)

    if (!response.ok) {
      return null as T | null
    }

    return (await response.json()) as T
  } catch {
    return null as T | null
  }
}

function getProviderPayloadMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as {
    error?: unknown
    errors?: unknown
    message?: unknown
    status_message?: unknown
  }

  if (typeof record.status_message === 'string') {
    return record.status_message
  }

  if (typeof record.message === 'string') {
    return record.message
  }

  if (typeof record.error === 'string') {
    return record.error
  }

  if (Array.isArray(record.errors)) {
    const firstError = record.errors.find(
      (error): error is { message?: unknown } => Boolean(error) && typeof error === 'object'
    )

    if (typeof firstError?.message === 'string') {
      return firstError.message
    }
  }

  return null
}

function getProviderPayloadStatus(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as {
    errors?: unknown
    status?: unknown
    status_code?: unknown
  }

  if (typeof record.status === 'number') {
    return record.status
  }

  if (typeof record.status_code === 'number') {
    return record.status_code
  }

  if (Array.isArray(record.errors)) {
    const firstError = record.errors.find(
      (error): error is { status?: unknown } => Boolean(error) && typeof error === 'object'
    )

    if (typeof firstError?.status === 'number') {
      return firstError.status
    }
  }

  return null
}

async function fetchProviderJson<T>(
  provider: CatalogProvider,
  input: string,
  init?: RequestInit
) {
  try {
    const response = await fetch(input, init)
    const rawBody = await response.text()
    let payload: unknown = null

    if (rawBody) {
      try {
        payload = JSON.parse(rawBody)
      } catch {
        payload = null
      }
    }

    console.info('[catalog-search] provider response', {
      ok: response.ok,
      provider,
      status: response.status,
    })

    if (!response.ok) {
      const providerMessage = getProviderPayloadMessage(payload)
      const message = providerMessage
        ? `${provider} search failed: ${providerMessage}`
        : `${provider} search failed with status ${response.status}.`

      throw new CatalogSearchProviderError(provider, message, response.status)
    }

    return payload as T
  } catch (error) {
    if (isCatalogSearchProviderError(error)) {
      throw error
    }

    const message = error instanceof Error ? error.message : 'Network request failed.'

    console.warn('[catalog-search] provider request failed', {
      message,
      provider,
      status: null,
    })

    throw new CatalogSearchProviderError(
      provider,
      `${provider} search is temporarily unavailable.`,
      null
    )
  }
}

function throwProviderGraphQLError(provider: CatalogProvider, payload: unknown) {
  const providerMessage = getProviderPayloadMessage(payload)

  if (!providerMessage) {
    return
  }

  throw new CatalogSearchProviderError(
    provider,
    `${provider} search failed: ${providerMessage}`,
    getProviderPayloadStatus(payload)
  )
}

function logProviderResult(provider: CatalogProvider, resultCount: number) {
  console.info('[catalog-search] provider result', {
    provider,
    resultCount,
  })
}

export async function searchShikimoriCandidates(
  searchTerms: string[],
  typeHint: QuickImportTypeHint
) {
  const endpoints =
    typeHint === 'ANIME'
      ? (['animes'] as const)
      : typeHint === 'MANGA'
        ? (['mangas'] as const)
        : (['animes', 'mangas'] as const)

  const results = await Promise.all(
    searchTerms.flatMap((searchTerm) =>
      endpoints.map(async (endpoint) => {
        const payload = await safeFetchJson<
          Array<{
            chapters?: number | null
            episodes?: number | null
            id: number
            image?: {
              original?: string | null
              preview?: string | null
              x160?: string | null
            } | null
            kind?: string | null
            name?: string | null
            poster?: {
              mainUrl?: string | null
              originalUrl?: string | null
            } | null
            russian?: string | null
              score?: number | string | null
          }>
        >(
          `https://shikimori.one/api/${endpoint}?search=${encodeURIComponent(searchTerm)}&limit=5&censored=true`,
          {
            cache: 'no-store',
            headers: {
              Accept: 'application/json',
              'User-Agent': 'MediaVault/1.0',
            },
          }
        )

        if (!payload) {
          return [] as CatalogSearchCandidate[]
        }

        return payload
          .map((item) => {
            const title = item.name?.trim() || item.russian?.trim() || ''

            if (!title) {
              return null
            }

            const isAnime = endpoint === 'animes'
            const kind = item.kind?.toLowerCase() ?? ''
            const type = isAnime
              ? 'Anime'
              : kind.includes('manhwa')
                ? 'Manhwa'
                : kind.includes('manhua')
                  ? 'Manhua'
                  : 'Manga'
            const totalProgress = isAnime ? String(item.episodes ?? '') : String(item.chapters ?? '')
            const imageUrl =
              item.poster?.originalUrl ??
              item.poster?.mainUrl ??
              getShikimoriImageUrl(item.image)

            return buildCandidate(
              {
              description: '',
              externalRatingLabel: 'MyAnimeList',
              externalRatingValue: normalizeExternalRating(item.score),
              genres: '',
              id: `shikimori:${endpoint}:${item.id}`,
                imageUrl,
                provider: 'Shikimori',
                status: isAnime ? 'Planning' : 'Reading',
                subtitle: item.kind ?? 'Shikimori',
                title,
                totalProgress: totalProgress === '0' ? '' : totalProgress,
                type,
                year: null,
              },
              searchTerms
            )
          })
          .filter((candidate): candidate is CatalogSearchCandidate => candidate !== null)
      })
    )
  )

  return rankCandidates(results.flat())
}

type TmdbGenre = { id: number; name: string }

async function getTmdbGenres(apiKey: string, mediaType: 'movie' | 'tv') {
  const payload = await safeFetchJson<{ genres?: TmdbGenre[] }>(
    `https://api.themoviedb.org/3/genre/${mediaType}/list?api_key=${apiKey}&language=${getTmdbLanguage()}`,
    {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    }
  )

  if (!payload) {
    return new Map<number, string>()
  }

  return new Map((payload.genres ?? []).map((genre) => [genre.id, genre.name]))
}

async function getTmdbDetails(
  apiKey: string,
  id: number,
  mediaType: 'movie' | 'tv'
) {
  return safeFetchJson<{
    genres?: Array<{ id: number; name: string }>
    number_of_episodes?: number | null
    poster_path?: string | null
    release_date?: string | null
    first_air_date?: string | null
    vote_average?: number | null
  }>(
    `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${apiKey}&language=${getTmdbLanguage()}`,
    {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    }
  )
}

export async function searchTmdbCandidatesByType(
  searchTerms: string[],
  mediaType: 'movie' | 'tv'
) {
  const apiKey = getTmdbApiKey()

  if (!apiKey) {
    throw new CatalogSearchProviderError('TMDB', 'TMDB API key is not configured.', null)
  }

  const genreMap = await getTmdbGenres(apiKey, mediaType)
  const results = await Promise.all(
    searchTerms.map(async (searchTerm) => {
      const payload = await fetchProviderJson<{
        results?: Array<{
          adult?: boolean | null
          first_air_date?: string | null
          genre_ids?: number[]
          id: number
          name?: string | null
          original_name?: string | null
          original_title?: string | null
          poster_path?: string | null
          release_date?: string | null
          title?: string | null
          vote_average?: number | null
        }>
        status_message?: string
      }>(
        'TMDB',
        `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&language=${getTmdbLanguage()}&include_adult=false&query=${encodeURIComponent(searchTerm)}`,
        {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        }
      )

      const candidates = await Promise.all(
        (payload.results ?? []).slice(0, 5).map(async (item) => {
          const title =
            item.title?.trim() ||
            item.name?.trim() ||
            item.original_title?.trim() ||
            item.original_name?.trim() ||
            ''

          if (!title) {
            return null
          }

          const details = await getTmdbDetails(apiKey, item.id, mediaType)
          const genres =
            details?.genres?.map((genre) => genre.name).filter(Boolean) ??
            (item.genre_ids ?? []).map((id) => genreMap.get(id) ?? '').filter(Boolean)
          const imagePath = details?.poster_path ?? item.poster_path ?? ''
          const rawYear =
            mediaType === 'tv'
              ? details?.first_air_date ?? item.first_air_date ?? null
              : details?.release_date ?? item.release_date ?? null

          return buildCandidate(
            {
              description: '',
              externalRatingLabel: 'TMDB',
              externalRatingValue: normalizeExternalRating(
                details?.vote_average ?? item.vote_average ?? null
              ),
              genres: sanitizeGenres(genres),
              id: `tmdb:${mediaType}:${item.id}`,
              imageUrl: imagePath ? `https://image.tmdb.org/t/p/w780${imagePath}` : '',
              isAdult: item.adult ?? false,
              provider: 'TMDB',
              status: 'Planning',
              subtitle: mediaType === 'tv' ? 'TV Series' : 'Movie',
              title,
              totalProgress:
                mediaType === 'tv' && details?.number_of_episodes
                  ? String(details.number_of_episodes)
                  : '',
              type: mediaType === 'tv' ? 'TV Series' : 'Movie',
              year: rawYear?.slice(0, 4) ?? null,
            },
            searchTerms
          )
        })
      )

      const validCandidates = candidates.filter(
        (candidate): candidate is CatalogSearchCandidate => candidate !== null
      )

      logProviderResult('TMDB', validCandidates.length)
      return validCandidates
    })
  )

  return rankCandidates(results.flat())
}

export async function searchAniListCandidates(
  searchTerms: string[],
  typeHint: QuickImportTypeHint
) {
  const results = await Promise.all(
    searchTerms.map(async (searchTerm) => {
      const payload = await fetchProviderJson<{
        data?: {
          Page?: {
            media?: Array<{
              chapters?: number | null
              countryOfOrigin?: string | null
              coverImage?: {
                extraLarge?: string | null
                large?: string | null
              } | null
              episodes?: number | null
              format?: string | null
              genres?: string[] | null
              id: number
              isAdult?: boolean | null
              averageScore?: number | null
              startDate?: {
                year?: number | null
              } | null
              title?: {
                english?: string | null
                native?: string | null
                romaji?: string | null
                userPreferred?: string | null
              } | null
              volumes?: number | null
            }>
          }
        }
        errors?: Array<{ message?: string; status?: number }>
      }>('AniList', 'https://graphql.anilist.co', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query QuickImportCandidates($search: String!, $type: MediaType) {
              Page(perPage: 5) {
                media(search: $search, type: $type, isAdult: false, sort: SEARCH_MATCH) {
                  chapters
                  countryOfOrigin
                  coverImage {
                    extraLarge
                    large
                  }
                  episodes
                  format
                  genres
                  id
                  isAdult
                  averageScore
                  startDate {
                    year
                  }
                  title {
                    english
                    native
                    romaji
                    userPreferred
                  }
                  volumes
                }
              }
            }
          `,
          variables: {
            search: searchTerm,
            type: typeHint,
          },
        }),
      })

      throwProviderGraphQLError('AniList', payload)

      const candidates = (payload.data?.Page?.media ?? [])
        .map((media) => {
          const title = getPreferredAniListTitle(media.title)

          if (!title) {
            return null
          }

          const type = resolveAniListType(typeHint, media.countryOfOrigin, media.format)
          const totalProgress =
            type === 'Anime'
              ? String(media.episodes ?? '')
              : String(media.chapters ?? media.volumes ?? '')

          return buildCandidate(
            {
              description: '',
              externalRatingLabel: media.averageScore ? 'AniList' : null,
              externalRatingValue:
                typeof media.averageScore === 'number'
                  ? normalizeExternalRating(media.averageScore / 10)
                  : null,
              genres: sanitizeGenres(media.genres ?? []),
              id: `anilist:${media.id}`,
              imageUrl: media.coverImage?.extraLarge ?? media.coverImage?.large ?? '',
              isAdult: media.isAdult ?? false,
              provider: 'AniList',
              status: type === 'Anime' || type === 'Book' ? 'Planning' : 'Reading',
              subtitle: media.format ?? 'AniList',
              title,
              totalProgress: totalProgress === '0' ? '' : totalProgress,
              type,
              year: media.startDate?.year ? String(media.startDate.year) : null,
            },
            searchTerms
          )
        })
        .filter((candidate): candidate is CatalogSearchCandidate => candidate !== null)

      logProviderResult('AniList', candidates.length)
      return candidates
    })
  )

  return rankCandidates(results.flat())
}

export async function searchJikanCandidates(
  searchTerms: string[],
  typeHint: QuickImportTypeHint,
  locale: 'en' | 'ru' = 'en'
) {
  const endpoints =
    typeHint === 'ANIME'
      ? (['anime'] as const)
      : typeHint === 'MANGA'
        ? (['manga'] as const)
        : (['anime', 'manga'] as const)

  const results = await Promise.all(
    searchTerms.flatMap((searchTerm) =>
      endpoints.map(async (endpoint) => {
        const payload = await safeFetchJson<{
          data?: Array<{
            chapters?: number | null
            demographics?: Array<{ name?: string | null }>
            episodes?: number | null
            genres?: Array<{ name?: string | null }>
            images?: {
              jpg?: {
                image_url?: string | null
                large_image_url?: string | null
              } | null
              webp?: {
                image_url?: string | null
                large_image_url?: string | null
              } | null
            } | null
            mal_id: number
            score?: number | null
            themes?: Array<{ name?: string | null }>
            title?: string | null
            title_english?: string | null
            title_japanese?: string | null
            title_synonyms?: string[] | null
            type?: string | null
            year?: number | null
          }>
        }>(
          `https://api.jikan.moe/v4/${endpoint}?q=${encodeURIComponent(searchTerm)}&limit=5&sfw=true`,
          {
            cache: 'no-store',
            headers: {
              Accept: 'application/json',
            },
          }
        )

        if (!payload) {
          return [] as CatalogSearchCandidate[]
        }

        return (payload.data ?? [])
          .map((item) => {
            const title =
              locale === 'ru'
                ? item.title?.trim() ||
                  item.title_english?.trim() ||
                  item.title_japanese?.trim() ||
                  item.title_synonyms?.find(Boolean)?.trim() ||
                  ''
                : item.title_english?.trim() ||
                  item.title?.trim() ||
                  item.title_japanese?.trim() ||
                  item.title_synonyms?.find(Boolean)?.trim() ||
                  ''

            if (!title) {
              return null
            }

            const isAnime = endpoint === 'anime'
            const totalProgress = isAnime ? String(item.episodes ?? '') : String(item.chapters ?? '')
            const genres = [
              ...(item.genres ?? []).map((genre) => genre.name ?? ''),
              ...(item.themes ?? []).map((theme) => theme.name ?? ''),
              ...(item.demographics ?? []).map((demo) => demo.name ?? ''),
            ].filter(Boolean)

            return buildCandidate(
              {
              description: '',
              externalRatingLabel: item.score ? 'MyAnimeList' : null,
              externalRatingValue: normalizeExternalRating(item.score),
              genres: sanitizeGenres(genres),
                id: `jikan:${endpoint}:${item.mal_id}`,
                imageUrl:
                  item.images?.webp?.large_image_url ??
                  item.images?.jpg?.large_image_url ??
                  item.images?.webp?.image_url ??
                  item.images?.jpg?.image_url ??
                  '',
                provider: 'Jikan',
                status: isAnime ? 'Planning' : 'Reading',
                subtitle: item.type ?? 'Jikan',
                title,
                totalProgress: totalProgress === '0' ? '' : totalProgress,
                type: isAnime ? 'Anime' : 'Manga',
                year: item.year ? String(item.year) : null,
              },
              searchTerms
            )
          })
          .filter((candidate): candidate is CatalogSearchCandidate => candidate !== null)
      })
    )
  )

  return rankCandidates(results.flat())
}

export async function searchKitsuCandidates(
  searchTerms: string[],
  typeHint: QuickImportTypeHint,
  locale: 'en' | 'ru' = 'en'
) {
  const endpoints =
    typeHint === 'ANIME'
      ? (['anime'] as const)
      : typeHint === 'MANGA'
        ? (['manga'] as const)
        : (['anime', 'manga'] as const)

  const results = await Promise.all(
    searchTerms.flatMap((searchTerm) =>
      endpoints.map(async (endpoint) => {
        const payload = await safeFetchJson<{
          data?: Array<{
            attributes?: {
              averageRating?: string | null
              abbreviatedTitles?: string[] | null
              canonicalTitle?: string | null
              chapterCount?: number | null
              episodeCount?: number | null
              posterImage?: {
                large?: string | null
                original?: string | null
                small?: string | null
              } | null
              startDate?: string | null
              subtype?: string | null
              titles?: Record<string, string | null> | null
            } | null
            id: string
          }>
        }>(
          `https://kitsu.io/api/edge/${endpoint}?filter[text]=${encodeURIComponent(searchTerm)}&page[limit]=5`,
          {
            cache: 'no-store',
            headers: {
              Accept: 'application/vnd.api+json',
            },
          }
        )

        if (!payload) {
          return [] as CatalogSearchCandidate[]
        }

        return (payload.data ?? [])
          .map((item) => {
            const attributes = item.attributes
            const title =
              locale === 'ru'
                ? attributes?.canonicalTitle ??
                  attributes?.titles?.en_jp ??
                  attributes?.titles?.en ??
                  attributes?.abbreviatedTitles?.find(Boolean) ??
                  ''
                : attributes?.titles?.en ??
                  attributes?.titles?.en_jp ??
                  attributes?.canonicalTitle ??
                  attributes?.abbreviatedTitles?.find(Boolean) ??
                  ''

            if (!title) {
              return null
            }

            const isAnime = endpoint === 'anime'
            const subtype = attributes?.subtype?.toLowerCase() ?? ''
            const type = isAnime
              ? 'Anime'
              : subtype.includes('manhwa')
                ? 'Manhwa'
                : subtype.includes('manhua')
                  ? 'Manhua'
                  : 'Manga'
            const totalProgress = isAnime
              ? String(attributes?.episodeCount ?? '')
              : String(attributes?.chapterCount ?? '')

            return buildCandidate(
              {
                description: '',
                genres: '',
                id: `kitsu:${endpoint}:${item.id}`,
                imageUrl:
                  attributes?.posterImage?.original ??
                  attributes?.posterImage?.large ??
                  attributes?.posterImage?.small ??
                  '',
                provider: 'Kitsu',
                status: isAnime ? 'Planning' : 'Reading',
                subtitle: attributes?.subtype ?? 'Kitsu',
                title,
                totalProgress: totalProgress === '0' ? '' : totalProgress,
                type,
                year: attributes?.startDate?.slice(0, 4) ?? null,
              },
              searchTerms
            )
          })
          .filter((candidate): candidate is CatalogSearchCandidate => candidate !== null)
      })
    )
  )

  return rankCandidates(results.flat())
}

export async function searchUniversalCatalog(
  searchTerms: string[],
  typeHint: QuickImportTypeHint,
  _locale: Locale
) {
  void _locale
  const [tmdbMovies, tmdbSeries, aniList] = await Promise.all([
    searchTmdbCandidatesByType(searchTerms, 'movie'),
    searchTmdbCandidatesByType(searchTerms, 'tv'),
    searchAniListCandidates(searchTerms, typeHint),
  ])

  const tmdb = rankCandidates([...tmdbMovies, ...tmdbSeries])
  const ordered = typeHint === 'ANIME' || typeHint === 'MANGA' ? [...aniList, ...tmdb] : [...tmdb, ...aniList]

  return rankCandidates(ordered).slice(0, 8)
}

export async function searchOpenLibraryCandidates(searchTerms: string[]) {
  const results = await Promise.all(
    searchTerms.map(async (searchTerm) => {
      const payload = await safeFetchJson<{
        docs?: Array<{
          cover_i?: number | null
          first_publish_year?: number | null
          key?: string | null
          title?: string | null
        }>
      }>(
        `https://openlibrary.org/search.json?title=${encodeURIComponent(searchTerm)}&limit=5`,
        {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        }
      )

      if (!payload) {
        return [] as CatalogSearchCandidate[]
      }

      return (payload.docs ?? [])
        .map((item) => {
          const title = item.title?.trim() ?? ''

          if (!title) {
            return null
          }

          return buildCandidate(
            {
              description: '',
              externalRatingLabel: null,
              externalRatingValue: null,
              genres: '',
              id: `openlibrary:${item.key ?? title}`,
              imageUrl: item.cover_i
                ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg`
                : '',
              provider: 'OpenLibrary',
              status: 'Planning',
              subtitle: 'Book',
              title,
              totalProgress: '',
              type: 'Book',
              year: item.first_publish_year ? String(item.first_publish_year) : null,
            },
            searchTerms
          )
        })
        .filter((candidate): candidate is CatalogSearchCandidate => candidate !== null)
    })
  )

  return rankCandidates(results.flat())
}

function lockCandidateType(candidates: CatalogSearchCandidate[], selectedType: CatalogSearchType) {
  const lockedType = mapCatalogSearchTypeToMediaType(selectedType)

  return candidates.map((candidate) => ({
    ...candidate,
    type: lockedType,
  }))
}

async function runCatalogProvider(
  provider: CatalogProvider,
  operation: () => Promise<CatalogSearchCandidate[]>,
  providerErrors?: CatalogSearchProviderError[]
) {
  try {
    return await operation()
  } catch (error) {
    if (isCatalogSearchProviderError(error)) {
      providerErrors?.push(error)
      console.warn('[catalog-search] provider failed', {
        message: error.message,
        provider: error.provider,
        status: error.status,
      })

      return [] as CatalogSearchCandidate[]
    }

    console.warn('[catalog-search] provider failed', {
      message: error instanceof Error ? error.message : 'Unknown provider error.',
      provider,
      status: null,
    })

    return [] as CatalogSearchCandidate[]
  }
}

async function searchAnimeMangaWithFallbacks(
  searchTerms: string[],
  typeHint: Exclude<QuickImportTypeHint, null>,
  selectedType: CatalogSearchType,
  locale: Locale
) {
  const providerErrors: CatalogSearchProviderError[] = []
  const aniList = await runCatalogProvider('AniList', () =>
    searchAniListCandidates(searchTerms, typeHint),
    providerErrors
  )

  if (aniList.length > 0) {
    return lockCandidateType(aniList.slice(0, 8), selectedType)
  }

  const [jikan, kitsu, shikimori] = await Promise.all([
    runCatalogProvider('Jikan', () => searchJikanCandidates(searchTerms, typeHint, locale)),
    runCatalogProvider('Kitsu', () => searchKitsuCandidates(searchTerms, typeHint, locale)),
    runCatalogProvider('Shikimori', () => searchShikimoriCandidates(searchTerms, typeHint)),
  ])
  const fallbackCandidates = rankCandidates([...jikan, ...kitsu, ...shikimori]).slice(0, 8)

  if (fallbackCandidates.length === 0 && providerErrors.length > 0) {
    const [firstError] = providerErrors
    throw new CatalogSearchProviderError(
      firstError.provider,
      `${firstError.message} Fallback providers returned no matches.`,
      firstError.status
    )
  }

  return lockCandidateType(fallbackCandidates, selectedType)
}

export async function searchCatalogByMediaType(
  searchTerms: string[],
  selectedType: CatalogSearchType,
  locale: Locale
) {
  if (selectedType === 'anime') {
    return searchAnimeMangaWithFallbacks(searchTerms, 'ANIME', selectedType, locale)
  }

  if (selectedType === 'manga') {
    return searchAnimeMangaWithFallbacks(searchTerms, 'MANGA', selectedType, locale)
  }

  if (selectedType === 'movie') {
    const movies = await searchTmdbCandidatesByType(searchTerms, 'movie')
    return lockCandidateType(movies.slice(0, 8), selectedType)
  }

  if (selectedType === 'series') {
    const series = await searchTmdbCandidatesByType(searchTerms, 'tv')
    return lockCandidateType(series.slice(0, 8), selectedType)
  }

  const books = await searchOpenLibraryCandidates(searchTerms)
  return lockCandidateType(books.slice(0, 8), selectedType)
}
