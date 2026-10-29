import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ searchAniListCandidates: vi.fn(), searchJikanCandidates: vi.fn(), searchKitsuCandidates: vi.fn(), searchOpenLibraryCandidates: vi.fn(), searchShikimoriCandidates: vi.fn(), searchTmdbCandidatesByType: vi.fn(), fetchPublicPage: vi.fn(), resolveExactProviderUrl: vi.fn() }))
vi.mock('../lib/catalog-search', () => mocks)
vi.mock('../lib/safe-page-fetch', async importOriginal => ({ ...await importOriginal<typeof import('../lib/safe-page-fetch')>(), fetchPublicPage: mocks.fetchPublicPage }))
vi.mock('../lib/quick-import-exact', async importOriginal => ({ ...await importOriginal<typeof import('../lib/quick-import-exact')>(), resolveExactProviderUrl: mocks.resolveExactProviderUrl }))
import { resolveQuickImport } from '../lib/quick-import-resolver'
import { PageFetchError } from '../lib/safe-page-fetch'
import type { CatalogSearchCandidate } from '../lib/catalog-types'
const candidate: CatalogSearchCandidate = { id: 'anilist:20', title: 'Naruto', alternativeTitles: ['ナルト', 'Наруто'], type: 'Anime', status: 'Planning', imageUrl: '', genres: '', description: 'Provider synopsis must never become private notes', provider: 'AniList', score: 1, year: '2002', subtitle: 'TV', totalProgress: '220' }
beforeEach(() => {
  vi.resetAllMocks()
  for (const key of ['searchAniListCandidates', 'searchJikanCandidates', 'searchKitsuCandidates', 'searchOpenLibraryCandidates', 'searchShikimoriCandidates', 'searchTmdbCandidatesByType'] as const) mocks[key].mockResolvedValue([])
})
afterEach(() => vi.unstubAllGlobals())
describe('smart Quick Import orchestration', () => {
  it.each(['Naruto', 'Наруто', 'ナルト', '나 혼자만 레벨업', '斗罗大陆', '鬥羅大陸', 'Re:Zero'])('searches title %s without fetching an arbitrary page or changing notes', async title => {
    mocks.searchAniListCandidates.mockResolvedValue([{ ...candidate, alternativeTitles: [title] }])
    const result = await resolveQuickImport(title, 'en', 'anime')
    expect(mocks.fetchPublicPage).not.toHaveBeenCalled()
    expect(mocks.searchAniListCandidates).toHaveBeenCalledWith([title], 'ANIME', expect.objectContaining({ includeDetails: false }))
    expect(result.form.notes).toBe('')
    expect(result.requiresSelection).toBe(true)
    expect(result.candidates[0].id).toBe('anilist:20')
  })
  it('extracts foreign titles/year/type from an unfamiliar page, not just its slug', async () => {
    mocks.fetchPublicPage.mockResolvedValue({ html: '<meta property="og:title" content="ナルト"><script type="application/ld+json">{"@type":"Anime","name":"ナルト","datePublished":"2002"}</script>', url: 'https://unknown.example.org/12345' })
    mocks.searchAniListCandidates.mockResolvedValue([candidate])
    const result = await resolveQuickImport('https://unknown.example.org/12345', 'en')
    expect(result.candidates[0].identification?.confidence).toBe('high')
    expect(result.metadata).toMatchObject({ type: 'Anime', year: '2002' })
    expect(result.form.title).toBe('ナルト') // Draft metadata is separate from the selected canonical work.
  })
  it('uses exact provider IDs without scraping the provider page or searching by a misleading slug', async () => {
    mocks.resolveExactProviderUrl.mockResolvedValue([candidate])
    const result = await resolveQuickImport('https://anilist.co/anime/20/wrong-slug', 'en')
    expect(result.candidates[0].identification?.confidence).toBe('exact')
    expect(mocks.fetchPublicPage).not.toHaveBeenCalled()
    expect(mocks.searchAniListCandidates).not.toHaveBeenCalled()
  })
  it('never substitutes a failed exact-ID lookup with an unrelated title', async () => {
    mocks.resolveExactProviderUrl.mockRejectedValue(new Error('Provider offline'))
    expect(await resolveQuickImport('https://myanimelist.net/anime/20/Wrong_title', 'en')).toMatchObject({ candidates: [], warnings: ['exact-unavailable'] })
    expect(mocks.searchAniListCandidates).not.toHaveBeenCalled()
  })
  it.each(['robots-denied', 'metadata-unavailable'] as const)('provides a title/manual fallback for %s', async code => {
    mocks.fetchPublicPage.mockRejectedValue(new PageFetchError(code))
    const result = await resolveQuickImport('https://unknown.example.org/manga/some-title', 'ru')
    expect(result.warnings).toContain(code)
    expect(result.requiresSelection).toBe(true)
    expect(result.form.notes).toBe('')
  })
  it('blocks unsafe DNS/URL results instead of treating them as searchable page metadata', async () => {
    mocks.fetchPublicPage.mockRejectedValue(new PageFetchError('unsafe-url'))
    await expect(resolveQuickImport('https://attacker.example.org/book', 'en')).rejects.toThrow('unsafe-url')
    expect(mocks.searchAniListCandidates).not.toHaveBeenCalled()
  })
  it('reports provider failure and preserves available matches from other providers', async () => {
    mocks.searchAniListCandidates.mockRejectedValue(new Error('timeout'))
    mocks.searchShikimoriCandidates.mockResolvedValue([{ ...candidate, provider: 'Shikimori', id: 'shikimori:animes:20' }])
    const result = await resolveQuickImport('Наруто', 'ru', 'anime')
    expect(result.warnings).toContain('provider-unavailable')
    expect(result.candidates[0].id).toBe('shikimori:animes:20')
  })
  it('consumes provider rejections even when the identification deadline has already expired', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(AbortSignal.abort())
    mocks.searchAniListCandidates.mockRejectedValue(new Error('Aborted provider'))
    const result = await resolveQuickImport('Naruto', 'en', 'anime')
    expect(result.candidates).toEqual([])
    expect(result.warnings).toContain('provider-unavailable')
  })
  it.each(['movie', 'series', 'book', 'manhwa', 'manhua'] as const)('routes %s to appropriate catalog APIs', async type => {
    await resolveQuickImport('Fixture work', 'en', type)
    if (type === 'book') expect(mocks.searchOpenLibraryCandidates).toHaveBeenCalled()
    if (type === 'movie' || type === 'series') expect(mocks.searchTmdbCandidatesByType).toHaveBeenCalledWith(['Fixture work'], type === 'series' ? 'tv' : 'movie', expect.anything())
    if (type === 'manhwa' || type === 'manhua') expect(mocks.searchAniListCandidates).toHaveBeenCalledWith(['Fixture work'], 'MANGA', expect.objectContaining({ countryOfOrigin: type === 'manhwa' ? 'KR' : 'CN' }))
  })
})
