import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn(), findAniListImportMetadata: vi.fn(), getTmdbCandidateById: vi.fn(), searchTmdbCandidatesByType: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from: mocks.from }) }))
vi.mock('../lib/anilist-import-enrichment', () => mocks)
vi.mock('../lib/catalog-search', () => ({ ...mocks, isCatalogSearchProviderError: () => false }))
vi.mock('next/cache', () => mocks)
import { refreshCurrentUserItemMetadata } from '../app/actions/metadata'

const ownedItem = { id: 'fixture-item', title: 'Local title', type: 'Anime', external_source: 'anilist', external_id: '20', image_url: 'https://example.com/my-cover.png', genres: ['Drama'], total_progress: 12, notes: '  **My notes**\n', progress: 5, rating: 9, status: 'Watching', favorite: true }
const metadata = { externalRatingLabel: 'AniList', externalRatingValue: 8.3, imageUrl: 'https://example.com/provider-cover.png', genres: ['Action'], totalProgress: 24 }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getCurrentUser.mockResolvedValue({ id: 'fixture-owner', accessToken: 'test-access-token' })
  const query = { select: vi.fn(), eq: mocks.eq, order: vi.fn(), update: mocks.update, maybeSingle: vi.fn() }
  query.select.mockReturnValue(query)
  mocks.eq.mockReturnValue(query)
  mocks.update.mockReturnValue(query)
  query.order.mockResolvedValue({ data: [ownedItem], error: null })
  query.maybeSingle.mockResolvedValue({ data: { id: ownedItem.id }, error: null })
  mocks.from.mockReturnValue(query)
  mocks.findAniListImportMetadata.mockResolvedValue(metadata)
})

describe('metadata refresh writes', () => {
  it('uses stored identity, scopes every write to the owner and only updates metadata', async () => {
    const result = await refreshCurrentUserItemMetadata()
    expect(result).toMatchObject({ checked: 1, updated: 1, ratingsAdded: 1, coversAdded: 0, totalsUpdated: 0 })
    expect(mocks.findAniListImportMetadata).toHaveBeenCalledWith(ownedItem.title, 'Anime', { anilistId: '20', malId: null, strictTitleMatch: true })
    expect(mocks.eq).toHaveBeenCalledWith('id', ownedItem.id)
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'fixture-owner')
    const row = mocks.update.mock.calls[0][0] as Record<string, unknown>
    expect(row).toMatchObject({ external_rating_label: 'AniList', external_rating_value: 8.3, genres: expect.arrayContaining(['Drama', 'Action']) })
    for (const field of ['notes', 'progress', 'status', 'rating', 'favorite', 'image_url', 'total_progress']) {
      expect(row).not.toHaveProperty(field)
    }
  })

  it('uses saved TMDB IDs instead of title search', async () => {
    const query = mocks.from()
    query.order.mockResolvedValue({ data: [{ ...ownedItem, type: 'Movie', external_source: 'tmdb', external_id: 'tmdb:movie:27205' }], error: null })
    mocks.getTmdbCandidateById.mockResolvedValue({ title: 'Inception', genres: '', externalRatingValue: 8.3, imageUrl: '', totalProgress: '1' })
    await refreshCurrentUserItemMetadata()
    expect(mocks.getTmdbCandidateById).toHaveBeenCalledWith(27205, 'movie')
    expect(mocks.searchTmdbCandidatesByType).not.toHaveBeenCalled()
  })

  it('does not update when the provider cannot identify an item', async () => {
    mocks.findAniListImportMetadata.mockResolvedValue(null)
    expect(await refreshCurrentUserItemMetadata()).toMatchObject({ skipped: 1, updated: 0 })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('uses a selected Jikan MAL ID without treating its cleanup source as a MAL import', async () => {
    const query = mocks.from()
    query.order.mockResolvedValue({ data: [{ ...ownedItem, external_source: 'jikan', external_id: 'jikan:anime:1' }], error: null })
    await refreshCurrentUserItemMetadata()
    expect(mocks.findAniListImportMetadata).toHaveBeenCalledWith(ownedItem.title, 'Anime', { anilistId: null, malId: '1', strictTitleMatch: true })
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('external_source')
  })

  it('does not access items for guests', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    expect(await refreshCurrentUserItemMetadata()).toMatchObject({ checked: 0, updated: 0 })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
