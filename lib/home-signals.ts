import 'server-only'

import type { MediaItem } from './media'

export type UpcomingEpisode = {
  airingAt: number
  countdownLabel: string
  episode: number
  imageUrl: string
  title: string
}

export type DiscoverRecommendation = {
  description: string
  externalRatingLabel: 'AniList' | null
  externalRatingValue: number | null
  genres: string[]
  id: string
  imageUrl: string
  provider: 'AniList'
  sourceUrl: string | null
  status: string
  subtitle: string
  title: string
  totalProgress: string
  type: 'Anime' | 'Manga' | 'Manhwa' | 'Manhua'
  year: string | null
}

function normalizeComparableTitle(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function createCountdownLabel(timeUntilAiring: number) {
  const seconds = Math.max(timeUntilAiring, 0)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)

  if (days > 0) {
    return `in ${days} day${days === 1 ? '' : 's'}`
  }

  if (hours > 0) {
    return `in ${hours} hour${hours === 1 ? '' : 's'}`
  }

  return 'soon'
}

function stripDescription(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeExternalRating(value: number | null | undefined) {
  if (typeof value !== 'number' || value <= 0) {
    return null
  }

  return Math.round((value / 10) * 10) / 10
}

function resolveRecommendationType(
  mediaType: string | null | undefined,
  countryOfOrigin: string | null | undefined,
  format: string | null | undefined
): DiscoverRecommendation['type'] {
  if (mediaType === 'ANIME') {
    return 'Anime'
  }

  const normalizedFormat = format?.toLowerCase() ?? ''

  if (countryOfOrigin === 'KR' || normalizedFormat.includes('manhwa')) {
    return 'Manhwa'
  }

  if (countryOfOrigin === 'CN' || normalizedFormat.includes('manhua')) {
    return 'Manhua'
  }

  return 'Manga'
}

export async function getUpcomingEpisodes(items: MediaItem[], locale: 'en') {
  void locale

  const watchingItems = items
    .filter((item) => item.status === 'Watching' && item.title.trim())
    .slice(0, 8)

  if (watchingItems.length === 0) {
    return [] as UpcomingEpisode[]
  }

  const results = await Promise.all(
    watchingItems.map(async (item) => {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query UpcomingEpisode($search: String!) {
              Media(search: $search, type: ANIME, isAdult: false) {
                coverImage {
                  extraLarge
                  large
                }
                nextAiringEpisode {
                  airingAt
                  episode
                  timeUntilAiring
                }
                title {
                  userPreferred
                }
              }
            }
          `,
          variables: {
            search: item.title,
          },
        }),
      })

      if (!response.ok) {
        return null
      }

      const payload = (await response.json()) as {
        data?: {
          Media?: {
            coverImage?: {
              extraLarge?: string | null
              large?: string | null
            } | null
            nextAiringEpisode?: {
              airingAt: number
              episode: number
              timeUntilAiring: number
            } | null
            title?: {
              userPreferred?: string | null
            } | null
          } | null
        }
      }

      const media = payload.data?.Media
      const nextAiring = media?.nextAiringEpisode

      if (!media || !nextAiring) {
        return null
      }

      return {
        airingAt: nextAiring.airingAt,
        countdownLabel: createCountdownLabel(nextAiring.timeUntilAiring),
        episode: nextAiring.episode,
        imageUrl: media.coverImage?.extraLarge ?? media.coverImage?.large ?? item.imageUrl ?? '',
        title: media.title?.userPreferred ?? item.title,
      } satisfies UpcomingEpisode
    })
  )

  return results
    .filter((item): item is UpcomingEpisode => item !== null)
    .sort((left, right) => left.airingAt - right.airingAt)
}

export async function getDiscoverRecommendations(items: MediaItem[]) {
  const ownedTitles = new Set(items.map((item) => normalizeComparableTitle(item.title)).filter(Boolean))
  const sourceItems = items
    .filter(
      (item) =>
        (item.rating ?? 0) >= 9 &&
        item.title.trim() &&
        ['Anime', 'Manga', 'Manhwa', 'Manhua'].includes(item.type)
    )
    .slice(0, 5)

  if (sourceItems.length === 0) {
    return [] as DiscoverRecommendation[]
  }

  const results = await Promise.all(
    sourceItems.map(async (item) => {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query DiscoverRecommendations($search: String!, $type: MediaType) {
              Media(search: $search, type: $type, isAdult: false) {
                recommendations(perPage: 6, sort: RATING_DESC) {
                  nodes {
                    mediaRecommendation {
                      averageScore
                      chapters
                      countryOfOrigin
                      coverImage {
                        extraLarge
                        large
                      }
                      description(asHtml: false)
                      episodes
                      format
                      genres
                      id
                      siteUrl
                      startDate {
                        year
                      }
                      title {
                        english
                        romaji
                        userPreferred
                      }
                      type
                      volumes
                    }
                  }
                }
              }
            }
          `,
          variables: {
            search: item.title,
            type: item.type === 'Anime' ? 'ANIME' : 'MANGA',
          },
        }),
      })

      if (!response.ok) {
        return [] as DiscoverRecommendation[]
      }

      const payload = (await response.json()) as {
        data?: {
          Media?: {
            recommendations?: {
              nodes?: Array<{
                mediaRecommendation?: {
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
                  siteUrl?: string | null
                  startDate?: {
                    year?: number | null
                  } | null
                  title?: {
                    english?: string | null
                    romaji?: string | null
                    userPreferred?: string | null
                  } | null
                  type?: string | null
                  volumes?: number | null
                } | null
              }>
            } | null
          } | null
        }
      }

      const recommendations = (payload.data?.Media?.recommendations?.nodes ?? []).reduce<
        DiscoverRecommendation[]
      >((collection, node) => {
        const media = node.mediaRecommendation

        if (!media) {
          return collection
        }

        const title =
          media?.title?.english?.trim() ||
          media?.title?.romaji?.trim() ||
          media?.title?.userPreferred?.trim() ||
          ''

        if (!title) {
          return collection
        }

        const type = resolveRecommendationType(media.type, media.countryOfOrigin, media.format)
        const totalProgress =
          type === 'Anime'
            ? String(media.episodes ?? '')
            : String(media.chapters ?? media.volumes ?? '')

        collection.push({
          description: stripDescription(media.description),
          externalRatingLabel: media.averageScore ? 'AniList' : null,
          externalRatingValue: normalizeExternalRating(media.averageScore),
          genres: media.genres ?? [],
          id: media.id ? `anilist:${media.id}` : `anilist:${type}:${title}`,
          imageUrl: media.coverImage?.extraLarge ?? media.coverImage?.large ?? '',
          provider: 'AniList',
          sourceUrl: media.siteUrl ?? null,
          status: type === 'Anime' ? 'Planning' : 'Reading',
          subtitle: media.format ?? 'AniList',
          title,
          totalProgress: totalProgress === '0' ? '' : totalProgress,
          type,
          year: media.startDate?.year ? String(media.startDate.year) : null,
        })

        return collection
      }, [])

      return recommendations
    })
  )

  const seen = new Set<string>()
  const unique: DiscoverRecommendation[] = []

  for (const recommendation of results.flat()) {
    const key = normalizeComparableTitle(recommendation.title)

    if (!key || seen.has(key) || ownedTitles.has(key)) {
      continue
    }

    seen.add(key)
    unique.push(recommendation)
  }

  return unique.slice(0, 10)
}
