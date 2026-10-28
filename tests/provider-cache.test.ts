import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => mocks)
import { discardInvalidProviderCache, publicProviderCacheOptions, publicProviderCacheTag } from '../lib/provider-cache'
import { findAniListImportMetadata, getAniListProviderDetails } from '../lib/anilist-import-enrichment'
import { getTmdbCandidateById, getTmdbProviderDetails, searchTmdbCandidatesByType } from '../lib/catalog-search'

beforeEach(() => vi.stubEnv('NEXT_PUBLIC_TMDB_API_KEY', 'fixture-key-not-real'))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('public metadata-only upstream caching', () => {
  it('keys by provider namespace, media type and ID with finite TTLs, never vault/account data', () => {
    expect(publicProviderCacheOptions('anilist', 'ANIME', 20)).toEqual({ cache: 'force-cache', next: { revalidate: 3600, tags: ['mv-provider:v1:anilist:ANIME:20'] } })
    expect(publicProviderCacheOptions('tmdb', 'movie', 'genres').next.revalidate).toBe(21600)
    expect(publicProviderCacheTag('tmdb', 'movie', 1)).not.toBe(publicProviderCacheTag('tmdb', 'tv', 1))
    expect(publicProviderCacheTag('anilist', 'ANIME', 1)).not.toBe(publicProviderCacheTag('anilist-mal', 'ANIME', 1))
  })
  it('opts in only for the on-demand AniList panel, keeping imports/refresh fresh', async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: { Media: { id: 20, type: 'ANIME', averageScore: 83 } } }))
    vi.stubGlobal('fetch', fetchMock)
    await getAniListProviderDetails(20, 'Anime', false)
    await findAniListImportMetadata('Fixture', 'Anime', { anilistId: '20' })
    expect(fetchMock.mock.calls).toHaveLength(2)
    const panel = vi.mocked(fetch).mock.calls[0][1]
    const refresh = vi.mocked(fetch).mock.calls[1][1]
    expect(panel).toMatchObject({ cache: 'force-cache', next: { revalidate: 3600 } })
    expect(panel?.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' })
    expect(refresh?.cache).toBe('no-store')
    expect(refresh).not.toHaveProperty('next')
  })
  it('expires GraphQL HTTP-200 errors, wrong identities and malformed JSON instead of retaining empty failure results', async () => {
    for (const response of [Response.json({ errors: [{ message: 'Unavailable' }] }), Response.json({ data: { Media: { id: 99, type: 'ANIME' } } }), new Response('not JSON')]) {
      vi.stubGlobal('fetch', vi.fn(async () => response))
      expect(await getAniListProviderDetails(20, 'Anime', false)).toBeNull()
    }
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(3)
    expect(mocks.revalidateTag).toHaveBeenCalledWith('mv-provider:v1:anilist:ANIME:20', { expire: 0 })
  })
  it('keeps TMDB ID preview/refresh uncached while About uses the public cache', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ title: 'Fixture', runtime: 90 })))
    await getTmdbProviderDetails(1, 'movie')
    await getTmdbCandidateById(1, 'movie')
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ cache: 'force-cache', next: { revalidate: 3600 } })
    expect(vi.mocked(fetch).mock.calls[1][1]).toMatchObject({ cache: 'no-store' })
  })
  it('caches only public TMDB genre taxonomy, not title search queries', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => Response.json(String(url).includes('/genre/') ? { genres: [{ id: 1, name: 'Action' }] } : { results: [] })))
    await searchTmdbCandidatesByType(['Fixture'], 'movie', { includeDetails: false })
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ cache: 'force-cache', next: { revalidate: 21600 } })
    expect(vi.mocked(fetch).mock.calls[1][1]).toMatchObject({ cache: 'no-store' })
  })
  it('expires invalid TMDB payloads and tolerates standalone probes without a Next cache context', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false })))
    expect(await getTmdbProviderDetails(1, 'movie')).toBeNull()
    expect(mocks.revalidateTag).toHaveBeenCalledWith('mv-provider:v1:tmdb:movie:1', { expire: 0 })
    mocks.revalidateTag.mockImplementationOnce(() => { throw new Error('No cache context') })
    expect(() => discardInvalidProviderCache('tmdb', 'tv', 1)).not.toThrow()
  })
})
