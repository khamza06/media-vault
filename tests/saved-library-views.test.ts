import { describe, expect, it } from 'vitest'
import { defaultLibraryFilters, filterAndSortMediaItems, getLibraryFiltersFromSearchParams } from '../lib/library-filters'
import { getSavedLibraryViewHref, normalizeSavedView, parseSavedLibraryViews, pickPlanningItem } from '../lib/saved-library-views'
import { parseVaultPreferences } from '../lib/vault-preferences'
import { toMediaItem } from '../lib/media'

const input = { name: 'Completed favorites', pathname: '/shelves/anime', filters: { ...defaultLibraryFilters, status: 'Completed', rating: '9-plus' as const }, favoritesOnly: true }
describe('saved filter views', () => {
  it('round-trips canonical URL filters and favorites without storing arbitrary fields', () => {
    const view = normalizeSavedView({ ...input, notes: 'Do not copy', email: 'Do not copy' }, 'view-1')!
    const url = new URL(getSavedLibraryViewHref(view), 'https://media-vault.app')
    expect(url.pathname).toBe('/shelves/anime')
    expect(getLibraryFiltersFromSearchParams(url.searchParams)).toEqual(input.filters)
    expect(url.searchParams.get('favorites')).toBe('1')
    expect(view).not.toHaveProperty('notes')
    expect(view).not.toHaveProperty('email')
    expect(getSavedLibraryViewHref(normalizeSavedView({ ...input, pathname: '/', filters: defaultLibraryFilters, favoritesOnly: false }, 'view-2')!)).toBe('/')
  })
  it.each(['https://example.com', '//example.com', '/u/someone', '/login', '/shelves/not-a-shelf', '/shelves/anime?q=bad', '/\\evil'])('rejects non-Library/unsafe saved path %s', (pathname) => {
    expect(normalizeSavedView({ ...input, pathname }, 'view-1')).toBeNull()
  })
  it('bounds stored entries and rejects malformed, duplicate or oversized values', () => {
    expect(normalizeSavedView({ ...input, name: '' }, 'view-1')).toBeNull()
    expect(normalizeSavedView({ ...input, filters: { query: 'a'.repeat(301) } }, 'view-1')).toBeNull()
    expect(parseSavedLibraryViews([null, { ...input, id: 'view-1' }, { ...input, id: 'view-2' }])).toHaveLength(1)
    expect(parseSavedLibraryViews(Array.from({ length: 15 }, (_, index) => ({ ...input, id: `view-${index}`, name: `View ${index}` })))).toHaveLength(12)
  })
  it('accepts the previous density-only preference format without losing that choice', () => {
    expect(parseVaultPreferences('{"view":"compact"}')).toEqual({ view: 'compact', savedViews: [] })
    expect(parseVaultPreferences('broken json')).toEqual({ view: 'comfortable', savedViews: [] })
  })
})
describe('Planning selection', () => {
  const items = [
    toMediaItem({ id: 'a', title: 'Planning anime', type: 'Anime', status: 'Planning', notes: '  **Keep**\n' }),
    toMediaItem({ id: 'b', title: 'Planning manga', type: 'Manga', status: 'Planning' }),
    toMediaItem({ id: 'c', title: 'Completed anime', type: 'Anime', status: 'Completed' }),
  ]
  it('only picks Planning within the current filtered set, without changing any item', () => {
    const before = structuredClone(items)
    const filtered = filterAndSortMediaItems(items, { ...defaultLibraryFilters, type: 'Anime' })
    expect(pickPlanningItem(filtered, () => 0.9)?.id).toBe('a')
    expect(pickPlanningItem(items, () => 0)?.id).toBe('a')
    expect(pickPlanningItem(items, () => 0.999)?.id).toBe('b')
    expect(items).toEqual(before)
  })
  it('has a real empty state instead of choosing from a conflicting status filter', () => {
    expect(pickPlanningItem(filterAndSortMediaItems(items, { ...defaultLibraryFilters, status: 'Completed' }))).toBeNull()
  })
})
