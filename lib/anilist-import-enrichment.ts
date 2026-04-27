import 'server-only'

import { normalizeGenreList } from './genres'

type AniListMediaType = 'ANIME' | 'MANGA'

type AniListMedia = {
  averageScore?: number | null
  chapters?: number | null
  coverImage?: {
    extraLarge?: string | null
    large?: string | null
  } | null
  description?: string | null
  episodes?: number | null
  genres?: string[] | null
  id: number
  idMal?: number | null
  title?: {
    english?: string | null
    native?: string | null
    romaji?: string | null
  } | null
  type?: AniListMediaType | null
}

type AniListResponse = {
  data?: {
    Page?: {
      media?: AniListMedia[] | null
    } | null
  } | null
}

type AniListSingleResponse = {
  data?: {
    Media?: AniListMedia | null
  } | null
}

type ScoredMedia = {
  index: number
  media: AniListMedia
  score: number
}

export type AnimeMangaImportMetadataSource = 'anilist-mal-id' | 'jikan-mal-id' | 'title'

export type AnimeMangaImportMetadata = {
  externalRatingLabel: string | null
  externalRatingValue: number | null
  genres: string[]
  imageUrl: string | null
  source: AnimeMangaImportMetadataSource
  totalProgress: number | null
}

export type AnimeMangaImportLookupOptions = {
  malId?: string | null
}

const ANILIST_IMPORT_QUERY = `
  query ImportEnrichment($search: String!, $type: MediaType!) {
    Page(page: 1, perPage: 8) {
      media(search: $search, type: $type, isAdult: false, sort: SEARCH_MATCH) {
        id
        idMal
        type
        episodes
        chapters
        averageScore
        genres
        description(asHtml: false)
        coverImage {
          large
          extraLarge
        }
        title {
          romaji
          english
          native
        }
      }
    }
  }
`

const ANILIST_IMPORT_BY_MAL_ID_QUERY = `
  query ImportEnrichmentByMalId($idMal: Int!, $type: MediaType!) {
    Media(idMal: $idMal, type: $type) {
      id
      idMal
      type
      episodes
      chapters
      averageScore
      genres
      description(asHtml: false)
      coverImage {
        large
        extraLarge
      }
      title {
        romaji
        english
        native
      }
    }
  }
`

function normalizeComparableTitle(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactTitle(value: string) {
  return normalizeComparableTitle(value).replace(/\s+/g, '')
}

function cleanTitleWords(value: string) {
  return value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b\d+(?:st|nd|rd|th)\s+season\b/gi, ' ')
    .replace(/\bseason\s*\d+\b/gi, ' ')
    .replace(/\bs\d+\b/gi, ' ')
    .replace(/\bpart\s*\d+\b/gi, ' ')
    .replace(/\bcour\s*\d+\b/gi, ' ')
    .replace(/\b(?:ova|ona|special|tv|movie)\b/gi, ' ')
    .replace(/[_:;,.!?'"`~|()[\]{}<>/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanSeasonSuffixes(value: string) {
  return value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b\d+(?:st|nd|rd|th)\s+season\b/gi, ' ')
    .replace(/\bseason\s*\d+\b/gi, ' ')
    .replace(/\bs\d+\b/gi, ' ')
    .replace(/\bpart\s*\d+\b/gi, ' ')
    .replace(/\bcour\s*\d+\b/gi, ' ')
    .replace(/[_;,.!?'"`~|()[\]{}<>/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSearchVariants(title: string) {
  const variants = new Set<string>()
  const trimmed = title.trim()

  if (!trimmed) {
    return []
  }

  variants.add(trimmed)

  const seasonless = cleanSeasonSuffixes(trimmed)

  if (seasonless) {
    variants.add(seasonless)
  }

  const movieWordFallback = cleanTitleWords(trimmed)

  if (movieWordFallback) {
    variants.add(movieWordFallback)
  }

  const beforeColon = trimmed.split(/\s*:\s*/).at(0)?.trim()

  if (beforeColon) {
    variants.add(beforeColon)
  }

  if (beforeColon) {
    const cleanBeforeColon = cleanTitleWords(beforeColon)

    if (cleanBeforeColon) {
      variants.add(cleanBeforeColon)
    }
  }

  const normalized = normalizeComparableTitle(trimmed)

  if (normalized) {
    variants.add(normalized)
  }

  return Array.from(variants)
    .map((variant) => variant.trim())
    .filter((variant) => variant.length >= 2)
}

function getMediaTitles(media: AniListMedia) {
  return [
    media.title?.english,
    media.title?.romaji,
    media.title?.native,
  ].filter((title): title is string => Boolean(title?.trim()))
}

function getCoverImage(media: AniListMedia) {
  return media.coverImage?.extraLarge ?? media.coverImage?.large ?? null
}

function parseMalId(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null
  }

  return parsed
}

function scoreTitle(candidateTitle: string, variants: string[]) {
  const candidate = normalizeComparableTitle(candidateTitle)
  const compactCandidate = compactTitle(candidateTitle)

  if (!candidate) {
    return 0
  }

  let bestScore = 0

  for (const variant of variants) {
    const normalizedVariant = normalizeComparableTitle(variant)
    const compactVariant = compactTitle(variant)

    if (!normalizedVariant) {
      continue
    }

    if (candidate === normalizedVariant) {
      return 1
    }

    if (compactCandidate === compactVariant) {
      bestScore = Math.max(bestScore, 0.98)
      continue
    }

    if (
      normalizedVariant.length >= 5 &&
      (candidate.includes(normalizedVariant) || normalizedVariant.includes(candidate))
    ) {
      bestScore = Math.max(bestScore, 0.86)
      continue
    }

    if (
      compactVariant.length >= 5 &&
      (compactCandidate.includes(compactVariant) || compactVariant.includes(compactCandidate))
    ) {
      bestScore = Math.max(bestScore, 0.82)
      continue
    }

    const candidateTokens = new Set(candidate.split(' ').filter((token) => token.length > 1))
    const variantTokens = normalizedVariant.split(' ').filter((token) => token.length > 1)
    const sharedTokens = variantTokens.filter((token) => candidateTokens.has(token))
    const coverage = sharedTokens.length / Math.max(variantTokens.length, 1)

    if (coverage > 0) {
      bestScore = Math.max(bestScore, Math.min(0.78, 0.42 + coverage * 0.36))
    }
  }

  return bestScore
}

function scoreMedia(media: AniListMedia, variants: string[]) {
  const titleScore = getMediaTitles(media).reduce(
    (best, title) => Math.max(best, scoreTitle(title, variants)),
    0
  )
  const metadataBonus = Math.min(
    0.04,
    (getCoverImage(media) ? 0.02 : 0) +
      (media.averageScore ? 0.01 : 0) +
      ((media.genres?.length ?? 0) > 0 ? 0.01 : 0)
  )

  return Math.min(1, titleScore + metadataBonus)
}

function chooseBestMatch(media: AniListMedia[], variants: string[]) {
  if (media.length === 0) {
    return null
  }

  const scored = media
    .map<ScoredMedia>((candidate, index) => ({
      index,
      media: candidate,
      score: scoreMedia(candidate, variants),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      const rightHasCover = getCoverImage(right.media) ? 1 : 0
      const leftHasCover = getCoverImage(left.media) ? 1 : 0

      if (rightHasCover !== leftHasCover) {
        return rightHasCover - leftHasCover
      }

      return left.index - right.index
    })

  const confident = scored.find((candidate) => candidate.score >= 0.72)

  if (confident) {
    return confident.media
  }

  return scored.find((candidate) => getCoverImage(candidate.media))?.media ?? null
}

async function searchAniListMedia(search: string, type: AniListMediaType) {
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: ANILIST_IMPORT_QUERY,
        variables: { search, type },
      }),
    })

    if (!response.ok) {
      return []
    }

    const payload = (await response.json()) as AniListResponse
    return payload.data?.Page?.media ?? []
  } catch {
    return []
  }
}

async function searchAniListMediaByMalId(idMal: number, type: AniListMediaType) {
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: ANILIST_IMPORT_BY_MAL_ID_QUERY,
        variables: { idMal, type },
      }),
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as AniListSingleResponse
    return payload.data?.Media ?? null
  } catch {
    return null
  }
}

function toExternalRatingValue(averageScore: number | null | undefined) {
  if (typeof averageScore !== 'number' || averageScore <= 0) {
    return null
  }

  return Math.round((averageScore / 10) * 10) / 10
}

function toTotalProgress(media: AniListMedia, type: 'Anime' | 'Manga') {
  const value = type === 'Anime' ? media.episodes : media.chapters

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return null
  }

  return value
}

function toImportMetadata(
  media: AniListMedia,
  type: 'Anime' | 'Manga',
  source: AnimeMangaImportMetadataSource
): AnimeMangaImportMetadata {
  const externalRatingValue = toExternalRatingValue(media.averageScore)

  return {
    externalRatingLabel: externalRatingValue === null ? null : 'AniList',
    externalRatingValue,
    genres: normalizeGenreList(media.genres ?? []),
    imageUrl: getCoverImage(media),
    source,
    totalProgress: toTotalProgress(media, type),
  }
}

type JikanImageSet = {
  image_url?: string | null
  large_image_url?: string | null
}

type JikanMediaResponse = {
  data?: {
    chapters?: number | null
    demographics?: Array<{ name?: string | null }> | null
    episodes?: number | null
    genres?: Array<{ name?: string | null }> | null
    images?: {
      jpg?: JikanImageSet | null
      webp?: JikanImageSet | null
    } | null
    score?: number | null
    themes?: Array<{ name?: string | null }> | null
  } | null
}

function getJikanImageUrl(data: NonNullable<JikanMediaResponse['data']>) {
  return (
    data.images?.webp?.large_image_url ??
    data.images?.jpg?.large_image_url ??
    data.images?.webp?.image_url ??
    data.images?.jpg?.image_url ??
    null
  )
}

function normalizeJikanScore(score: number | null | undefined) {
  if (typeof score !== 'number' || score <= 0) {
    return null
  }

  return Math.round(score * 10) / 10
}

function getJikanGenres(data: NonNullable<JikanMediaResponse['data']>) {
  const names = [
    ...(data.genres ?? []),
    ...(data.themes ?? []),
    ...(data.demographics ?? []),
  ]
    .map((genre) => genre.name)
    .filter((genre): genre is string => Boolean(genre?.trim()))

  return normalizeGenreList(names)
}

async function fetchJikanMetadataByMalId(
  idMal: number,
  type: 'Anime' | 'Manga'
): Promise<AnimeMangaImportMetadata | null> {
  const endpointType = type === 'Anime' ? 'anime' : 'manga'

  try {
    const response = await fetch(`https://api.jikan.moe/v4/${endpointType}/${idMal}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as JikanMediaResponse
    const data = payload.data

    if (!data) {
      return null
    }

    const externalRatingValue = normalizeJikanScore(data.score)
    const totalProgress = type === 'Anime' ? data.episodes : data.chapters

    return {
      externalRatingLabel: externalRatingValue === null ? null : 'MAL',
      externalRatingValue,
      genres: getJikanGenres(data),
      imageUrl: getJikanImageUrl(data),
      source: 'jikan-mal-id',
      totalProgress:
        typeof totalProgress === 'number' && Number.isInteger(totalProgress) && totalProgress > 0
          ? totalProgress
          : null,
    }
  } catch {
    return null
  }
}

export async function findAniListImportMetadata(
  title: string,
  type: 'Anime' | 'Manga',
  options: AnimeMangaImportLookupOptions = {}
): Promise<AnimeMangaImportMetadata | null> {
  const anilistType: AniListMediaType = type === 'Anime' ? 'ANIME' : 'MANGA'
  const malId = parseMalId(options.malId)

  if (malId !== null) {
    const mediaByMalId = await searchAniListMediaByMalId(malId, anilistType)

    if (mediaByMalId) {
      const metadata = toImportMetadata(mediaByMalId, type, 'anilist-mal-id')

      if (metadata.imageUrl) {
        return metadata
      }
    }

    const jikanMetadata = await fetchJikanMetadataByMalId(malId, type)

    if (jikanMetadata?.imageUrl) {
      return jikanMetadata
    }
  }

  const variants = buildSearchVariants(title)

  if (variants.length === 0) {
    return null
  }

  const seenIds = new Set<number>()
  const allCandidates: AniListMedia[] = []

  for (const variant of variants) {
    const candidates = await searchAniListMedia(variant, anilistType)

    for (const candidate of candidates) {
      if (seenIds.has(candidate.id)) {
        continue
      }

      seenIds.add(candidate.id)
      allCandidates.push(candidate)
    }

    const bestFromCurrentSearch = chooseBestMatch(candidates, variants)

    if (bestFromCurrentSearch && scoreMedia(bestFromCurrentSearch, variants) >= 0.9) {
      return toImportMetadata(bestFromCurrentSearch, type, 'title')
    }
  }

  const bestMatch = chooseBestMatch(allCandidates, variants)
  return bestMatch ? toImportMetadata(bestMatch, type, 'title') : null
}
