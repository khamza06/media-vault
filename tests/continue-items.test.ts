import { describe, expect, it } from 'vitest'

import { getContinueItems, isInProgressItem } from '../lib/continue-items'
import { defaultLibraryFilters, filterAndSortMediaItems } from '../lib/library-filters'
import { toMediaItem, type MediaItem } from '../lib/media'

function item(id: string, overrides: Partial<MediaItem> = {}): MediaItem {
  return { ...toMediaItem({ id, title: id, type: 'Anime', status: 'Watching' }), ...overrides }
}

describe('Continue shelf selection', () => {
  it('excludes exhausted totals without changing a user-chosen status', () => {
    const exhausted = item('done', { progress: 12, totalProgress: 12, status: 'Watching' })
    expect(getContinueItems([exhausted])).toEqual([])
    expect(exhausted.status).toBe('Watching')
  })
  it('offers a true recent-update sort while retaining an explicit title sort', () => {
    const old = item('A', { createdAt: '2020-01-01', lastProgressAt: '2026-10-29' })
    const newest = item('B', { createdAt: '2026-10-28' })
    expect(filterAndSortMediaItems([newest, old], defaultLibraryFilters).map(row => row.id)).toEqual(['A', 'B'])
    expect(filterAndSortMediaItems([newest, old], { ...defaultLibraryFilters, sort: 'created-desc' }).map(row => row.id)).toEqual(['B', 'A'])
    expect(filterAndSortMediaItems([newest, old], { ...defaultLibraryFilters, sort: 'title-desc' }).map(row => row.id)).toEqual(['B', 'A'])
  })
  it('only includes watching, reading and re-watching statuses', () => {
    const items = ['Planning', 'Watching', 'Reading', 'Completed', 'Dropped', 'Re-Watching']
      .map((status) => item(status, { status }))
    expect(getContinueItems(items).map((entry) => entry.status).sort())
      .toEqual(['Re-Watching', 'Reading', 'Watching'])
    expect(isInProgressItem({ status: ' reading ' })).toBe(true)
  })

  it('uses the last progress update before generic activity or creation dates', () => {
    const items = [
      item('old', { lastProgressAt: '2026-01-01', lastActivityAt: '2026-10-20' }),
      item('recent', { lastProgressAt: '2026-10-01', createdAt: '2020-01-01' }),
    ]
    expect(getContinueItems(items).map((entry) => entry.id)).toEqual(['recent', 'old'])
  })

  it('falls back safely for missing or malformed dates and breaks ties consistently', () => {
    const items = [
      item('z', { lastProgressAt: 'invalid' }),
      item('created', { lastProgressAt: 'invalid', createdAt: '2026-01-01' }),
      item('activity', { lastActivityAt: '2026-02-01' }),
      item('a'),
    ]
    expect(getContinueItems(items).map((entry) => entry.id))
      .toEqual(['activity', 'created', 'a', 'z'])
  })

  it('limits the shelf to six items without changing the input array or notes', () => {
    const items = Array.from({ length: 9 }, (_, index) => item(String(9 - index), {
      notes: '  **Private notes**\n\n- chapter 1\n',
    }))
    const before = structuredClone(items)
    expect(getContinueItems(items)).toHaveLength(6)
    expect(items).toEqual(before)
  })

  it('respects the same search/type/status filters as the rest of the Library', () => {
    const items = [item('anime'), item('manga', { type: 'Manga', status: 'Reading' })]
    const filtered = filterAndSortMediaItems(items, { ...defaultLibraryFilters, query: 'manga' })
    expect(getContinueItems(filtered).map((entry) => entry.id)).toEqual(['manga'])
    expect(getContinueItems(filterAndSortMediaItems(items, {
      ...defaultLibraryFilters, type: 'Anime',
    })).map((entry) => entry.id)).toEqual(['anime'])
    expect(getContinueItems(filterAndSortMediaItems(items, {
      ...defaultLibraryFilters, status: 'Completed',
    }))).toEqual([])
  })

  it('keeps unknown totals and zero progress without inventing completion or activity', () => {
    const saved = item('newly-started', { progress: 0, totalProgress: null })
    expect(getContinueItems([saved])).toEqual([saved])
    expect(getContinueItems([])).toEqual([])
  })
})
