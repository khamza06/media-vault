import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { searchAniListCandidates, searchCatalogPage } from '../lib/catalog-search'

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('catalog pagination', () => {
  it('uses AniList pages of 20, preserving same-title different-ID works', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { variables: { page: number; perPage: number } }
      expect(body.variables.perPage).toBe(20)
      expect(body.variables).not.toHaveProperty('country')
      expect(JSON.parse(String(init?.body)).query).not.toContain('countryOfOrigin:')
      const media = Array.from({ length: 20 }, (_, index) => ({ id: (body.variables.page - 1) * 20 + index + 1, title: { english: 'Fixture' }, type: 'ANIME', averageScore: 83 }))
      return Response.json({ data: { Page: { media, pageInfo: { hasNextPage: body.variables.page === 1 } } } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const first = await searchCatalogPage('Fixture', 'anime', 'en')
    const next = await searchCatalogPage('Fixture', 'anime', 'en', 'primary', 2)
    expect(first.data).toHaveLength(20)
    expect(next.data).toHaveLength(20)
    expect(first.hasMore).toBe(true)
    expect(next.hasMore).toBe(false)
    expect(new Set([...first.data, ...next.data].map((item) => item.id)).size).toBe(40)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the small default resolver query size unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { variables: { perPage: number } }
      expect(body.variables.perPage).toBe(5)
      return Response.json({ data: { Page: { media: [] } } })
    }))
    await searchAniListCandidates(['Fixture'], 'ANIME')
  })

  it('does not fetch TMDB details for every result in a full page', async () => {
    vi.stubEnv('NEXT_PUBLIC_TMDB_API_KEY', 'fixture-key-not-real')
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.pathname.includes('/genre/')) return Response.json({ genres: [{ id: 1, name: 'Action' }] })
      expect(url.pathname).toBe('/3/search/movie')
      expect(url.searchParams.get('page')).toBe('2')
      return Response.json({ page: 2, total_pages: 3, results: Array.from({ length: 20 }, (_, index) => ({ id: index + 1, title: `Fixture ${index}`, genre_ids: [1], overview: 'Synopsis', vote_average: 8.3 })) })
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await searchCatalogPage('Fixture', 'movie', 'en', 'primary', 2)
    expect(result.data).toHaveLength(20)
    expect(result.hasMore).toBe(true)
    expect(result.data[0]).toMatchObject({ description: 'Synopsis', externalRatingValue: 8.3 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('queries only the explicitly selected fallback provider and reads its page info', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      expect(url.hostname).toBe('api.jikan.moe')
      expect(url.searchParams.get('page')).toBe('3')
      expect(url.searchParams.get('limit')).toBe('20')
      expect(url.searchParams.get('sfw')).toBe('true')
      return Response.json({ pagination: { has_next_page: true }, data: [{ mal_id: 1, title: 'Fixture', synopsis: 'Synopsis' }] })
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await searchCatalogPage('Fixture', 'manga', 'en', 'jikan', 3)).toMatchObject({ provider: 'Jikan', hasMore: true })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('uses Kitsu offsets and does not hide later pages after filtering an adult result', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      expect(url.searchParams.get('page[offset]')).toBe('20')
      return Response.json({ links: { next: 'https://kitsu.io/next' }, data: [{ id: '1', attributes: { canonicalTitle: 'Filtered fixture', nsfw: true } }] })
    }))
    expect(await searchCatalogPage('Fixture', 'manga', 'en', 'kitsu', 2)).toMatchObject({ data: [], hasMore: true })
  })

  it('uses Open Library total counts for its last page', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      expect(new URL(String(input)).searchParams.get('page')).toBe('3')
      return Response.json({ numFound: 41, start: 40, docs: [{ key: '/works/fixture', title: 'Fixture book' }] })
    }))
    expect(await searchCatalogPage('Fixture', 'book', 'en', 'primary', 3)).toMatchObject({ hasMore: false, provider: 'OpenLibrary' })
  })

  it('does not silently turn fallback provider errors into empty full-search results', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'Rate limited' }, { status: 429 })))
    await expect(searchCatalogPage('Fixture', 'anime', 'en', 'jikan')).rejects.toMatchObject({ provider: 'Jikan', status: 429 })
  })

  it('reports an invalid provider response instead of returning an empty array', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })))
    await expect(searchCatalogPage('Fixture', 'anime', 'en')).rejects.toMatchObject({ provider: 'AniList' })
  })
})
