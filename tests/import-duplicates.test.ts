import { describe, expect, it } from 'vitest'
import { createImportDuplicateTracker } from '../lib/import-duplicates'

const work = { title: 'Same Title', type: 'Anime', external_source: 'anilist', external_id: '20' }
describe('import identity precedence', () => {
  it('uses canonical identity even after renaming, and permits another ID with the same title', () => {
    const tracker = createImportDuplicateTracker([work])
    expect(tracker.has({ ...work, title: 'Renamed' })).toBe(true)
    expect(tracker.has({ ...work, external_id: '21' })).toBe(false)
    tracker.add({ ...work, external_id: '21' })
    expect(tracker.has({ ...work, external_id: '21' })).toBe(true)
  })
  it('still uses normalized titles for manual and old records without identity', () => {
    expect(createImportDuplicateTracker([{ title: '  SAME   TITLE ', type: 'Anime' }]).has(work)).toBe(true)
    expect(createImportDuplicateTracker([work]).has({ title: 'Same Title', type: 'Anime' })).toBe(true)
  })
  it('distinguishes TMDB movie/TV and MAL anime/manga namespaces', () => {
    const tracker = createImportDuplicateTracker([
      { ...work, type: 'Movie', external_source: 'tmdb', external_id: '1' },
      { ...work, external_source: 'myanimelist', external_id: '1' },
    ])
    expect(tracker.has({ ...work, type: 'TV Series', external_source: 'tmdb', external_id: '1' })).toBe(false)
    expect(tracker.has({ ...work, type: 'Manga', external_source: 'myanimelist', external_id: '1' })).toBe(false)
    expect(tracker.has({ ...work, type: 'Movie', external_source: 'tmdb', external_id: 'tmdb:movie:1' })).toBe(true)
  })
})
