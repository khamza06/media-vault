import nextEnv from '@next/env'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { searchCatalogPage, getTmdbProviderDetails } from '../../lib/catalog-search'
import { getAniListProviderDetails } from '../../lib/anilist-import-enrichment'

// Explicit opt-in suite: public provider reads only, never auth or database writes.
nextEnv.loadEnvConfig(process.cwd(), true)

describe('live public catalog providers', () => {
  it.each([
    ['anime', 'naruto'], ['manga', 'berserk'], ['movie', 'inception'], ['series', 'breaking bad'],
  ] as const)('%s search returns real results for %s', async (type, query) => {
    const result = await searchCatalogPage(query, type, 'en')
    expect(result.data.length).toBeGreaterThan(0)
    expect(result.data.length).toBeLessThanOrEqual(20)
    expect(result.data.some((item) => typeof item.externalRatingValue === 'number' && item.externalRatingValue > 0 && item.externalRatingValue <= 10)).toBe(true)
  })

  it.each([[20, 'Anime'], [30002, 'Manga']] as const)('loads linked AniList metadata for %s', async (id, type) => {
    const details = await getAniListProviderDetails(id, type, false)
    expect(details?.provider).toBe('AniList')
    expect(details?.description.length).toBeGreaterThan(0)
    expect(details?.url).toBe(`https://anilist.co/${type === 'Anime' ? 'anime' : 'manga'}/${id}`)
  })
  it.each([[27205, 'movie'], [1396, 'tv']] as const)('loads linked TMDB metadata for %s', async (id, type) => {
    const details = await getTmdbProviderDetails(id, type)
    expect(details?.provider).toBe('TMDB')
    expect(details?.description.length).toBeGreaterThan(0)
    expect(details?.year).toBeTruthy()
  })
})
