import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { findAniListImportMetadata } from '../lib/anilist-import-enrichment'
import { getTmdbCandidateById } from '../lib/catalog-search'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
beforeEach(() => vi.stubEnv('NEXT_PUBLIC_TMDB_API_KEY', 'fixture-key-not-real'))

describe('AniList metadata identity', () => {
  it('uses the stored AniList ID, even if the local title was renamed', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { query: string; variables: unknown }
      expect(body.query).toContain('Media(id: $id')
      expect(body.variables).toEqual({ id: 20, type: 'ANIME' })
      return Response.json({ data: { Media: { id: 20, type: 'ANIME', averageScore: 83, title: { english: 'Provider title' }, episodes: 12 } } })
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await findAniListImportMetadata('Renamed locally', 'Anime', { anilistId: '20', strictTitleMatch: true }))
      .toMatchObject({ externalRatingLabel: 'AniList', externalRatingValue: 8.3, imageUrl: null, totalProgress: 12, source: 'anilist-id' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not replace a known ID with a title match during a provider outage', async () => {
    const fetchMock = vi.fn(async () => Response.json({}, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await findAniListImportMetadata('Fixture', 'Anime', { anilistId: '20', strictTitleMatch: true })).toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('skips ambiguous exact titles when no stable ID is available', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { Page: { media: [
      { id: 1, title: { english: 'Fixture' }, averageScore: 80 },
      { id: 2, title: { english: 'Fixture' }, averageScore: 90 },
    ] } } })))
    expect(await findAniListImportMetadata('Fixture', 'Anime', { strictTitleMatch: true })).toBeNull()
  })

  it('does not use a loosely similar sequel for metadata refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { Page: { media: [
      { id: 1, title: { english: 'Fixture Season 2' }, averageScore: 80, coverImage: { large: 'https://example.com/sequel.png' } },
    ] } } })))
    expect(await findAniListImportMetadata('Fixture', 'Anime', { strictTitleMatch: true })).toBeNull()
  })

  it('keeps an official rating from an exact MAL ID even without a cover', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { Media: { id: 20, idMal: 1, averageScore: 8, type: 'ANIME' } } })))
    expect(await findAniListImportMetadata('Fixture', 'Anime', { malId: '1', strictTitleMatch: true }))
      .toMatchObject({ externalRatingValue: 0.8, source: 'anilist-mal-id' })
  })
})

describe('TMDB metadata identity', () => {
  it('loads one movie detail endpoint, without a title search or genre-list request', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(new URL(String(input)).pathname).toBe('/3/movie/27205')
      return Response.json({ title: 'Inception', vote_average: 8.36, poster_path: '/fixture.jpg', genres: [{ id: 1, name: 'Action' }], release_date: '2010-07-16' })
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await getTmdbCandidateById(27205, 'movie')).toMatchObject({ title: 'Inception', type: 'Movie', externalRatingValue: 8.4, totalProgress: '1' })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('uses TV details and episode totals for series', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ name: 'Fixture series', vote_average: 8.5, number_of_episodes: 62 })))
    expect(await getTmdbCandidateById(1396, 'tv')).toMatchObject({ type: 'TV Series', totalProgress: '62', externalRatingValue: 8.5 })
  })

  it('returns unavailable metadata on a failed provider response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 404 })))
    expect(await getTmdbCandidateById(123, 'movie')).toBeNull()
  })
})
