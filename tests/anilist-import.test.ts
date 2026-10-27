import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), from: vi.fn(), insert: vi.fn(), eq: vi.fn(), revalidatePath: vi.fn(), findAniListImportMetadata: vi.fn() }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from: mocks.from }) }))
vi.mock('../lib/anilist-import-enrichment', () => mocks)
vi.mock('../lib/data/storage', () => ({ deleteOwnedCoverByPublicUrl: vi.fn() }))
vi.mock('next/cache', () => mocks)

import { fetchAniListLibraryByUsername, importAniListItems, importCsvItems, importMyAnimeListItems, type AniListImportCandidate } from '../app/actions/import'

const notes = '  # Notes\n\n**Keep this**  \n> Exactly as written.\n'
const candidate: AniListImportCandidate = { title: 'Fixture Anime', type: 'anime', external_id: '20', external_source: 'anilist', external_score: 8.3, notes, progress: 5, rating: 8, status: 'Re-Watching', started_at: '2024-02-29', completed_at: '2024-03-01', total_progress: 12 }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getCurrentUser.mockResolvedValue({ id: 'fixture-owner', accessToken: 'test-access-token' })
  const query = { data: [], error: null, select: vi.fn(), eq: mocks.eq, in: vi.fn(), insert: mocks.insert }
  query.select.mockReturnValue(query)
  mocks.eq.mockReturnValue(query)
  query.in.mockResolvedValue({ data: [], error: null })
  mocks.insert.mockReturnValue({ select: async () => ({ data: [{ id: 'fixture-inserted' }], error: null }) })
  mocks.from.mockReturnValue(query)
})
afterEach(() => vi.unstubAllGlobals())

describe('AniList preview', () => {
  it('requests a defined score format, notes and dates in exactly two calls', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { query: string; variables: { type: string } }
      expect(body.query).toContain('score(format: POINT_10_DECIMAL)')
      expect(body.query).toContain('notes')
      expect(body.query).toContain('startedAt')
      const entry = { status: 'REPEATING', score: 7.5, progress: 5, notes, startedAt: { year: 2024, month: 2, day: 29 }, completedAt: { year: 2024, month: null, day: null }, media: { id: body.variables.type === 'ANIME' ? 20 : 21, type: body.variables.type, title: { english: 'Fixture', romaji: 'Fallback' }, averageScore: 8, countryOfOrigin: 'JP' } }
      return Response.json({ data: { MediaListCollection: { lists: [{ entries: [entry] }] } } })
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await fetchAniListLibraryByUsername('fixture-user')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates[0]).toMatchObject({ notes, started_at: '2024-02-29', completed_at: null, rating: 8, external_score: 0.8, status: 'Re-Watching' })
    expect(result.candidates[1].status).toBe('Reading')
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('returns partial results with a warning when one collection fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { variables: { type: string } }
      return body.variables.type === 'ANIME'
        ? Response.json({ data: { MediaListCollection: { lists: [{ entries: [{ media: { id: 20, type: 'ANIME', title: { romaji: 'Fixture' } } }] }] } } })
        : Response.json({ errors: [{ message: 'Private list' }] }, { status: 403 })
    }))
    const result = await fetchAniListLibraryByUsername('fixture-user')
    expect(result.candidates).toHaveLength(1)
    expect(result.warning).toContain('Partial')
  })
})

describe('AniList selected import', () => {
  it('inserts only current-owner data, preserving notes, progress and dates', async () => {
    const result = await importAniListItems([candidate])
    expect(result.imported).toBe(1)
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'fixture-owner')
    expect(mocks.insert).toHaveBeenCalledWith([expect.objectContaining({ user_id: 'fixture-owner', external_source: 'anilist', external_id: '20', external_rating_value: 8.3, notes, progress: 5, started_at: '2024-02-29', completed_at: '2024-03-01', status: 'Re-Watching' })])
    expect(mocks.findAniListImportMetadata).not.toHaveBeenCalled()
  })

  it('skips duplicates within one selected batch', async () => {
    const result = await importAniListItems([candidate, { ...candidate, title: 'Alternate title' }, { ...candidate, external_id: '99', title: '  FIXTURE ANIME  ' }])
    expect(result).toMatchObject({ imported: 1, skipped: 2, failed: 0 })
    expect(mocks.insert.mock.calls[0][0]).toHaveLength(1)
  })

  it('skips items already in the owner vault instead of overwriting them', async () => {
    const query = mocks.from()
    query.in.mockResolvedValue({ data: [{ title: candidate.title, type: 'Anime', external_source: 'anilist', external_id: '20' }], error: null })
    expect(await importAniListItems([candidate])).toMatchObject({ imported: 0, skipped: 1 })
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('ignores invalid entries and invalid serialized dates safely', async () => {
    const invalid = null as unknown as AniListImportCandidate
    await expect(importAniListItems([invalid, { ...candidate, started_at: '2024-04-31' }])).resolves.toMatchObject({ imported: 1, skipped: 1 })
    expect(mocks.insert.mock.calls[0][0][0].started_at).toBeNull()
  })

  it('blocks guests without contacting the database or providers', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    expect((await importAniListItems([candidate])).imported).toBe(0)
    expect((await fetchAniListLibraryByUsername('fixture-user')).error).toContain('sign in')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('preserves separate MAL source tags, URLs and notes', async () => {
    const result = await importMyAnimeListItems([{ title: 'MAL fixture', type: 'anime', external_source: 'myanimelist', external_id: '1', notes, progress: 3 }])
    expect(result.imported).toBe(1)
    expect(mocks.insert).toHaveBeenCalledWith([expect.objectContaining({ external_source: 'myanimelist', external_id: '1', external_url: 'https://myanimelist.net/anime/1', notes, progress: 3 })])
  })

  it('does not tag a generic CSV row as an AniList or MAL import', async () => {
    const result = await importCsvItems([{ title: 'CSV fixture', type: 'manga', notes, progress: 7 }])
    expect(result.imported).toBe(1)
    const row = mocks.insert.mock.calls[0][0][0] as Record<string, unknown>
    expect(row).toMatchObject({ notes, progress: 7, type: 'Manga', user_id: 'fixture-owner' })
    expect(row).not.toHaveProperty('external_source')
  })
})
