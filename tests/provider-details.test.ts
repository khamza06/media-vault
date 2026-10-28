import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { getProviderReference, plainProviderDescription } from '../lib/provider-details'
import { getAniListProviderDetails } from '../lib/anilist-import-enrichment'
import { getTmdbProviderDetails } from '../lib/catalog-search'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('linked provider details', () => {
  it('uses known IDs across supported sources and manga-family types', () => {
    expect(getProviderReference({ type: 'Manhwa', externalSource: 'anilist', externalId: 'anilist:20' }))
      .toEqual({ provider: 'anilist', type: 'Manga', id: 20, isMalId: false })
    expect(getProviderReference({ type: 'Anime', externalSource: 'myanimelist', externalId: '1' }))
      .toEqual({ provider: 'anilist', type: 'Anime', id: 1, isMalId: true })
    expect(getProviderReference({ type: 'Anime', externalSource: 'jikan', externalId: 'jikan:anime:1' })?.id).toBe(1)
    expect(getProviderReference({ type: 'Manga', externalSource: 'shikimori', externalId: 'shikimori:mangas:2' })).toBeNull()
    expect(getProviderReference({ type: 'Movie', externalSource: 'tmdb', externalId: 'tmdb:movie:27205' }))
      .toEqual({ provider: 'tmdb', type: 'movie', id: 27205 })
  })
  it('does not guess an identity from titles, arbitrary URLs or mismatched media', () => {
    for (const value of [null, 'https://example.com/1', 'tmdb:tv:1', '0']) {
      expect(getProviderReference({ type: 'Movie', externalSource: 'tmdb', externalId: value })).toBeNull()
    }
    expect(getProviderReference({ type: 'Anime', externalSource: null, externalId: '20' })).toBeNull()
  })
  it('returns plain bounded provider text, not raw HTML', () => {
    expect(plainProviderDescription('<b>A &amp; B</b><br>Next &quot;line&quot;')).toBe('A & B\nNext "line"')
    expect(plainProviderDescription('a'.repeat(15000))).toHaveLength(12000)
  })
  it('loads AniList descriptions by ID without changing an import or personal fields', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body)).variables).toEqual({ id: 20, type: 'ANIME' })
      return Response.json({ data: { Media: { id: 20, type: 'ANIME', description: '<b>Synopsis</b>', title: { english: 'Naruto' }, genres: ['Action'], startDate: { year: 2002 }, duration: 23, format: 'TV' } } })
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await getAniListProviderDetails(20, 'Anime', false)).toMatchObject({ description: 'Synopsis', provider: 'AniList', year: '2002', durationMinutes: 23, url: 'https://anilist.co/anime/20' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
  it('validates a MAL cross-ID instead of accepting a different work', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { Media: { id: 20, idMal: 2, type: 'ANIME' } } })))
    expect(await getAniListProviderDetails(1, 'Anime', true)).toBeNull()
  })
  it('uses one TMDB details request and keeps metadata read-only', async () => {
    vi.stubEnv('NEXT_PUBLIC_TMDB_API_KEY', 'fixture-key-not-real')
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      expect(new URL(String(url)).pathname).toBe('/3/movie/27205')
      return Response.json({ title: 'Inception', overview: 'Synopsis', runtime: 148, release_date: '2010-07-16', genres: [{ id: 1, name: 'Action' }] })
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await getTmdbProviderDetails(27205, 'movie')).toMatchObject({ provider: 'TMDB', year: '2010', durationMinutes: 148, description: 'Synopsis' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
