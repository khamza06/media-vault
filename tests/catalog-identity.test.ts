import { describe, expect, it } from 'vitest'
import { getCatalogIdentity } from '../lib/catalog-identity'
import { normalizeMediaItemInput, type MediaItemInput } from '../lib/media'

export const form: MediaItemInput = { title: 'Fixture', type: 'Anime', status: 'Planning', progress: '', totalProgress: '', rating: '', externalRatingValue: '8.3', externalRatingLabel: 'AniList', favorite: false, genres: '', imageUrl: '', startedAt: '', completedAt: '', notes: '  **Notes**  \n\n- first\n' }

describe('catalog identity', () => {
  it.each([
    ['anilist:20', 'Anime', 'anilist', '20'],
    ['anilist:30013', 'Manhwa', 'anilist', '30013'],
    ['jikan:anime:1', 'Anime', 'jikan', '1'],
    ['kitsu:manga:2', 'Manga', 'kitsu', '2'],
    ['shikimori:animes:3', 'Anime', 'shikimori', '3'],
    ['tmdb:movie:27205', 'Movie', 'tmdb', '27205'],
    ['tmdb:tv:1396', 'TV Series', 'tmdb', '1396'],
    ['openlibrary:/works/OL123W', 'Book', 'openlibrary', '/works/OL123W'],
  ])('preserves %s with the correct provider namespace', (value, type, source, id) => {
    expect(getCatalogIdentity(value, type)).toEqual({ source, id })
  })
  it.each([
    [null, 'Anime'], ['https://untrusted.example/20', 'Anime'], ['anilist:0', 'Anime'],
    ['anilist:2147483648', 'Anime'], ['jikan:manga:1', 'Anime'], ['tmdb:tv:1', 'Movie'],
    ['anilist:20', 'Book'], ['myanimelist:1', 'Anime'], ['openlibrary:/works/../OL1W', 'Book'],
  ])('rejects invalid or mismatched identity %s', (value, type) => {
    expect(getCatalogIdentity(value, type)).toBeNull()
  })
  it('preserves Markdown whitespace through the full edit/create normalizer', () => {
    expect(normalizeMediaItemInput(form).data?.notes).toBe(form.notes)
    expect(normalizeMediaItemInput({ ...form, notes: '  \n' }).data?.notes).toBe('  \n')
  })
  it('handles malformed action payloads without throwing', () => {
    expect(normalizeMediaItemInput(null as unknown as MediaItemInput).error).toBeTruthy()
    expect(normalizeMediaItemInput({ ...form, notes: null } as unknown as MediaItemInput).error).toBeTruthy()
  })
})
