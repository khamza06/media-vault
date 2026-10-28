import { describe, expect, it } from 'vitest'
import { getRelatedDiscoverHref, normalizeAniListRelations } from '../lib/related-titles'

const edge = { relationType: 'SEQUEL', node: { id: 21, type: 'ANIME', isAdult: false, title: { english: 'A & B / 続編', romaji: 'Other' }, coverImage: { large: 'https://example.com/cover.jpg' } } }
describe('provider relations', () => {
  it('normalizes relation labels and canonical links without trusting provider URLs', () => {
    expect(normalizeAniListRelations({ edges: [edge] }, 20)).toEqual([{ id: 21, type: 'Anime', title: edge.node.title.english, relation: 'Sequel', coverUrl: 'https://example.com/cover.jpg', url: 'https://anilist.co/anime/21' }])
  })
  it('excludes adult/unknown-age, malformed, self, duplicate and unsupported-type nodes', () => {
    const badNodes = [null, { ...edge.node, id: 20 }, { ...edge.node, id: -1 }, { ...edge.node, id: '21' }, { ...edge.node, isAdult: true }, { ...edge.node, isAdult: null }, { ...edge.node, type: 'TV' }, { ...edge.node, title: {} }]
    expect(normalizeAniListRelations({ edges: [null, ...badNodes.map((node) => ({ ...edge, node })), edge, edge] }, 20)).toHaveLength(1)
    expect(normalizeAniListRelations({ edges: [{ ...edge, relationType: '__proto__' }] }, 20)).toEqual([])
  })
  it('bounds the graph and rejects unsafe cover schemes without breaking the title', () => {
    const edges = Array.from({ length: 40 }, (_, index) => ({ ...edge, node: { ...edge.node, id: index + 100, coverImage: { large: 'javascript:alert(1)' } } }))
    const titles = normalizeAniListRelations({ edges }, 20)
    expect(titles).toHaveLength(24)
    expect(titles.every((title) => title.coverUrl === null)).toBe(true)
  })
  it('keeps manga adaptations distinct and builds bounded encoded internal search URLs', () => {
    const title = normalizeAniListRelations({ edges: [{ ...edge, relationType: 'SOURCE', node: { ...edge.node, type: 'MANGA' } }] }, 20)[0]
    expect(title.relation).toBe('Source material')
    const url = new URL(getRelatedDiscoverHref(title)!, 'https://media-vault.app')
    expect(url.pathname).toBe('/discover')
    expect(url.searchParams.get('q')).toBe(title.title)
    expect(url.searchParams.get('type')).toBe('manga')
    expect(getRelatedDiscoverHref({ ...title, title: 'K' })).toBeNull()
    expect(new URL(getRelatedDiscoverHref({ ...title, title: 'x'.repeat(300) })!, url).searchParams.get('q')).toHaveLength(200)
  })
})
