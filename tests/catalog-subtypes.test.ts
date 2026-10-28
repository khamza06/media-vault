import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { searchCatalogByMediaType, searchCatalogPage } from '../lib/catalog-search'

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllGlobals())

const media = [
  { id: 1, countryOfOrigin: 'JP', format: 'MANGA', title: { english: 'Fixture manga' } },
  { id: 2, countryOfOrigin: 'KR', format: 'MANGA', title: { english: 'Fixture manhwa' } },
  { id: 3, countryOfOrigin: 'CN', format: 'MANGA', title: { english: 'Fixture manhua' } },
  { id: 4, countryOfOrigin: 'KR', format: 'NOVEL', title: { english: 'Fixture Korean novel' } },
]

describe('catalog subtype search', () => {
  it('verifies exact AniList and MAL IDs in the returned payload before accepting metadata', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { Page: { media: [{ id: 21, idMal: 30, title: { english: 'Unrelated' } }] } } })))
    const { searchAniListCandidates } = await import('../lib/catalog-search')
    expect(await searchAniListCandidates([''], 'ANIME', { anilistId: 20 })).toEqual([])
    expect(await searchAniListCandidates([''], 'ANIME', { malId: 20 })).toEqual([])
  })
  it.each([['manhwa', 'KR', 'Manhwa', 'anilist:2'], ['manhua', 'CN', 'Manhua', 'anilist:3']] as const)('filters %s at AniList and preserves provider identities in fast/full results', async (type, country, displayType, id) => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.variables).toMatchObject({ type: 'MANGA', country })
      expect(body.query).toContain('countryOfOrigin: $country')
      expect(body.query).toContain('format_not: NOVEL')
      return Response.json({ data: { Page: { media, pageInfo: { hasNextPage: true } } } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const fast = await searchCatalogByMediaType(['Fixture'], type, 'en')
    const full = await searchCatalogPage('Fixture', type, 'en', 'primary', 2)
    expect(fast).toHaveLength(1)
    expect(fast[0]).toMatchObject({ id, type: displayType })
    expect(full).toMatchObject({ data: [{ id, type: displayType }], page: 2, hasMore: true, provider: 'AniList' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([['manhwa', 'Manhwa'], ['manhua', 'Manhua']] as const)('filters every fallback by verified %s subtype instead of relabelling Manga', async (type, displayType) => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.hostname === 'graphql.anilist.co') return Response.json({ data: { Page: { media: [] } } })
      if (url.hostname === 'api.jikan.moe') return Response.json({ data: ['Manga', 'Manhwa', 'Manhua'].map((subtype, index) => ({ mal_id: index + 1, title: `Fixture ${subtype} Jikan`, type: subtype })) })
      if (url.hostname === 'kitsu.io') return Response.json({ data: ['manga', 'manhwa', 'manhua'].map((subtype, index) => ({ id: String(index + 1), attributes: { canonicalTitle: `Fixture ${subtype} Kitsu`, subtype } })) })
      if (url.hostname === 'shikimori.one') return Response.json(['manga', 'manhwa', 'manhua'].map((kind, index) => ({ id: index + 1, name: `Fixture ${kind} Shikimori`, kind })))
      throw new Error('Unexpected provider')
    }))
    const result = await searchCatalogByMediaType(['Fixture'], type, 'en')
    expect(result.length).toBeGreaterThan(0)
    expect(result.every(candidate => candidate.type === displayType)).toBe(true)
    expect(result.some(candidate => candidate.provider === 'Jikan')).toBe(true)
    expect(result.every(candidate => candidate.title.toLowerCase().includes(type))).toBe(true)
  })

  it('preserves fallback pagination when a subtype has no matches on the current page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: [{ mal_id: 1, title: 'Fixture Japanese work', type: 'Manga' }], pagination: { has_next_page: true } })))
    expect(await searchCatalogPage('Fixture', 'manhua', 'en', 'jikan', 2)).toMatchObject({ data: [], hasMore: true, page: 2, provider: 'Jikan' })
  })
})
