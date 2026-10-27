import nextEnv from '@next/env'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { searchCatalogPage } from '../../lib/catalog-search'

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
})
