import { parseProviderMediaId } from './provider-ids'

export type ProviderDetails = {
  provider: 'AniList' | 'TMDB'
  url: string
  title: string | null
  description: string
  genres: string[]
  year: string | null
  format: string | null
  durationMinutes: number | null
}

type ProviderReference =
  | { provider: 'anilist'; id: number; type: 'Anime' | 'Manga'; isMalId: boolean }
  | { provider: 'tmdb'; id: number; type: 'movie' | 'tv' }

export function getProviderReference(item: { type: string; externalSource: string | null; externalId: string | null }): ProviderReference | null {
  const source = item.externalSource?.trim().toLowerCase()
  const raw = item.externalId?.trim()
  if (!raw || !source) return null
  const anime = item.type === 'Anime'
  const manga = ['Manga', 'Manhwa', 'Manhua'].includes(item.type)
  if (anime || manga) {
    if (source !== 'anilist' && !['myanimelist', 'jikan'].includes(source)) return null
    const mediaType = anime ? 'anime' : 'manga'
    const idValue = source === 'anilist' ? raw.replace(/^anilist:(?=\d+$)/, '')
      : raw.replace(new RegExp(`^${source}:${mediaType}s?:`), '')
    const id = parseProviderMediaId(idValue, source === 'anilist' ? 'anilist' : 'myanimelist', mediaType)
    return id ? { provider: 'anilist', id, type: anime ? 'Anime' : 'Manga', isMalId: source !== 'anilist' } : null
  }
  if (source === 'tmdb' && (item.type === 'Movie' || item.type === 'TV Series')) {
    const type = item.type === 'Movie' ? 'movie' : 'tv'
    const id = parseProviderMediaId(raw, 'tmdb', type)
    return id ? { provider: 'tmdb', id, type } : null
  }
  return null
}

export function plainProviderDescription(value: string) {
  return value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|apos|#39|#039|nbsp);/g, (entity) => ({
      '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&#039;': "'", '&nbsp;': ' ',
    }[entity] ?? entity)).trim().slice(0, 12000)
}
