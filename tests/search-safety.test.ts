import { describe, expect, it } from 'vitest'
import { catalogSearchTypes, containsBlockedSearchTerm, isCatalogSearchType, mapCatalogSearchTypeToMediaType, mapMediaTypeToCatalogSearchType } from '../lib/search-safety'

describe('catalog term boundaries', () => {
  it.each(catalogSearchTypes)('round-trips the distinct %s media type', type => {
    expect(isCatalogSearchType(type)).toBe(true)
    expect(mapMediaTypeToCatalogSearchType(mapCatalogSearchTypeToMediaType(type))).toBe(type)
  })
  it.each(['My Hero Academia', 'Hero', 'Berserk', 'Re:Zero', 'Re', 'Zero', 'Essex', 'Adulthood'])('allows %s', (title) => {
    expect(containsBlockedSearchTerm(title)).toBeNull()
  })
  it.each(['hentai', 'new NSFW title', '(porn)', '18+', 'ｈｅｎｔａｉ'])('still blocks %s as a standalone term', (title) => {
    expect(containsBlockedSearchTerm(title)).toBeTruthy()
  })
})
