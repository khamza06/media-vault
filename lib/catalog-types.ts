export type CatalogProvider = 'AniList' | 'Jikan' | 'Kitsu' | 'OpenLibrary' | 'Shikimori' | 'TMDB'

export type CatalogSearchSource = 'primary' | 'jikan' | 'kitsu' | 'shikimori'

export type CatalogSearchPage = {
  data: CatalogSearchCandidate[]
  hasMore: boolean
  page: number
  provider: CatalogProvider
}

export type CatalogSearchCandidate = {
  /** Localized display only; canonical genres remain in `genres` for existing save/import rules. */
  displayGenres?: string[]
  alternativeTitles?: string[]
  authors?: string[]
  identification?: { confidence: 'exact' | 'high' | 'possible' | 'low'; score: number; signals: string[] }
  description: string
  externalRatingLabel?: string | null
  externalRatingValue?: number | null
  genres: string
  id: string
  imageUrl: string
  isAdult?: boolean
  provider: CatalogProvider
  score: number
  status: string
  subtitle: string | null
  title: string
  totalProgress: string
  type: string
  year: string | null
}
