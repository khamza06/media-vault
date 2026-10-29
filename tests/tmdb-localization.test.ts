import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
import { getTmdbCandidateById, getTmdbProviderDetails, searchCatalogPage, searchTmdbCandidatesByType } from '../lib/catalog-search'
import { publicProviderCacheTag } from '../lib/provider-cache'
import { localizeTmdbText } from '../lib/tmdb-localization'
import { resolveMetadataLanguage } from '../lib/metadata-language'

beforeEach(() => vi.stubEnv('NEXT_PUBLIC_TMDB_API_KEY', 'synthetic-key'))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
const payload = {
  id: 27205, title: 'Начало', original_title: 'Inception', original_language: 'en', overview: '',
  genres: [{ id: 28, name: 'боевик' }], release_date: '2010-07-16',
  translations: { translations: [{ iso_639_1: 'ru', data: { title: 'Начало', overview: '' } }, { iso_639_1: 'en', data: { title: 'Inception', overview: 'Nonempty English synopsis.' } }] },
}

describe('TMDB presentation localization', () => {
  it('never borrows an English synopsis from a different ID with the same title', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.pathname.includes('/genre/')) return Response.json({ genres: [] })
      return Response.json({ results: [url.searchParams.get('language') === 'ru-RU'
        ? { id: 2, title: 'Shared', overview: '' }
        : { id: 1, title: 'Shared', overview: 'Synopsis of a different work' }] })
    }))
    const result = await searchTmdbCandidatesByType(['Shared'], 'movie', { metadataLanguage: 'ru', includeDetails: false })
    expect(result[0]).toMatchObject({ id: 'tmdb:movie:2', description: '' })
  })
  it('reports rate limiting without retries or silently returning an empty successful search', async () => {
    const mock = vi.fn(async (input: RequestInfo | URL) => new URL(String(input)).pathname.includes('/genre/')
      ? Response.json({ genres: [] }) : Response.json({ status_message: 'Rate limited' }, { status: 429 }))
    vi.stubGlobal('fetch', mock)
    await expect(searchTmdbCandidatesByType(['Fixture'], 'movie', { metadataLanguage: 'ru', includeDetails: false })).rejects.toMatchObject({ provider: 'TMDB', status: 429 })
    expect(mock).toHaveBeenCalledTimes(2)
  })
  it('resolves title and synopsis independently without erasing data', () => {
    const before = structuredClone(payload)
    expect(localizeTmdbText(payload, 'ru')).toMatchObject({ title: 'Начало', overview: 'Nonempty English synopsis.' })
    expect(payload).toEqual(before)
    expect(localizeTmdbText({ ...payload, overview: 'Русское описание' }, 'ru').overview).toBe('Русское описание')
  })
  it('uses original title and original-language synopsis while retaining English fallback', () => {
    const original = { ...payload, original_title: '기생충', original_language: 'ko', translations: { translations: [...payload.translations.translations, { iso_639_1: 'ko', data: { title: '기생충', overview: '한국어 설명' } }] } }
    expect(localizeTmdbText(original, 'original')).toMatchObject({ title: '기생충', overview: '한국어 설명' })
    expect(localizeTmdbText(payload, 'original')).toMatchObject({ title: 'Inception', overview: 'Nonempty English synopsis.' })
  })
  it.each([null, undefined, {}, 'RU', 'ru-RU', '<script>'])('rejects an unsupported preference %j', value => {
    expect(resolveMetadataLanguage(value)).toBe('en')
  })
  it('loads RU details and English fallback in one public request, never sends private data', async () => {
    const mock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = new URL(String(input))
      expect(url.searchParams.get('language')).toBe('ru-RU')
      expect(url.searchParams.get('append_to_response')).toBe('translations')
      expect(JSON.stringify(options)).not.toMatch(/cookie|authorization|notes|user_id/i)
      return Response.json(payload)
    })
    vi.stubGlobal('fetch', mock)
    expect(await getTmdbProviderDetails(27205, 'movie', 'ru')).toMatchObject({ title: 'Начало', description: 'Nonempty English synopsis.', genres: ['боевик'] })
    expect(mock).toHaveBeenCalledOnce()
  })
  it.each(['movie', 'tv'] as const)('keeps the %s ID namespace and does not write an item', async type => {
    const mock = vi.fn(async () => Response.json({ ...payload, ...(type === 'tv' ? { id: 27205, name: 'Название' } : {}) }))
    vi.stubGlobal('fetch', mock)
    expect((await getTmdbCandidateById(27205, type, 'ru'))?.id).toBe(`tmdb:${type}:27205`)
    expect(mock.mock.calls.length).toBe(1)
  })
  it('separates language and movie/TV cache tags', () => {
    const tags = ['movie', 'tv'].flatMap(type => ['en', 'ru', 'original'].map(language => publicProviderCacheTag('tmdb', type, 1, language)))
    expect(new Set(tags).size).toBe(6)
  })
  it('uses one page-level English fallback by ID without per-card detail requests', async () => {
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.pathname.includes('/genre/')) return Response.json({ genres: [{ id: 28, name: 'боевик' }] })
      expect(url.pathname).toBe('/3/search/movie')
      const ru = url.searchParams.get('language') === 'ru-RU'
      return Response.json({ page: 1, total_pages: 1, results: [{ id: 27205, title: ru ? 'Начало' : 'Inception', overview: ru ? '' : 'English fallback', genre_ids: [28] }] })
    })
    vi.stubGlobal('fetch', mock)
    const result = await searchTmdbCandidatesByType(['inception'], 'movie', { metadataLanguage: 'ru', includeDetails: false })
    expect(result[0]).toMatchObject({ title: 'Начало', description: 'English fallback', id: 'tmdb:movie:27205' })
    expect(mock).toHaveBeenCalledTimes(3)
  })
  it.each([['ru', 'en', 'en-US'], ['en', 'ru', 'ru-RU']] as const)('keeps UI %s independent of metadata %s', async (locale, metadata, expected) => {
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      expect(url.searchParams.get('language')).toBe(expected)
      return Response.json(url.pathname.includes('/genre/') ? { genres: [] } : { results: [] })
    })
    vi.stubGlobal('fetch', mock)
    await searchCatalogPage('inception', 'movie', locale, 'primary', 1, metadata)
  })
  it('does not enrich from a mismatched exact ID', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...payload, id: 1 })))
    expect(await getTmdbProviderDetails(27205, 'movie', 'ru')).toBeNull()
  })
})
