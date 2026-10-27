import { describe, expect, it } from 'vitest'

import { normalizeAniListAverageScore, normalizeAniListPersonalScore, normalizeImportDate, normalizeTenPointScore, toCompleteAniListDate } from '../lib/anilist-values'
import { parseProviderMediaId } from '../lib/provider-ids'

describe('AniList scores', () => {
  it.each([[83, 8.3], [8, 0.8], [10, 1], [100, 10]])('converts averageScore=%s from 100 points to %s', (input, result) => {
    expect(normalizeAniListAverageScore(input)).toBe(result)
  })
  it.each([null, undefined, 0, -1, 101, Number.NaN, Number.POSITIVE_INFINITY, '83'])('rejects invalid averageScore=%s', (value) => {
    expect(normalizeAniListAverageScore(value)).toBeNull()
  })
  it('does not divide an already normalized preview score again', () => {
    expect(normalizeTenPointScore(8.3)).toBe(8.3)
    expect(normalizeTenPointScore(0.8)).toBe(0.8)
    expect(normalizeTenPointScore(83)).toBeNull()
  })
  it.each([[7.5, 8], [6.4, 6], [10, 10], [0.5, 1], [0, null], [100, null]])('rounds explicitly ten-point personal score %s to %s', (value, result) => {
    expect(normalizeAniListPersonalScore(value)).toBe(result)
  })
})

describe('AniList dates', () => {
  it('preserves a complete leap-day date', () => {
    expect(toCompleteAniListDate({ year: 2024, month: 2, day: 29 })).toBe('2024-02-29')
  })
  it.each([null, {}, { year: 2024 }, { year: 2024, month: 2, day: null }, { year: 2023, month: 2, day: 29 }, { year: 0, month: 1, day: 1 }, { year: 2024, month: 13, day: 1 }])('does not invent or roll over incomplete/invalid date %j', (value) => {
    expect(toCompleteAniListDate(value)).toBeNull()
  })
  it('revalidates serialized candidate dates on the server', () => {
    expect(normalizeImportDate('2024-04-31')).toBeNull()
    expect(normalizeImportDate('2024-04-30')).toBe('2024-04-30')
    expect(normalizeImportDate('not-a-date')).toBeNull()
  })
})

describe('provider identity', () => {
  it('accepts plain IDs and matching namespaced IDs', () => {
    expect(parseProviderMediaId('27205', 'tmdb', 'movie')).toBe(27205)
    expect(parseProviderMediaId('tmdb:movie:27205', 'tmdb', 'movie')).toBe(27205)
    expect(parseProviderMediaId('anilist:anime:20', 'anilist', 'anime')).toBe(20)
  })
  it.each(['tmdb:tv:20', 'anilist:movie:20', '-1', '1.5', '1e3', '0', '', '9007199254740992'])('rejects invalid or wrong-type ID %s', (value) => {
    expect(parseProviderMediaId(value, 'tmdb', 'movie')).toBeNull()
  })
})
