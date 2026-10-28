import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ searchAniListCandidates: vi.fn(), getTmdbCandidateById: vi.fn() }))
vi.mock('../lib/catalog-search', () => mocks)
import { exactProviderReference, resolveExactProviderUrl } from '../lib/quick-import-exact'
beforeEach(() => vi.resetAllMocks())
afterEach(() => vi.unstubAllGlobals())
describe('exact catalog resources', () => {
  it.each(['https://evilmyanimelist.net/anime/20', 'https://myanimelist.net.attacker.org/anime/20', 'https://evilthemoviedb.org/movie/1'])('does not trust lookalike host %s', url => expect(exactProviderReference(new URL(url))).toBeNull())
  it('never uses the URL slug as identity', async () => {
    mocks.searchAniListCandidates.mockResolvedValue([])
    expect(await resolveExactProviderUrl(new URL('https://anilist.co/anime/20/Incorrect'), AbortSignal.timeout(1000))).toEqual([])
    expect(mocks.searchAniListCandidates).toHaveBeenCalledWith([''], 'ANIME', expect.objectContaining({ anilistId: 20 }))
  })
  it('preserves MAL identity after verified cross-catalog lookup', async () => {
    mocks.searchAniListCandidates.mockResolvedValue([{ id: 'anilist:999', provider: 'AniList', title: 'A work' }])
    const data = await resolveExactProviderUrl(new URL('https://myanimelist.net/anime/20/Incorrect'), AbortSignal.timeout(1000))
    expect(mocks.searchAniListCandidates).toHaveBeenCalledWith([''], 'ANIME', expect.objectContaining({ malId: 20 }))
    expect(data?.[0]).toMatchObject({ id: 'jikan:anime:20', subtitle: 'MAL ID verified by AniList' })
  })
  it('follows bounded Open Library work merges to a canonical stable ID', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ key: '/works/OL1W', type: { key: '/type/redirect' }, location: '/works/OL2W' })).mockResolvedValueOnce(Response.json({ key: '/works/OL2W', title: 'Canonical book' }))
    vi.stubGlobal('fetch', fetch)
    expect((await resolveExactProviderUrl(new URL('https://openlibrary.org/works/OL1W'), AbortSignal.timeout(1000)))?.[0].id).toBe('openlibrary:/works/OL2W')
    expect(fetch.mock.calls[1][0]).toBe('https://openlibrary.org/works/OL2W.json')
  })
  it('never follows an arbitrary URL returned in a provider merge', async () => {
    const fetch = vi.fn(async () => Response.json({ key: '/works/OL1W', type: { key: '/type/redirect' }, location: 'http://127.0.0.1/private' }))
    vi.stubGlobal('fetch', fetch)
    expect(await resolveExactProviderUrl(new URL('https://openlibrary.org/works/OL1W'), AbortSignal.timeout(1000))).toEqual([])
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
