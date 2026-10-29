import type { CatalogSearchPage, CatalogSearchSource } from './catalog-types'
import type { Locale } from './i18n'
import type { CatalogSearchType } from './search-safety'

export type CatalogPageRequest = {
  query: string
  type: CatalogSearchType
  source: CatalogSearchSource
  metadataLanguage?: import('./metadata-language').MetadataLanguage
  locale: Locale
  page: number
}

export async function fetchCatalogPage(input: CatalogPageRequest, signal: AbortSignal): Promise<CatalogSearchPage> {
  const response = await fetch('/api/catalog-search', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, mode: 'full' }),
  })
  const payload = await response.json() as CatalogSearchPage & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Search is unavailable. Try again or choose another source.')
  return payload
}
