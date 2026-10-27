export function parseProviderMediaId(
  value: string | null | undefined,
  provider: 'anilist' | 'myanimelist' | 'tmdb',
  mediaType: 'anime' | 'manga' | 'movie' | 'tv'
) {
  const raw = value?.trim() ?? ''
  const prefix = `${provider}:${mediaType}:`
  const id = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw
  if (!/^\d+$/.test(id)) return null
  const parsed = Number(id)
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2147483647 ? parsed : null
}
