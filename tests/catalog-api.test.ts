import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), searchCatalogPage: vi.fn(), searchCatalogByMediaType: vi.fn(), getTmdbCandidateById: vi.fn() }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/catalog-search', () => ({ ...mocks, isCatalogSearchProviderError: (error: unknown) => error instanceof Error && 'provider' in error }))
vi.mock('../lib/i18n-server', () => ({ getRequestLocale: async () => 'en' }))
import { POST as search } from '../app/api/catalog-search/route'
import { POST as details } from '../app/api/catalog-details/route'

function request(body: unknown) {
  return new Request('https://media-vault.app/api/catalog-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mocks.getCurrentUser.mockResolvedValue({ id: 'fixture-owner' })
  mocks.searchCatalogPage.mockResolvedValue({ data: [], page: 1, hasMore: false, provider: 'AniList' })
})

describe('catalog API validation', () => {
  it.each(['My Hero Academia', 'Re', 'Re:Zero', 'Berserk'])('allows legitimate title %s in fast and full search', async (query) => {
    mocks.searchCatalogByMediaType.mockResolvedValue([])
    expect((await search(request({ query, type: 'anime' }))).status).toBe(200)
    expect(mocks.searchCatalogByMediaType).toHaveBeenCalled()
    expect((await search(request({ query, type: 'anime', mode: 'full' }))).status).toBe(200)
    expect(mocks.searchCatalogPage).toHaveBeenCalledWith(query, 'anime', 'en', 'primary', 1)
  })
  it('keeps fast requests compatible and limited to five suggestions', async () => {
    mocks.searchCatalogByMediaType.mockResolvedValue(Array.from({ length: 8 }, (_, index) => ({ id: index })))
    const response = await search(request({ query: 'naruto', type: 'anime' }))
    expect((await response.json()).data).toHaveLength(5)
    expect(mocks.searchCatalogPage).not.toHaveBeenCalled()
  })
  it('passes full-search page/source choices through safely', async () => {
    expect((await search(request({ query: 'berserk', type: 'manga', mode: 'full', page: 2, source: 'jikan' }))).status).toBe(200)
    expect(mocks.searchCatalogPage).toHaveBeenCalledWith('berserk', 'manga', 'en', 'jikan', 2)
  })
  it.each([null, [], 'bad'])('rejects malformed JSON shapes: %j', async (body) => {
    expect((await search(request(body))).status).toBe(400)
  })
  it.each([{ source: ['primary'] }, { source: 'unknown' }, { page: -1 }, { page: 1.5 }, { page: 501 }])('rejects invalid pagination/source: %j', async (extra) => {
    expect((await search(request({ query: 'naruto', type: 'anime', mode: 'full', ...extra }))).status).toBe(400)
    expect(mocks.searchCatalogPage).not.toHaveBeenCalled()
  })
  it('does not let a movie request target anime-only sources', async () => {
    expect((await search(request({ query: 'inception', type: 'movie', mode: 'full', source: 'jikan' }))).status).toBe(400)
  })
  it('returns helpful short-query copy without calling providers', async () => {
    const response = await search(request({ query: 'n', type: 'anime' }))
    expect(await response.json()).toMatchObject({ data: [], message: expect.stringContaining('2 characters') })
    expect(mocks.searchCatalogByMediaType).not.toHaveBeenCalled()
  })
  it('blocks guests for search and details', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    expect((await search(request({ query: 'naruto', type: 'anime' }))).status).toBe(401)
    expect((await details(request({ id: 'tmdb:movie:1', type: 'movie' }))).status).toBe(401)
    expect(mocks.getTmdbCandidateById).not.toHaveBeenCalled()
  })
  it('keeps provider errors visible with a 502 response', async () => {
    mocks.searchCatalogPage.mockRejectedValue(Object.assign(new Error('AniList is unavailable'), { provider: 'AniList', status: 503 }))
    const response = await search(request({ query: 'naruto', type: 'anime', mode: 'full' }))
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ error: 'AniList is unavailable' })
  })
  it('does not accept an arbitrary URL as a detail lookup ID', async () => {
    expect((await details(request({ id: 'https://example.com/private', type: 'movie' }))).status).toBe(400)
    expect(mocks.getTmdbCandidateById).not.toHaveBeenCalled()
  })
})
