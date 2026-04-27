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
  imageUrl: string
  provider: 'AniList'
  subtitle: string
  title: string
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
                      coverImage {
                        extraLarge
                        large
                      }
                      format
                      title {
                        userPreferred
                      }
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
                  coverImage?: {
                    extraLarge?: string | null
                    large?: string | null
                  } | null
                  format?: string | null
                  title?: {
                    userPreferred?: string | null
                  } | null
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

        if (!media?.title?.userPreferred) {
          return collection
        }

        collection.push({
          imageUrl: media.coverImage?.extraLarge ?? media.coverImage?.large ?? '',
          provider: 'AniList',
          subtitle: media.format ?? 'AniList',
          title: media.title.userPreferred,
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
