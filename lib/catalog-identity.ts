export type CatalogIdentity = { source: string; id: string }

export function getCatalogIdentity(value: unknown, type: string): CatalogIdentity | null {
  if (typeof value !== 'string' || value.length > 160) return null
  const manga = ['Manga', 'Manhwa', 'Manhua'].includes(type)
  if (type === 'Book') {
    const match = /^openlibrary:(\/works\/OL[1-9]\d*W)$/.exec(value)
    return match ? { source: 'openlibrary', id: match[1] } : null
  }
  if (type === 'Anime' || manga) {
    const mediaType = type === 'Anime' ? 'anime' : 'manga'
    const match = /^(anilist|jikan|kitsu|shikimori):(?:(anime|manga|animes|mangas):)?([1-9]\d*)$/.exec(value)
    if (!match || (match[1] === 'anilist' ? Boolean(match[2]) : !match[2])
      || (match[2] && match[2].replace(/s$/, '') !== mediaType)) return null
    return Number(match[3]) <= 2147483647 ? { source: match[1], id: match[3] } : null
  }
  const match = /^tmdb:(movie|tv):([1-9]\d*)$/.exec(value)
  if (!match || (type !== 'Movie' && type !== 'TV Series')
    || match[1] !== (type === 'Movie' ? 'movie' : 'tv')) return null
  return Number(match[2]) <= 2147483647 ? { source: 'tmdb', id: match[2] } : null
}
