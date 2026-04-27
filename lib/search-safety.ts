export const catalogSearchTypes = ['anime', 'manga', 'movie', 'series', 'book'] as const

export type CatalogSearchType = (typeof catalogSearchTypes)[number]

const blockedTerms = [
  '18+',
  'adult',
  'ecchi',
  'ero',
  'fetish',
  'harem hentai',
  'hentai',
  'incest',
  'loli',
  'nsfw',
  'porn',
  'pornhub',
  'rule34',
  'sex',
  'xnxx',
  'xvideos',
  'yaoi hentai',
  'yuri hentai',
] as const

export function isCatalogSearchType(value: string | null | undefined): value is CatalogSearchType {
  return catalogSearchTypes.includes(value as CatalogSearchType)
}

export function containsBlockedSearchTerm(query: string) {
  const normalized = query.toLowerCase()

  return blockedTerms.find((term) => normalized.includes(term)) ?? null
}

export function getBlockedSearchMessage() {
  return 'Inappropriate search terms. Please try a different title.'
}

export function mapCatalogSearchTypeToMediaType(type: CatalogSearchType) {
  switch (type) {
    case 'anime':
      return 'Anime'
    case 'manga':
      return 'Manga'
    case 'movie':
      return 'Movie'
    case 'series':
      return 'TV Series'
    case 'book':
      return 'Book'
    default:
      return 'Anime'
  }
}

export function mapMediaTypeToCatalogSearchType(type: string): CatalogSearchType | '' {
  switch (type) {
    case 'Anime':
      return 'anime'
    case 'Manga':
    case 'Manhwa':
    case 'Manhua':
      return 'manga'
    case 'Movie':
      return 'movie'
    case 'TV Series':
      return 'series'
    case 'Book':
      return 'book'
    default:
      return ''
  }
}
