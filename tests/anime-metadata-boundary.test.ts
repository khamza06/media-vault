import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { searchAniListCandidates, searchCatalogPage } from '../lib/catalog-search'
import { catalogCandidateToInput, getOwnedCatalogItem } from '../lib/catalog-view'
import type { CatalogSearchCandidate } from '../lib/catalog-types'

// Identifiers/names are test inputs, not downloaded provider payloads or a
// coverage survey. Descriptions and private fields are entirely synthetic.
const works = [
  { title: 'Naruto', native: 'ナルト', id: 20, mal: 20, type: 'anime', display: 'Anime', country: 'JP' },
  { title: "Angel's Egg", native: '天使のたまご', id: 885, mal: 885, type: 'anime', display: 'Anime', country: 'JP' },
  { title: 'One Piece', native: 'ONE PIECE', id: 30013, mal: 13, type: 'manga', display: 'Manga', country: 'JP' },
  { title: 'Spirit Circle', native: 'スピリットサークル', id: 68071, mal: 38071, type: 'manga', display: 'Manga', country: 'JP' },
  { title: 'Solo Leveling', native: '나 혼자만 레벨업', id: 105398, mal: 121496, type: 'manhwa', display: 'Manhwa', country: 'KR' },
  { title: 'Annarasumanara', native: '안나라수마나라', id: 60079, mal: 30079, type: 'manhwa', display: 'Manhwa', country: 'KR' },
  { title: 'Soul Land', native: '斗罗大陆', id: 85446, mal: 72303, type: 'manhua', display: 'Manhua', country: 'CN' },
  { title: 'Zi Bu Yu', native: '子不语', id: 50988, mal: 20988, type: 'manhua', display: 'Manhua', country: 'CN' },
] as const

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllGlobals())

describe('anime-family localization boundary while permissions are unresolved', () => {
  it.each(works)('keeps $title identity, native alternative and fields for every preference without extra enrichment', async work => {
    const media = {
      id: work.id, idMal: work.mal, countryOfOrigin: work.country,
      format: work.type === 'anime' ? 'TV' : 'MANGA',
      title: { english: work.title, native: work.native },
      description: 'Synthetic existing synopsis', coverImage: { large: 'https://example.com/cover.png' },
    }
    const original = structuredClone(media)
    const request = vi.fn<typeof fetch>(async () => Response.json({ data: { Page: { media: [media] } } }))
    vi.stubGlobal('fetch', request)
    const results: CatalogSearchCandidate[][] = []
    for (const language of ['en', 'ru', 'original'] as const) {
      const page = await searchCatalogPage(work.title, work.type, 'ru', 'primary', 1, language)
      expect(page.data).toHaveLength(1)
      expect(page.data[0]).toMatchObject({ id: `anilist:${work.id}`, title: work.title, type: work.display, description: media.description, imageUrl: media.coverImage.large })
      expect(page.data[0].alternativeTitles).toContain(work.native)
      results.push(page.data)
    }
    expect(results[1]).toEqual(results[0])
    expect(results[2]).toEqual(results[0])
    expect(media).toEqual(original)
    expect(request).toHaveBeenCalledTimes(3)
    expect(request.mock.calls.every(call => String(call[0]) === 'https://graphql.anilist.co')).toBe(true)
  })

  it.each([null, undefined])('does not infer a MAL mapping from an equal AniList number or title when idMal=%j', async idMal => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { Page: { media: [{ id: 20, idMal, title: { english: 'Naruto' } }] } } })))
    expect(await searchAniListCandidates(['Naruto'], 'ANIME', { malId: 20, metadataLanguage: 'ru' })).toEqual([])
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('accepts only the explicit MAL bridge, including different AniList/MAL IDs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { Page: { media: [
      { id: 13, idMal: 999, title: { english: 'One Piece' } },
      { id: 30013, idMal: 13, title: { english: 'One Piece' } },
    ] } } })))
    const matches = await searchAniListCandidates(['One Piece'], 'MANGA', { malId: 13 })
    expect(matches.map(match => match.id)).toEqual(['anilist:30013'])
  })

  it('keeps missing descriptions empty without guessing translations or fetching a second provider', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { Page: { media: [{ id: 86707, idMal: null, countryOfOrigin: 'CN', format: 'MANGA', title: { native: '妖神记' }, description: '' }] } } })))
    const page = await searchCatalogPage('妖神记', 'manhua', 'ru', 'primary', 1, 'ru')
    expect(page.data[0]).toMatchObject({ id: 'anilist:86707', title: '妖神记', description: '', type: 'Manhua' })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('reports upstream failure without trying a new Russian enrichment provider', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status: 503 })))
    await expect(searchCatalogPage('Fixture', 'anime', 'ru', 'primary', 1, 'ru')).rejects.toMatchObject({ provider: 'AniList', status: 503 })
    expect(fetch).toHaveBeenCalledOnce()
  })
})

describe('catalog duplicate recognition with localized or ambiguous titles', () => {
  const base: CatalogSearchCandidate = { id: 'anilist:20', provider: 'AniList', title: 'Shared title', alternativeTitles: ['Общее название'], type: 'Anime', description: '', genres: '', imageUrl: '', score: 1, status: 'Planning', subtitle: null, totalProgress: '', year: null }

  it.each(['Anime', 'Manga', 'Manhwa', 'Manhua'])('never equates %s works from different providers using an equal number or translated title', type => {
    const candidate = { ...base, type }
    for (const externalSource of ['jikan', 'kitsu', 'shikimori']) {
      expect(getOwnedCatalogItem(candidate, [{ id: 'other', type, title: candidate.title, externalSource, externalId: '20' }])).toBeNull()
    }
  })

  it.each(['Anime', 'Manga', 'Manhwa', 'Manhua'])('recognizes a renamed %s by exact provider identity without mutating personal fields', type => {
    const item = { id: 'mine', type, title: 'Моё название', externalSource: 'anilist', externalId: '20', notes: 'Private synthetic notes', rating: 8, progress: 5, cover: 'custom' }
    const original = structuredClone(item)
    expect(getOwnedCatalogItem({ ...base, type }, [item])).toBe(item)
    expect(item).toEqual(original)
    expect(catalogCandidateToInput({ ...base, type }, item.notes).notes).toBe(item.notes)
  })

  it('retains manual-record title fallback and does not infer identity from an alternate title', () => {
    const manual = { id: 'manual', type: 'Anime', title: base.title, externalSource: null, externalId: null }
    expect(getOwnedCatalogItem(base, [manual])).toBe(manual)
    expect(getOwnedCatalogItem(base, [{ ...manual, title: 'Общее название' }])).toBeNull()
  })
})
