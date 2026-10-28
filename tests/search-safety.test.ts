import { describe, expect, it } from 'vitest'
import { containsBlockedSearchTerm } from '../lib/search-safety'

describe('catalog term boundaries', () => {
  it.each(['My Hero Academia', 'Hero', 'Berserk', 'Re:Zero', 'Re', 'Zero', 'Essex', 'Adulthood'])('allows %s', (title) => {
    expect(containsBlockedSearchTerm(title)).toBeNull()
  })
  it.each(['hentai', 'new NSFW title', '(porn)', '18+', 'ｈｅｎｔａｉ'])('still blocks %s as a standalone term', (title) => {
    expect(containsBlockedSearchTerm(title)).toBeTruthy()
  })
})
