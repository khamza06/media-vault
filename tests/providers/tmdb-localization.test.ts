import nextEnv from '@next/env'
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { getTmdbProviderDetails, searchCatalogPage } from '../../lib/catalog-search'
nextEnv.loadEnvConfig(process.cwd())

// Public TMDB reads only. No AniList/Shikimori requests, authentication or database writes.
describe('live TMDB localization', () => {
  it.each([[27205, 'movie', 'Начало'], [1396, 'tv', 'Во все тяжкие']] as const)('loads Russian title and synopsis for %s', async (id, type, title) => {
    const result = await getTmdbProviderDetails(id, type, 'ru')
    expect(result?.title).toBe(title)
    expect(result?.description).toMatch(/[А-Яа-яЁё]{4}/)
    expect(result?.genres.some(genre => /[А-Яа-яЁё]/.test(genre))).toBe(true)
  })
  it('keeps a nonempty English synopsis where Russian is absent', async () => {
    const result = await getTmdbProviderDetails(35848, 'movie', 'ru')
    expect(result?.title).toBe('Hukkle')
    expect(result?.description.length).toBeGreaterThan(40)
  })
  it('returns original title for Original preference', async () => {
    const result = await getTmdbProviderDetails(496243, 'movie', 'original')
    expect(result?.title).toBe('기생충')
    expect(result?.description).toMatch(/[가-힣]/)
  })
  it('searches Russian TMDB with an English interface and stable movie IDs', async () => {
    const result = await searchCatalogPage('Начало', 'movie', 'en', 'primary', 1, 'ru')
    expect(result.data.find(item => item.id === 'tmdb:movie:27205')?.title).toBe('Начало')
  })
})
