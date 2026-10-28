import 'server-only'
import type { CatalogSearchCandidate } from './catalog-types'
import { getTmdbCandidateById, searchAniListCandidates } from './catalog-search'

export function exactProviderReference(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  let match: RegExpExecArray | null
  if (host === 'anilist.co' && (match = /^\/(anime|manga)\/([1-9]\d*)(?:\/|$)/.exec(url.pathname))) return { provider: 'anilist', kind: match[1], id: match[2] }
  if (['myanimelist.net', 'shikimori.one', 'shikimori.me'].includes(host) && (match = /^\/(animes?|mangas?)\/([1-9]\d*)(?:[-/]|$)/.exec(url.pathname))) return { provider: host === 'myanimelist.net' ? 'jikan' : 'shikimori', kind: match[1].replace(/s$/, ''), id: match[2] }
  if (host === 'themoviedb.org' && (match = /^\/(movie|tv)\/([1-9]\d*)(?:[-/]|$)/.exec(url.pathname))) return { provider: 'tmdb', kind: match[1], id: match[2] }
  if (host === 'imdb.com' && (match = /^\/title\/(tt\d+)(?:\/|$)/.exec(url.pathname))) return { provider: 'imdb', kind: '', id: match[1] }
  if (host === 'openlibrary.org' && (match = /^\/works\/(OL[1-9]\d*W)(?:\/|$)/.exec(url.pathname))) return { provider: 'openlibrary', kind: 'book', id: match[1] }
  return null
}

async function providerJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { cache: 'no-store', signal, redirect: 'error', headers: { Accept: 'application/json', 'User-Agent': 'MediaVault/1.0' } })
  if (!response.ok) throw new Error('Exact lookup unavailable')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Exact lookup unavailable')
  const chunks: Uint8Array[] = []; let size = 0
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2 * 1024 * 1024) throw new Error('Provider response too large'); chunks.push(value) } }
  finally { await reader.cancel().catch(() => {}) }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export async function resolveExactProviderUrl(url: URL, signal: AbortSignal): Promise<CatalogSearchCandidate[] | null> {
  const reference = exactProviderReference(url)
  if (!reference) return null
  const { provider, kind, id } = reference
  if (provider !== 'imdb' && provider !== 'openlibrary' && (!Number.isSafeInteger(Number(id)) || Number(id) > 2147483647)) return []
  if (provider === 'anilist') return searchAniListCandidates([''], kind === 'anime' ? 'ANIME' : 'MANGA', { anilistId: Number(id), signal })
  if (provider === 'jikan') {
    try {
      const mapped = await searchAniListCandidates([''], kind === 'anime' ? 'ANIME' : 'MANGA', { malId: Number(id), signal })
      if (mapped.length) return mapped.map(candidate => ({ ...candidate, id: `jikan:${kind}:${id}`, provider: 'Jikan' as const, subtitle: 'MAL ID verified by AniList' }))
    } catch { /* Fall back to the exact MAL resource, never to title matching. */ }
  }
  if (provider === 'tmdb') {
    const candidate = await getTmdbCandidateById(Number(id), kind === 'tv' ? 'tv' : 'movie')
    return candidate ? [candidate] : []
  }
  if (provider === 'imdb') {
    const key = process.env.TMDB_API_KEY ?? process.env.NEXT_PUBLIC_TMDB_API_KEY
    if (!key) return []
    const payload = await providerJson(`https://api.themoviedb.org/3/find/${id}?api_key=${encodeURIComponent(key)}&external_source=imdb_id`, signal)
    const refs = [...(payload.movie_results ?? []).map((row: { id: number }) => ({ id: row.id, kind: 'movie' as const })), ...(payload.tv_results ?? []).map((row: { id: number }) => ({ id: row.id, kind: 'tv' as const }))].slice(0, 2)
    return (await Promise.all(refs.map(row => getTmdbCandidateById(row.id, row.kind)))).filter((row): row is CatalogSearchCandidate => row !== null)
  }
  if (provider === 'openlibrary') {
    let work = `/works/${id}`
    let row = await providerJson(`https://openlibrary.org${work}.json`, signal)
    for (let hop = 0; hop < 2 && row.type?.key === '/type/redirect'; hop++) {
      if (typeof row.location !== 'string' || !/^\/works\/OL[1-9]\d*W$/.test(row.location)) return []
      work = row.location
      row = await providerJson(`https://openlibrary.org${work}.json`, signal)
    }
    if (row.key !== work || typeof row.title !== 'string') return []
    return [{ id: `openlibrary:${work}`, provider: 'OpenLibrary', type: 'Book', title: row.title, alternativeTitles: Array.isArray(row.alternative_titles) ? row.alternative_titles.filter((title: unknown) => typeof title === 'string').slice(0, 16) : [], genres: '', imageUrl: Number.isSafeInteger(row.covers?.[0]) && row.covers[0] > 0 ? `https://covers.openlibrary.org/b/id/${row.covers[0]}-L.jpg` : '', description: '', status: 'Planning', score: 1, subtitle: 'Book', totalProgress: '', year: /(?:18|19|20|21)\d{2}/.exec(String(row.first_publish_date ?? ''))?.[0] ?? null }]
  }
  const jikan = provider === 'jikan'
  const payload = await providerJson(jikan ? `https://api.jikan.moe/v4/${kind}/${id}` : `https://shikimori.one/api/${kind}s/${id}`, signal)
  const row = jikan ? payload.data : payload
  if (!row || Number(jikan ? row.mal_id : row.id) !== Number(id) || /rx|hentai/i.test(String(row.rating ?? '')) || row.genres?.some((genre: { name: string }) => /hentai|erotica/i.test(genre.name))) return []
  const title = (jikan ? row.title_english || row.title || row.title_japanese : row.name || row.russian) as string
  if (!title) return []
  const subtype = String(row.type ?? row.kind ?? '').toLowerCase()
  const type = kind === 'anime' ? 'Anime' : subtype === 'manhwa' ? 'Manhwa' : subtype === 'manhua' ? 'Manhua' : 'Manga'
  return [{ id: `${provider}:${jikan ? kind : `${kind}s`}:${id}`, provider: jikan ? 'Jikan' : 'Shikimori', type, title, alternativeTitles: [row.title, row.title_english, row.title_japanese, row.name, row.russian, ...(row.title_synonyms ?? [])].filter((value): value is string => typeof value === 'string').slice(0, 24), genres: '', imageUrl: jikan ? row.images?.jpg?.large_image_url ?? '' : '', description: row.synopsis ?? '', status: kind === 'anime' ? 'Planning' : 'Reading', score: 1, subtitle: row.type ?? row.kind ?? '', totalProgress: String((kind === 'anime' ? row.episodes : row.chapters) || ''), year: row.year ? String(row.year) : null }]
}
