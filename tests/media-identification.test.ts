import { describe, expect, it } from 'vitest'
import { extractMediaPageMetadata } from '../lib/media-page-metadata'
import { identificationSearchTerms, normalizeMediaTitle, rankIdentifiedCandidates } from '../lib/title-identification'
import type { CatalogSearchCandidate } from '../lib/catalog-types'

const candidate: CatalogSearchCandidate = { id: 'anilist:1', title: 'Attack on Titan', alternativeTitles: ['進撃の巨人', 'Атака титанов'], type: 'Anime', provider: 'AniList', genres: '', imageUrl: '', description: '', status: 'Planning', totalProgress: '', subtitle: null, year: '2013', score: 0 }
describe('multilingual identification evidence', () => {
  it('keeps meaningful Japanese voicing and Indic marks while normalizing Latin accents', () => {
    expect(normalizeMediaTitle('が')).not.toBe(normalizeMediaTitle('か'))
    expect(normalizeMediaTitle('किताब')).toBe('किताब')
    expect(normalizeMediaTitle('Pokémon')).toBe('pokemon')
  })
  it.each(['Naruto', 'Наруто', '進撃の巨人', '나 혼자만 레벨업', '斗罗大陆', '鬥羅大陸'])('preserves native letters for %s', title => {
    expect(normalizeMediaTitle(title).replaceAll(' ', '').length).toBeGreaterThan(1)
    expect(identificationSearchTerms([title])[0]).toBe(title)
  })
  it('extracts multilingual OG, JSON-LD, alternate names, language, type, year and authors without fetching canonical URLs', () => {
    const data = extractMediaPageMetadata(`<html lang="zh-Hant"><head><meta content="鬥羅大陸 &amp; Soul Land" property="og:title"><link rel="canonical" href="http://127.0.0.1/private"><script type="application/ld+json">{"@graph":[{"@type":"Book","name":"鬥羅大陸","alternateName":["斗罗大陆","Soul Land"],"datePublished":"2008-01-01","author":{"name":"唐家三少"}}]}</script></head></html>`, 'https://books.example.org/work')
    expect(data).toMatchObject({ language: 'zh-Hant', type: 'Book', year: '2008', authors: ['唐家三少'] })
    expect(data.titles).toContain('斗罗大陆')
    expect(data.titles).toContain('鬥羅大陸 & Soul Land')
  })
  it('handles malformed JSON-LD and HTML entities without executing scripts', () => {
    expect(extractMediaPageMetadata('<title>ナルト &#x1F600;</title><script type="application/ld+json">not json</script>', 'https://example.org').titles).toEqual(['ナルト 😀'])
    expect(() => extractMediaPageMetadata('<meta name="robots" content="noindex">', 'https://example.org')).toThrow()
  })
  it('ranks native aliases with type/year evidence above same-title remakes and mismatched media', () => {
    const list = rankIdentifiedCandidates([candidate, { ...candidate, id: 'anilist:2', year: '2020' }, { ...candidate, id: 'tmdb:movie:1', type: 'Movie' }], { titles: ['進撃の巨人'], authors: [], type: 'Anime', year: '2013' })
    expect(list[0].id).toBe(candidate.id)
    expect(list[0].identification?.confidence).toBe('high')
    expect(list[0].identification?.signals).toEqual(['title-exact', 'type', 'year'])
  })
  it('keeps ambiguous same-title works separate and downgrades certainty', () => {
    const list = rankIdentifiedCandidates([candidate, { ...candidate, id: 'anilist:2' }], { titles: ['Attack on Titan'], authors: [], type: 'Anime', year: '2013' })
    expect(list).toHaveLength(2)
    expect(list.every(row => row.identification?.confidence === 'possible')).toBe(true)
    expect(rankIdentifiedCandidates([candidate], { titles: [], authors: [] }, true)[0].identification?.confidence).toBe('exact')
  })
  it('does not suggest unrelated provider results based on type alone', () => {
    expect(rankIdentifiedCandidates([candidate], { titles: ['Completely unrelated'], authors: [], type: 'Anime' })).toEqual([])
  })
  it('uses authors to distinguish book editions without treating transliteration as certain', () => {
    const book = { ...candidate, type: 'Book', title: 'Dune', authors: ['Frank Herbert'] }
    expect(rankIdentifiedCandidates([book, { ...book, id: 'openlibrary:/works/OL2W', authors: ['Someone else'] }], { titles: ['Dune'], authors: ['Frank Herbert'], type: 'Book' })[0].id).toBe(book.id)
    expect(identificationSearchTerms(['Наруто'])).toContain('Naruto')
  })
})
