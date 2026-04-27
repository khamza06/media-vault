export type CatalogProvider = 'AniList' | 'Jikan' | 'Kitsu' | 'OpenLibrary' | 'Shikimori' | 'TMDB'

export type CatalogSearchCandidate = {
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
