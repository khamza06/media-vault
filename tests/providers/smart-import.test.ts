import env from '@next/env'
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { resolveQuickImport } from '../../lib/quick-import-resolver'
env.loadEnvConfig(process.cwd(), true)

describe('live multilingual identification (public catalogs only)', () => {
  it.each([
    ['English', 'Naruto', 'anime'], ['Russian', 'Наруто', 'anime'], ['Japanese', '進撃の巨人', 'anime'],
    ['Korean', '나 혼자만 레벨업', 'manhwa'], ['Simplified Chinese', '斗罗大陆', 'manhua'], ['Traditional Chinese', '鬥羅大陸', 'manhua'],
    ['Russian movie', 'Начало', 'movie'], ['English series', 'Breaking Bad', 'series'], ['English book', 'Dune', 'book'],
  ] as const)('identifies %s title %s without changing personal fields', async (_language, title, type) => {
    const result = await resolveQuickImport(title, 'en', type)
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(result.form.notes).toBe('')
    expect(result.requiresSelection).toBe(true)
    console.log(JSON.stringify({ language: _language, input: title, provider: result.candidates[0].provider, title: result.candidates[0].title, confidence: result.candidates[0].identification?.confidence, warnings: result.warnings }))
  })
  it.each(['https://anilist.co/anime/20/Naruto', 'https://myanimelist.net/anime/20/Naruto', 'https://www.themoviedb.org/movie/27205', 'https://www.imdb.com/title/tt1375666/', 'https://openlibrary.org/works/OL893415W'])('preserves exact provider identity for %s', async url => {
    const result = await resolveQuickImport(url, 'en')
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(result.candidates[0].identification?.confidence).toBe('exact')
  })
})
