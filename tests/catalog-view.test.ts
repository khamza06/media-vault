import { describe, expect, it } from 'vitest'

import type { CatalogSearchCandidate } from '../lib/catalog-types'
import { catalogCandidateToInput, getOwnedCatalogItem, mergeCatalogPages } from '../lib/catalog-view'

const candidate: CatalogSearchCandidate = { id: 'anilist:20', provider: 'AniList', title: 'Fixture', type: 'Anime', status: 'Planning', genres: 'Action', imageUrl: '', description: 'Provider synopsis, not personal notes', externalRatingLabel: 'AniList', externalRatingValue: 8.3, score: 1, subtitle: null, totalProgress: '12', year: '2002' }

describe('catalog UI data', () => {
  it('keeps provider synopsis separate from personal notes', () => {
    expect(catalogCandidateToInput(candidate).notes).toBe('')
    expect(catalogCandidateToInput(candidate, '  **Draft notes**\n').notes).toBe('  **Draft notes**\n')
    expect(catalogCandidateToInput(candidate).externalRatingValue).toBe('8.3')
  })
  it('does not merge different works solely because their titles match', () => {
    const remake = { ...candidate, id: 'anilist:99', year: '2020' }
    expect(mergeCatalogPages([candidate], [candidate, remake])).toHaveLength(2)
  })
  it('does not mutate either page while merging duplicate IDs', () => {
    const first = [candidate]
    const next = [{ ...candidate, id: 'anilist:21' }]
    expect(mergeCatalogPages(first, next)).toHaveLength(2)
    expect(first).toHaveLength(1)
    expect(next).toHaveLength(1)
  })
  it('finds a renamed owned item by provider ID', () => {
    expect(getOwnedCatalogItem(candidate, [{ id: 'owned', title: 'Renamed title', type: 'Anime', externalSource: 'anilist', externalId: '20' }])?.id).toBe('owned')
  })
  it('does not mark a same-title remake with a different known provider ID as owned', () => {
    expect(getOwnedCatalogItem(candidate, [{ id: 'remake', title: candidate.title, type: 'Anime', externalSource: 'anilist', externalId: '99' }])).toBeNull()
  })
  it('prefers an exact provider ID over an earlier manual title match', () => {
    const manual = { id: 'manual', title: candidate.title, type: 'Anime', externalSource: null, externalId: null }
    const exact = { ...manual, id: 'exact', title: 'Renamed', externalSource: 'anilist', externalId: candidate.id }
    expect(getOwnedCatalogItem(candidate, [manual, exact])?.id).toBe('exact')
  })
  it('keeps manga-family title checks compatible while not mixing anime and manga', () => {
    const owned = [{ id: 'owned', title: ' Fixture ', type: 'Manhwa', externalSource: null, externalId: null }]
    expect(getOwnedCatalogItem({ ...candidate, type: 'Manga' }, owned)?.id).toBe('owned')
    expect(getOwnedCatalogItem(candidate, owned)).toBeNull()
  })
})
