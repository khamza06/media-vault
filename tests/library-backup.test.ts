import { describe, expect, it } from 'vitest'

import { createBackupPayload, mediaItemToInput, recordToVaultExportItem, serializeVaultExportCsv } from '../lib/backup'
import { defaultLibraryFilters, filterAndSortMediaItems, getLibraryFiltersFromSearchParams, writeLibraryFiltersToSearchParams } from '../lib/library-filters'
import { formatProgressValue, toMediaItem } from '../lib/media'

const notes = '  # My notes\n\n> Quoted **text**, "unchanged"\n\n- First\n- Second  \n'
const records = [
  { id: 'fixture-anime', title: 'Example Anime', type: 'Anime', status: 'Completed', rating: 9, progress: 12, total_progress: 12, notes, image_url: 'https://example.com/cover.png', external_source: 'anilist', external_id: '1' },
  { id: 'fixture-manga', title: 'Example Manga', type: 'Manga', status: 'Reading', rating: null, progress: 4, total_progress: 20, notes: '' },
]
const items = records.map(toMediaItem)

describe('library filter regression', () => {
  it('round-trips the combined filter state through the URL', () => {
    const filters = { ...defaultLibraryFilters, type: 'Anime', status: 'Completed', query: 'Example', rating: '9-plus' as const, cover: 'has-cover' as const, sort: 'title-asc' as const, source: 'anilist' as const }
    const params = writeLibraryFiltersToSearchParams(new URLSearchParams('view=grid'), filters)
    expect(getLibraryFiltersFromSearchParams(params)).toEqual(filters)
    expect(params.get('view')).toBe('grid')
    expect(filterAndSortMediaItems(items, filters).map((item) => item.id)).toEqual(['fixture-anime'])
  })

  it('removes defaults without removing unrelated query parameters', () => {
    const params = writeLibraryFiltersToSearchParams(new URLSearchParams('view=grid&q=old&type=Anime&status=Completed&sort=title-asc'), defaultLibraryFilters)
    expect(params.toString()).toBe('view=grid')
  })

  it('rejects unsupported filter values', () => {
    expect(getLibraryFiltersFromSearchParams(new URLSearchParams('status=invalid&type=invalid&sort=invalid&rating=invalid&cover=invalid&source=invalid'))).toEqual(defaultLibraryFilters)
  })

  it('sorts a copy without mutating source data or Markdown', () => {
    const before = structuredClone(items)
    filterAndSortMediaItems(items, { ...defaultLibraryFilters, sort: 'title-desc' })
    expect(items).toEqual(before)
    expect(items[0].notes).toBe(notes)
  })

  it.each(['Manga', 'Manhwa', 'Manhua'])('uses chapter labels for %s', (type) => {
    expect(formatProgressValue({ type, progress: 4, totalProgress: 20 })).toBe('ch. 4 / 20')
  })

  it('keeps episode labels for anime', () => {
    expect(formatProgressValue({ type: 'Anime', progress: 4, totalProgress: 12 })).toBe('ep. 4 / 12')
  })
})

describe('backup regression', () => {
  it('preserves Markdown and progress through JSON export and form mapping', () => {
    const payload = createBackupPayload(items)
    const restored = JSON.parse(JSON.stringify(payload)) as typeof payload
    expect(restored.version).toBe(1)
    expect(restored.items[0].notes).toBe(notes)
    expect(restored.items[0].progress).toBe(12)
    expect(mediaItemToInput(restored.items[0]).notes).toBe(notes)
    expect(mediaItemToInput(restored.items[0]).progress).toBe('12')
  })

  it('preserves source identifiers when exporting database records', () => {
    const item = recordToVaultExportItem(records[0])
    expect(item.external_source).toBe('anilist')
    expect(item.external_id).toBe('1')
  })

  it('escapes quotes and multiline Markdown in CSV export', () => {
    expect(serializeVaultExportCsv(items)).toContain(`"${notes.replaceAll('"', '""')}"`)
  })
})
