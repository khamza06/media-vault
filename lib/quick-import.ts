import 'server-only'

import {
  buildQuickImportSearchTerms,
  extractQuickImportFromUrl,
  type QuickImportSource,
} from './quick-import-parser'
import { normalizeGenresInput, type MediaItemInput } from './media'

type AniListSearchImport = {
  mediaType: 'ANIME' | 'MANGA' | null
  rawUrl: string
  searchTerm: string
  source:
    | 'generic'
    | 'mangalib'
    | 'mangabuff'
    | 'myanimelist'
    | 'readmanga'
    | 'remanga'
    | 'senkuro'
    | 'shikimori'
    | 'yummyanime'
}

type KinopoiskImport = {
  kind: 'film' | 'series' | null
  rawUrl: string
  searchTerm: string
  source: 'kinopoisk'
}

type ImdbImport = {
  rawUrl: string
  searchTerm: string
  source: 'imdb'
}

type ParsedQuickImportUrl = AniListSearchImport | KinopoiskImport | ImdbImport

type QuickImportForm = Pick<
  MediaItemInput,
  'genres' | 'imageUrl' | 'status' | 'title' | 'totalProgress' | 'type'
>

type SourcePageFallback = {
  genres: string
  imageUrl: string
  totalProgress: string
  title: string
  type: string
}

export type QuickImportPayload = {
  candidates: QuickImportCandidate[]
  form: QuickImportForm
  source: QuickImportSource
  warning: string | null
}

type QuickImportCandidate = QuickImportForm & {
  id: string
  provider: 'AniList' | 'Jikan' | 'Kitsu' | 'MangaDex' | 'TMDB'
  score: number
  subtitle: string | null
}

const FETCH_HEADERS = {
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 MediaVaultQuickImport',
} as const

function stripQuotes(value: string) {
  return value.replace(/^["']|["']$/g, '')
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ')
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

function cleanText(value: string) {
  return decodeHtmlEntities(stripTags(stripQuotes(value))).replace(/\s+/g, ' ').trim()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normalizeTitleFragment(value: string) {
  return decodeURIComponent(value)
    .replace(/\?.*$/, '')
    .replace(/#.*/, '')
    .replace(/\.(html|php)$/i, '')
    .replace(/^(\d+[-_ ]+)+/, '')
    .replace(/[-_+]+/g, ' ')
    .replace(/[_-]+$/, '')
    .replace(/^\d+\s+/, '')
    .replace(/\s+[a-zа-я]\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toTitleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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
      bestScore = Math.max(bestScore, 0.9)
      continue
    }

    const titleTokens = normalizedTitle.split(' ')
    const searchTokens = normalizedSearchTerm.split(' ')
    const sharedTokens = searchTokens.filter((token) => titleTokens.includes(token))
    const tokenCoverage = sharedTokens.length / Math.max(searchTokens.length, 1)

    if (tokenCoverage > 0) {
      bestScore = Math.max(bestScore, Math.min(0.84, 0.54 + tokenCoverage * 0.3))
    }

    if (
      compactTitle.startsWith(compactSearchTerm) ||
      compactSearchTerm.startsWith(compactTitle)
    ) {
      bestScore = Math.max(bestScore, 0.78)
    }
  }

  return bestScore
}

function dedupeCandidates(candidates: QuickImportCandidate[]) {
  const seen = new Set<string>()
  const unique: QuickImportCandidate[] = []

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

function getProviderPriority(provider: QuickImportCandidate['provider']) {
  switch (provider) {
    case 'AniList':
      return 4
    case 'TMDB':
      return 3
    case 'Kitsu':
      return 2
    case 'MangaDex':
      return 2
    case 'Jikan':
    default:
      return 1
  }
}

function buildCandidate(
  candidate: Omit<QuickImportCandidate, 'score'>,
  searchTerms: string[]
): QuickImportCandidate {
  const baseScore = scoreCandidateTitle(candidate.title, searchTerms)
  const metadataBonus = Math.min(
    0.08,
    (candidate.imageUrl ? 0.02 : 0) +
      (candidate.genres ? 0.03 : 0) +
      (candidate.totalProgress ? 0.03 : 0)
  )

  return {
    ...candidate,
    score: Math.min(1, baseScore + metadataBonus),
  }
}

function rankCandidates(candidates: QuickImportCandidate[]) {
  return dedupeCandidates(candidates).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }

    return getProviderPriority(right.provider) - getProviderPriority(left.provider)
  })
}

function mapMangaLikeType(
  mediaType: AniListSearchImport['mediaType'],
  country: string | null | undefined,
  format: string | null | undefined
) {
  if (
    mediaType === 'ANIME' ||
    ['MOVIE', 'MUSIC', 'ONA', 'OVA', 'SPECIAL', 'TV', 'TV_SHORT'].includes(format ?? '')
  ) {
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

async function searchAniListCandidates(
  importItem: AniListSearchImport,
  searchTerm: string,
  searchTerms: string[]
) {
  const response = await fetch('https://graphql.anilist.co', {
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
              id
              title {
                userPreferred
                english
                romaji
                native
              }
              coverImage {
                extraLarge
                large
              }
              countryOfOrigin
              episodes
              format
              genres
              volumes
            }
          }
        }
      `,
      variables: {
        search: searchTerm,
        type: importItem.mediaType,
      },
    }),
  })

  if (!response.ok) {
    return [] as QuickImportCandidate[]
  }

  const payload = (await response.json()) as {
    data?: {
      Page?: {
        media?: Array<{
          chapters?: number | null
          id: number
          countryOfOrigin?: string | null
          coverImage?: {
            extraLarge?: string | null
            large?: string | null
          } | null
          episodes?: number | null
          format?: string | null
          genres?: string[] | null
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
  }

  return (payload.data?.Page?.media ?? [])
    .map((media) => {
      const title =
        media.title?.userPreferred ??
        media.title?.english ??
        media.title?.romaji ??
        media.title?.native ??
        ''

      if (!title) {
        return null
      }

      const type = mapMangaLikeType(importItem.mediaType, media.countryOfOrigin, media.format)
      const totalProgress =
        importItem.mediaType === 'ANIME'
          ? String(media.episodes ?? '')
          : String(media.chapters ?? media.volumes ?? '')
      return buildCandidate(
        {
          id: `anilist:${media.id}`,
          genres: sanitizeImportedGenres((media.genres ?? []).join(', ')),
          imageUrl: media.coverImage?.extraLarge ?? media.coverImage?.large ?? '',
          provider: 'AniList',
          status: importItem.mediaType === 'ANIME' ? 'Planning' : type === 'Book' ? 'Planning' : 'Reading',
          subtitle: media.format ?? null,
          title,
          totalProgress: totalProgress === '0' ? '' : totalProgress,
          type,
        },
        searchTerms
      )
    })
    .filter((candidate): candidate is QuickImportCandidate => candidate !== null)
}

async function searchJikanCandidates(
  importItem: AniListSearchImport,
  searchTerm: string,
  searchTerms: string[]
) {
  const endpoints =
    importItem.mediaType === 'ANIME'
      ? (['anime'] as const)
      : importItem.mediaType === 'MANGA'
        ? (['manga'] as const)
        : (['anime', 'manga'] as const)

  const results = await Promise.all(
    endpoints.map(async (endpoint) => {
      const response = await fetch(
        `https://api.jikan.moe/v4/${endpoint}?q=${encodeURIComponent(searchTerm)}&limit=5&sfw=true`,
        {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        }
      )

      if (!response.ok) {
        return [] as QuickImportCandidate[]
      }

      const payload = (await response.json()) as {
        data?: Array<{
          chapters?: number | null
          episodes?: number | null
          mal_id: number
          title?: string
          title_english?: string | null
          title_japanese?: string | null
          images?: {
            jpg?: {
              large_image_url?: string | null
              image_url?: string | null
            }
            webp?: {
              large_image_url?: string | null
              image_url?: string | null
            }
          }
          genres?: Array<{ name: string }>
          type?: string | null
        }>
      }

      return (payload.data ?? [])
        .map((item) => {
          const title = item.title_english ?? item.title ?? item.title_japanese ?? ''

          if (!title) {
            return null
          }

          const type = endpoint === 'anime' ? 'Anime' : 'Manga'
          const totalProgress =
            endpoint === 'anime'
              ? String(item.episodes ?? '')
              : String(item.chapters ?? '')

          return buildCandidate(
            {
              id: `jikan:${endpoint}:${item.mal_id}`,
              genres: sanitizeImportedGenres(
                (item.genres ?? []).map((genre) => genre.name).join(', ')
              ),
              imageUrl:
                item.images?.webp?.large_image_url ??
                item.images?.jpg?.large_image_url ??
                item.images?.webp?.image_url ??
                item.images?.jpg?.image_url ??
                '',
              provider: 'Jikan',
              status: endpoint === 'anime' ? 'Planning' : 'Reading',
              subtitle: item.type ?? 'MyAnimeList',
              title,
              totalProgress: totalProgress === '0' ? '' : totalProgress,
              type,
            },
            searchTerms
          )
        })
        .filter((candidate): candidate is QuickImportCandidate => candidate !== null)
    })
  )

  return results.flat()
}

async function searchKitsuCandidates(
  importItem: AniListSearchImport,
  searchTerm: string,
  searchTerms: string[]
) {
  const endpoints =
    importItem.mediaType === 'ANIME'
      ? (['anime'] as const)
      : importItem.mediaType === 'MANGA'
        ? (['manga'] as const)
        : (['anime', 'manga'] as const)

  const results = await Promise.all(
    endpoints.map(async (endpoint) => {
      const response = await fetch(
        `https://kitsu.io/api/edge/${endpoint}?filter[text]=${encodeURIComponent(searchTerm)}&page[limit]=5`,
        {
          cache: 'no-store',
          headers: {
            Accept: 'application/vnd.api+json',
          },
        }
      )

      if (!response.ok) {
        return [] as QuickImportCandidate[]
      }

      const payload = (await response.json()) as {
        data?: Array<{
          id: string
          attributes?: {
            canonicalTitle?: string | null
            chapterCount?: number | null
            episodeCount?: number | null
            posterImage?: {
              large?: string | null
              original?: string | null
            } | null
            subtype?: string | null
            titles?: {
              en?: string | null
              en_jp?: string | null
              ja_jp?: string | null
            } | null
            volumeCount?: number | null
          }
        }>
      }

      return (payload.data ?? [])
        .map((item) => {
          const title =
            item.attributes?.canonicalTitle ??
            item.attributes?.titles?.en ??
            item.attributes?.titles?.en_jp ??
            item.attributes?.titles?.ja_jp ??
            ''

          if (!title) {
            return null
          }

          const subtype = item.attributes?.subtype?.toLowerCase() ?? ''
          const type =
            endpoint === 'anime'
              ? 'Anime'
              : subtype === 'manhwa'
                ? 'Manhwa'
                : subtype === 'manhua'
                  ? 'Manhua'
                  : subtype === 'novel'
                    ? 'Book'
                    : 'Manga'
          const totalProgress =
            endpoint === 'anime'
              ? String(item.attributes?.episodeCount ?? '')
              : String(item.attributes?.chapterCount ?? item.attributes?.volumeCount ?? '')

          return buildCandidate(
            {
              id: `kitsu:${endpoint}:${item.id}`,
              genres: '',
              imageUrl:
                item.attributes?.posterImage?.original ??
                item.attributes?.posterImage?.large ??
                '',
              provider: 'Kitsu',
              status: endpoint === 'anime' ? 'Planning' : type === 'Book' ? 'Planning' : 'Reading',
              subtitle: item.attributes?.subtype ?? 'Kitsu',
              title,
              totalProgress: totalProgress === '0' ? '' : totalProgress,
              type,
            },
            searchTerms
          )
        })
        .filter((candidate): candidate is QuickImportCandidate => candidate !== null)
    })
  )

  return results.flat()
}

function getMangaDexTitle(attributes: {
  title?: Record<string, string>
  altTitles?: Array<Record<string, string>>
}) {
  const primaryTitle = Object.values(attributes.title ?? {}).find(Boolean)

  if (primaryTitle) {
    return primaryTitle
  }

  for (const altTitle of attributes.altTitles ?? []) {
    const value = Object.values(altTitle).find(Boolean)

    if (value) {
      return value
    }
  }

  return ''
}

async function searchMangaDexCandidates(searchTerm: string, searchTerms: string[]) {
  const response = await fetch(
    `https://api.mangadex.org/manga?title=${encodeURIComponent(searchTerm)}&limit=5&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`,
    {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    }
  )

  if (!response.ok) {
    return [] as QuickImportCandidate[]
  }

  const payload = (await response.json()) as {
    data?: Array<{
      id: string
      attributes?: {
        altTitles?: Array<Record<string, string>>
        lastChapter?: string | null
        originalLanguage?: string | null
        tags?: Array<{
          attributes?: {
            name?: Record<string, string>
          }
        }>
        title?: Record<string, string>
      }
      relationships?: Array<{
        type?: string
        attributes?: {
          fileName?: string | null
        }
      }>
    }>
  }

  return (payload.data ?? [])
    .map((item) => {
      const title = getMangaDexTitle({
        altTitles: item.attributes?.altTitles,
        title: item.attributes?.title,
      })

      if (!title) {
        return null
      }

      const coverFileName = item.relationships?.find(
        (relationship) => relationship.type === 'cover_art'
      )?.attributes?.fileName
      const imageUrl = coverFileName
        ? `https://uploads.mangadex.org/covers/${item.id}/${coverFileName}.512.jpg`
        : ''
      const language = item.attributes?.originalLanguage?.toLowerCase() ?? ''
      const type =
        language === 'ko'
          ? 'Manhwa'
          : language === 'zh' || language === 'zh-hk'
            ? 'Manhua'
            : 'Manga'
      const parsedLastChapter = Number(item.attributes?.lastChapter ?? '')
      const totalProgress =
        Number.isFinite(parsedLastChapter) && parsedLastChapter > 0
          ? String(Math.floor(parsedLastChapter))
          : ''

      return buildCandidate(
        {
          id: `mangadex:${item.id}`,
          genres: sanitizeImportedGenres(
            (item.attributes?.tags ?? [])
              .map((tag) => tag.attributes?.name?.en ?? '')
              .filter(Boolean)
              .join(', ')
          ),
          imageUrl,
          provider: 'MangaDex',
          status: 'Reading',
          subtitle: 'MangaDex',
          title,
          totalProgress,
          type,
        },
        searchTerms
      )
    })
    .filter((candidate): candidate is QuickImportCandidate => candidate !== null)
}

async function getTmdbGenreMap(apiKey: string, mediaType: 'movie' | 'tv') {
  const response = await fetch(
    `https://api.themoviedb.org/3/genre/${mediaType}/list?api_key=${apiKey}&language=en-US`,
    {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    }
  )

  if (!response.ok) {
    return new Map<number, string>()
  }

  const payload = (await response.json()) as {
    genres?: Array<{ id: number; name: string }>
  }

  return new Map((payload.genres ?? []).map((genre) => [genre.id, genre.name]))
}

async function getTmdbDetails(
  apiKey: string,
  id: number,
  mediaType: 'movie' | 'tv'
) {
  const response = await fetch(
    `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${apiKey}&language=en-US`,
    {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    }
  )

  if (!response.ok) {
    return null
  }

  return (await response.json()) as {
    genres?: Array<{ id: number; name: string }>
    number_of_episodes?: number | null
  }
}

async function searchTmdbCandidates(searchTerm: string, searchTerms: string[]) {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? process.env.TMDB_API_KEY

  if (!apiKey) {
    return [] as QuickImportCandidate[]
  }

  const response = await fetch(
    `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&language=en-US&include_adult=false&page=1&query=${encodeURIComponent(searchTerm)}`,
    {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    }
  )

  if (!response.ok) {
    return [] as QuickImportCandidate[]
  }

  const payload = (await response.json()) as {
    results?: Array<{
      first_air_date?: string | null
      genre_ids?: number[]
      id: number
      media_type?: 'movie' | 'tv' | 'person'
      name?: string | null
      poster_path?: string | null
      release_date?: string | null
      title?: string | null
    }>
  }

  const results = (payload.results ?? []).filter(
    (result) => result.media_type === 'movie' || result.media_type === 'tv'
  ) as Array<{
    first_air_date?: string | null
    genre_ids?: number[]
    id: number
    media_type: 'movie' | 'tv'
    name?: string | null
    poster_path?: string | null
    release_date?: string | null
    title?: string | null
  }>

  if (results.length === 0) {
    return [] as QuickImportCandidate[]
  }

  const [movieGenres, tvGenres] = await Promise.all([
    getTmdbGenreMap(apiKey, 'movie'),
    getTmdbGenreMap(apiKey, 'tv'),
  ])

  return (
    await Promise.all(
      results.slice(0, 5).map(async (item) => {
        const title = item.title ?? item.name ?? ''

        if (!title) {
          return null
        }

        const genreMap = item.media_type === 'movie' ? movieGenres : tvGenres
        const details = item.media_type === 'tv' ? await getTmdbDetails(apiKey, item.id, 'tv') : null
        const detailGenres =
          details?.genres?.map((genre) => genre.name).filter(Boolean).join(', ') ?? ''
        const searchGenres = sanitizeImportedGenres(
          detailGenres ||
            (item.genre_ids ?? [])
              .map((id) => genreMap.get(id) ?? '')
              .filter(Boolean)
              .join(', ')
        )
        const releaseYear = (item.release_date ?? item.first_air_date ?? '').slice(0, 4)

        return buildCandidate(
          {
            id: `tmdb:${item.media_type}:${item.id}`,
            genres: searchGenres,
            imageUrl: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : '',
            provider: 'TMDB',
            status: 'Planning',
            subtitle: releaseYear || 'TMDB',
            title,
            totalProgress:
              item.media_type === 'tv' && details?.number_of_episodes
                ? String(details.number_of_episodes)
                : '',
            type: item.media_type === 'tv' ? 'TV Series' : 'Movie',
          },
          searchTerms
        )
      })
    )
  ).filter((candidate): candidate is QuickImportCandidate => candidate !== null)
}

async function findSearchCandidates(
  importItem: AniListSearchImport,
  fallback: SourcePageFallback | null
) {
  const searchTerms = Array.from(
    new Set(
      [
        ...buildQuickImportSearchTerms(importItem.searchTerm),
        toTitleCase(importItem.searchTerm),
        fallback?.title ?? '',
      ]
        .map((term) => term.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    )
  )

  const aggregated: QuickImportCandidate[] = []

  for (const searchTerm of searchTerms) {
    const providerResults = await Promise.all([
      searchAniListCandidates(importItem, searchTerm, searchTerms),
      searchJikanCandidates(importItem, searchTerm, searchTerms),
      searchKitsuCandidates(importItem, searchTerm, searchTerms),
      importItem.mediaType !== 'ANIME'
        ? searchMangaDexCandidates(searchTerm, searchTerms)
        : Promise.resolve([] as QuickImportCandidate[]),
      importItem.mediaType !== 'MANGA'
        ? searchTmdbCandidates(searchTerm, searchTerms)
        : Promise.resolve([] as QuickImportCandidate[]),
    ])

    aggregated.push(...providerResults.flat())
  }

  return rankCandidates(aggregated).slice(0, 6)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getSegmentAfter(segments: string[], marker: string) {
  const index = segments.findIndex((segment) => segment.toLowerCase() === marker.toLowerCase())
  return index >= 0 ? segments[index + 1] ?? null : null
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getLastUsefulSegment(segments: string[]) {
  const ignored = new Set([
    'anime',
    'animes',
    'catalog',
    'item',
    'manga',
    'mangas',
    'manhua',
    'manhwa',
    'read',
    'reader',
    'ru',
    'titles',
    'title',
    'v',
  ])

  return (
    [...segments]
      .reverse()
      .find((segment) => {
        const normalized = segment.toLowerCase()
        return !ignored.has(normalized) && !/^\d+$/.test(normalized)
      }) ?? null
  )
}

function getMetaContent(html: string, key: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${key}["'][^>]+content=["']([^"]+)["'][^>]*>`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"]+)["'][^>]+property=["']${key}["'][^>]*>`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+name=["']${key}["'][^>]+content=["']([^"]+)["'][^>]*>`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"]+)["'][^>]+name=["']${key}["'][^>]*>`,
      'i'
    ),
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(html)
    if (match?.[1]) {
      return cleanText(match[1])
    }
  }

  return null
}

function getTagText(html: string, tagName: string) {
  const match = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i').exec(html)
  return match?.[1] ? cleanText(match[1]) : null
}

function getMetaKeywords(html: string) {
  const raw = getMetaContent(html, 'keywords')

  if (!raw) {
    return ''
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(', ')
}

function sanitizeImportedGenres(value: string) {
  return normalizeGenresInput(value).join(', ')
}

function extractGenericJsonLdTitle(html: string) {
  const matches = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )

  if (!matches) {
    return null
  }

  for (const match of matches) {
    const json = match
      .replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/i, '')
      .replace(/<\/script>/i, '')
      .trim()

    try {
      const parsed = JSON.parse(json) as
        | { '@type'?: string; name?: string }
        | Array<{ '@type'?: string; name?: string }>

      const items = Array.isArray(parsed) ? parsed : [parsed]
      const named = items.find((item) => typeof item.name === 'string' && item.name.trim())

      if (named?.name) {
        return cleanText(named.name)
      }
    } catch {
      continue
    }
  }

  return null
}

function extractImdbJsonLd(html: string) {
  const matches = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi
  )

  if (!matches) {
    return null
  }

  for (const match of matches) {
    const json = match
      .replace(/<script type="application\/ld\+json">/i, '')
      .replace(/<\/script>/i, '')
      .trim()

    try {
      const parsed = JSON.parse(json) as
        | {
            '@type'?: string
            genre?: string[] | string
            image?: string | string[]
            name?: string
          }
        | Array<{
            '@type'?: string
            genre?: string[] | string
            image?: string | string[]
            name?: string
          }>

      const items = Array.isArray(parsed) ? parsed : [parsed]
      const mediaNode = items.find((item) =>
        ['Movie', 'TVSeries', 'TVMiniSeries', 'TVEpisode'].includes(item['@type'] ?? '')
      )

      if (mediaNode) {
        return mediaNode
      }
    } catch {
      continue
    }
  }

  return null
}

function detectMangaTypeFromText(value: string) {
  const normalized = value.toLowerCase()

  if (normalized.includes('манхва') || normalized.includes('manhwa')) {
    return 'Manhwa'
  }

  if (normalized.includes('маньхуа') || normalized.includes('manhua')) {
    return 'Manhua'
  }

  if (normalized.includes('роман') || normalized.includes('novel')) {
    return 'Book'
  }

  return 'Manga'
}

function cleanSourceTitle(source: QuickImportSource, value: string) {
  const decoded = cleanText(value)

  if (!decoded) {
    return ''
  }

  if (source === 'kinopoisk') {
    return decoded
      .replace(/\s*[—-]\s*Кинопоиск.*$/i, '')
      .replace(/\s*[—-]\s*Kinopoisk.*$/i, '')
      .replace(/\s+\(\d{4}\)\s*$/, '')
      .trim()
  }

  if (source === 'imdb') {
    return decoded.replace(/\s*-\s*IMDb.*$/i, '').trim()
  }

  if (source === 'remanga') {
    return decoded
      .replace(/^Читать\s+/i, '')
      .replace(/\s+[—-]\s+(Манга|Манхва|Маньхуа|Роман).*$/i, '')
      .replace(/\s+[—-]\s+ReManga.*$/i, '')
      .trim()
  }

  if (source === 'mangabuff') {
    return decoded
      .split('/')[0]
      .replace(/\s+[—-]\s+(Манга|Манхва|Маньхуа|Манга читать онлайн|Манхва читать онлайн).*$/i, '')
      .replace(/\s+[—-]\s+MANGABUFF.*$/i, '')
      .trim()
  }

  if (source === 'senkuro') {
    return decoded
      .replace(/\s+[—-]\s+Senkuro.*$/i, '')
      .replace(/\s+[—-]\s+Read.*$/i, '')
      .trim()
  }

  if (source === 'readmanga') {
    return decoded
      .replace(/^Читать\s+/i, '')
      .replace(/\s+[—-]\s+ReadManga.*$/i, '')
      .replace(/\s+[—-]\s+Manga.*$/i, '')
      .trim()
  }

  if (source === 'mangalib') {
    return decoded
      .replace(/^Читать\s+/i, '')
      .replace(/\s+[—-]\s+MangaLib.*$/i, '')
      .trim()
  }

  if (source === 'myanimelist') {
    return decoded
      .replace(/\s+[—-]\s+MyAnimeList\.net.*$/i, '')
      .replace(/\s+\((TV|ONA|OVA|Movie|Manga)\)\s*$/, '')
      .trim()
  }

  if (source === 'shikimori') {
    return decoded
      .replace(/\s+[—-]\s+Shikimori.*$/i, '')
      .replace(/^\d+\s+/, '')
      .trim()
  }

  if (source === 'yummyanime') {
    return decoded
      .replace(/\s+[—-]\s+YummyAnime.*$/i, '')
      .replace(/\s+[—-]\s+Watch Anime.*$/i, '')
      .trim()
  }

  return decoded
}

function isGenericSourceTitle(source: QuickImportSource, value: string) {
  const normalized = value.toLowerCase()

  if (!normalized) {
    return true
  }

  if (
    source === 'mangalib' &&
    [
      'мангу онлайн',
      'манга онлайн',
      'манхва онлайн',
      'маньхуа онлайн',
      'mangalib',
      'читать мангу',
    ].some((pattern) => normalized.includes(pattern))
  ) {
    return true
  }

  if (
    source === 'remanga' &&
    ['remanga', 'читать мангу', 'читать манхву', 'читать маньхуа'].some((pattern) =>
      normalized.includes(pattern)
    )
  ) {
    return true
  }

  if (
    source === 'mangabuff' &&
    ['mangabuff', 'читать мангу онлайн', 'читать манхву онлайн'].some((pattern) =>
      normalized.includes(pattern)
    )
  ) {
    return true
  }

  if (
    source === 'senkuro' &&
    ['senkuro', 'read manga online', 'read manhwa online'].some((pattern) =>
      normalized.includes(pattern)
    )
  ) {
    return true
  }

  if (
    source === 'readmanga' &&
    ['readmanga', 'читать мангу', 'читать онлайн'].some((pattern) =>
      normalized.includes(pattern)
    )
  ) {
    return true
  }

  if (
    source === 'myanimelist' &&
    ['myanimelist', 'anime and manga database'].some((pattern) => normalized.includes(pattern))
  ) {
    return true
  }

  if (
    source === 'shikimori' &&
    ['shikimori', 'аниме и манга'].some((pattern) => normalized.includes(pattern))
  ) {
    return true
  }

  if (
    source === 'yummyanime' &&
    ['yummyanime', 'watch anime online'].some((pattern) => normalized.includes(pattern))
  ) {
    return true
  }

  return false
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: FETCH_HEADERS,
  })

  return {
    html: await response.text(),
    ok: response.ok,
    status: response.status,
  }
}

function fallbackFromAniListImport(importItem: AniListSearchImport, fallback?: SourcePageFallback | null) {
  const guessedTitle = fallback?.title || toTitleCase(importItem.searchTerm)
  const guessedType =
    fallback?.type ||
    (importItem.mediaType === 'ANIME'
      ? 'Anime'
      : importItem.mediaType === 'MANGA'
        ? 'Manga'
        : 'Manga')
  const guessedStatus =
    guessedType === 'Anime' || guessedType === 'Movie' || guessedType === 'TV Series' || guessedType === 'Book'
      ? 'Planning'
      : 'Reading'

  return {
    candidates: [],
    form: {
      genres: sanitizeImportedGenres(fallback?.genres ?? ''),
      imageUrl: fallback?.imageUrl ?? '',
      status: guessedStatus,
      title: guessedTitle,
      totalProgress: fallback?.totalProgress ?? '',
      type: guessedType,
    },
    source: importItem.source,
    warning:
      'The source could not be parsed cleanly, so the form was filled from the link only.',
  } satisfies QuickImportPayload
}

function fallbackFromKinopoiskImport(importItem: KinopoiskImport) {
  const filmId = /\/(film|series)\/(\d+)/i.exec(new URL(importItem.rawUrl).pathname)?.[2] ?? null

  return {
    candidates: [],
    form: {
      genres: '',
      imageUrl: '',
      status: 'Planning',
      title: filmId
        ? `Kinopoisk ${importItem.kind === 'series' ? 'series' : 'movie'} #${filmId}`
        : '',
      totalProgress: '',
      type: importItem.kind === 'series' ? 'TV Series' : 'Movie',
    },
    source: importItem.source,
    warning:
      'Kinopoisk is blocking automatic extraction right now, so a draft item was prepared instead.',
  } satisfies QuickImportPayload
}

function fallbackFromImdbImport(importItem: ImdbImport) {
  const imdbId = /\/title\/(tt\d+)/i.exec(new URL(importItem.rawUrl).pathname)?.[1] ?? null

  return {
    candidates: [],
    form: {
      genres: '',
      imageUrl: '',
      status: 'Planning',
      title: imdbId ? `IMDb ${imdbId}` : '',
      totalProgress: '',
      type: 'Movie',
    },
    source: importItem.source,
    warning: 'This IMDb page could not be parsed cleanly, so a draft item was prepared instead.',
  } satisfies QuickImportPayload
}

async function fetchSourcePageFallback(
  rawUrl: string,
  source: AniListSearchImport['source']
): Promise<SourcePageFallback | null> {
  const { html, ok } = await fetchHtml(rawUrl)

  if (!ok) {
    return null
  }

  const title = cleanSourceTitle(
    source,
    getMetaContent(html, 'og:title') ??
      getMetaContent(html, 'twitter:title') ??
      getTagText(html, 'title') ??
      getTagText(html, 'h1') ??
      extractGenericJsonLdTitle(html) ??
      ''
  )

  if (!title || isGenericSourceTitle(source, title)) {
    return null
  }

  const genres =
    getMetaKeywords(html) ||
    html
      .match(/(?:жанр|genres?)[:\s]+([^<\n]+)/i)?.[1]
      ?.split(/[;,]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 6)
      .join(', ') ||
    ''

  const totalProgress =
    html.match(/(?:chapters?|episodes?|last chapter|глав|главы|глава|эпизод(?:ы|ов)?|серии)[:\s#]*(\d{1,5})/i)?.[1] ??
    html.match(/["'](?:chapters|episodes|lastChapter)["']\s*:\s*["']?(\d{1,5})["']?/i)?.[1] ??
    ''

  return {
    genres: sanitizeImportedGenres(genres),
    imageUrl: getMetaContent(html, 'og:image') ?? getMetaContent(html, 'twitter:image') ?? '',
    totalProgress,
    title,
    type: source === 'yummyanime' ? 'Anime' : detectMangaTypeFromText(`${title} ${html}`),
  }
}

export function parseQuickImportUrl(value: string): ParsedQuickImportUrl {
  const parsed = extractQuickImportFromUrl(value)

  if (parsed.source === 'kinopoisk') {
    return {
      kind: parsed.kind,
      rawUrl: parsed.rawUrl,
      searchTerm: parsed.searchTerm,
      source: 'kinopoisk',
    }
  }

  if (parsed.source === 'imdb') {
    return {
      rawUrl: parsed.rawUrl,
      searchTerm: parsed.searchTerm,
      source: 'imdb',
    }
  }

  return {
    mediaType: parsed.typeHint,
    rawUrl: parsed.rawUrl,
    searchTerm: parsed.searchTerm,
    source: parsed.source,
  }
}

async function fetchAniListMetadata(
  importItem: AniListSearchImport,
  fallback: SourcePageFallback | null
) {
  const candidates = await findSearchCandidates(importItem, fallback)
  const bestCandidate = candidates[0]

  if (!bestCandidate) {
    return fallbackFromAniListImport(importItem, fallback)
  }

  const payload = {
    candidates,
    form: {
      genres: bestCandidate.genres || sanitizeImportedGenres(fallback?.genres ?? ''),
      imageUrl: bestCandidate.imageUrl || fallback?.imageUrl || '',
      status: bestCandidate.status,
      title: bestCandidate.title,
      totalProgress: bestCandidate.totalProgress || fallback?.totalProgress || '',
      type: bestCandidate.type,
    },
    source: importItem.source,
    warning: null as string | null,
  } satisfies QuickImportPayload

  if (bestCandidate.score >= 0.92) {
    return payload
  }

  if (bestCandidate.score >= 0.72) {
    return {
      ...payload,
      warning: 'A likely match was found. Double-check it before saving.',
    } satisfies QuickImportPayload
  }

  return {
    ...fallbackFromAniListImport(importItem, fallback),
    candidates,
  } satisfies QuickImportPayload
}

async function fetchKinopoiskMetadata(importItem: KinopoiskImport) {
  const { html, ok } = await fetchHtml(importItem.rawUrl)

  if (!ok) {
    const tmdbCandidates =
      importItem.searchTerm && !/^\d+$/.test(importItem.searchTerm)
        ? await searchTmdbCandidates(importItem.searchTerm, [importItem.searchTerm])
        : []

    if (tmdbCandidates.length > 0) {
      const bestCandidate = tmdbCandidates[0]

      return {
        candidates: tmdbCandidates,
        form: {
          genres: bestCandidate.genres,
          imageUrl: bestCandidate.imageUrl,
          status: 'Planning',
          title: bestCandidate.title,
          totalProgress: bestCandidate.totalProgress,
          type: bestCandidate.type,
        },
        source: importItem.source,
        warning: 'Kinopoisk was blocked, so TMDB search was used as a fallback.',
      } satisfies QuickImportPayload
    }

    return fallbackFromKinopoiskImport(importItem)
  }

  const isBlocked =
    html.includes('Вы не робот') ||
    html.includes('Подтвердите, что запросы отправляли вы') ||
    html.includes('sso.kinopoisk.ru/install')

  const title = cleanSourceTitle(
    'kinopoisk',
    getMetaContent(html, 'og:title') ??
      getMetaContent(html, 'twitter:title') ??
      getTagText(html, 'title') ??
      getTagText(html, 'h1') ??
      extractGenericJsonLdTitle(html) ??
      html.match(/["']name["']\s*:\s*["']([^"']+)["']/i)?.[1] ??
      ''
  )

  if (!title || isBlocked) {
    const tmdbCandidates =
      importItem.searchTerm && !/^\d+$/.test(importItem.searchTerm)
        ? await searchTmdbCandidates(importItem.searchTerm, [importItem.searchTerm])
        : []

    if (tmdbCandidates.length > 0) {
      const bestCandidate = tmdbCandidates[0]

      return {
        candidates: tmdbCandidates,
        form: {
          genres: bestCandidate.genres,
          imageUrl: bestCandidate.imageUrl,
          status: 'Planning',
          title: bestCandidate.title,
          totalProgress: bestCandidate.totalProgress,
          type: bestCandidate.type,
        },
        source: importItem.source,
        warning: 'Kinopoisk was blocked, so TMDB search was used as a fallback.',
      } satisfies QuickImportPayload
    }

    return fallbackFromKinopoiskImport(importItem)
  }

  return {
    candidates: [],
    form: {
      genres: getMetaKeywords(html),
      imageUrl: getMetaContent(html, 'og:image') ?? getMetaContent(html, 'twitter:image') ?? '',
      status: 'Planning',
      title,
      totalProgress: '',
      type: importItem.kind === 'series' ? 'TV Series' : 'Movie',
    },
    source: importItem.source,
    warning: null,
  } satisfies QuickImportPayload
}

async function fetchImdbMetadata(importItem: ImdbImport) {
  const { html, ok } = await fetchHtml(importItem.rawUrl)

  if (!ok) {
    return fallbackFromImdbImport(importItem)
  }

  const jsonLd = extractImdbJsonLd(html)
  const title = cleanSourceTitle(
    'imdb',
    String(jsonLd?.name ?? '') ||
      getMetaContent(html, 'og:title') ||
      getMetaContent(html, 'twitter:title') ||
      getTagText(html, 'title') ||
      ''
  )

  if (!title) {
    return fallbackFromImdbImport(importItem)
  }

  const imageValue = jsonLd?.image
  const genreValue = jsonLd?.genre
  const imageUrl = Array.isArray(imageValue)
    ? imageValue[0] ?? ''
    : typeof imageValue === 'string'
      ? imageValue
      : getMetaContent(html, 'og:image') ?? getMetaContent(html, 'twitter:image') ?? ''

  return {
    candidates: [],
    form: {
      genres: Array.isArray(genreValue)
        ? genreValue.join(', ')
        : typeof genreValue === 'string'
          ? genreValue
          : '',
      imageUrl,
      status: 'Planning',
      title,
      totalProgress: '',
      type:
        jsonLd?.['@type'] === 'TVSeries' || jsonLd?.['@type'] === 'TVMiniSeries'
          ? 'TV Series'
          : 'Movie',
    },
    source: importItem.source,
    warning: null,
  } satisfies QuickImportPayload
}

export async function resolveQuickImport(value: string): Promise<QuickImportPayload> {
  const parsed = parseQuickImportUrl(value)

  try {
    if ('mediaType' in parsed) {
      const sourceFallback = await fetchSourcePageFallback(parsed.rawUrl, parsed.source)
      return await fetchAniListMetadata(parsed, sourceFallback)
    }

    if (parsed.source === 'kinopoisk') {
      return await fetchKinopoiskMetadata(parsed)
    }

    return await fetchImdbMetadata(parsed)
  } catch {
    if ('mediaType' in parsed) {
      return fallbackFromAniListImport(parsed, null)
    }

    if (parsed.source === 'kinopoisk') {
      return fallbackFromKinopoiskImport(parsed)
    }

    return fallbackFromImdbImport(parsed)
  }
}
