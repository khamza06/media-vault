import { getCurrentUser } from '../../../lib/auth/dal'
import {
  isCatalogSearchProviderError,
  searchCatalogByMediaType,
} from '../../../lib/catalog-search'
import { getRequestLocale } from '../../../lib/i18n-server'
import { resolveLocale } from '../../../lib/i18n'
import { buildQuickImportSearchTerms } from '../../../lib/quick-import-parser'
import {
  containsBlockedSearchTerm,
  getBlockedSearchMessage,
  isCatalogSearchType,
  type CatalogSearchType,
} from '../../../lib/search-safety'

function getCatalogProviderPlan(type: CatalogSearchType) {
  switch (type) {
    case 'anime':
    case 'manga':
      return ['AniList', 'Jikan', 'Kitsu', 'Shikimori']
    case 'movie':
    case 'series':
      return ['TMDB']
    case 'book':
      return ['OpenLibrary']
    default:
      return []
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: { locale?: string; query?: string; type?: string }

  try {
    payload = (await request.json()) as { query?: string; type?: string }
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const query = payload.query?.trim()
  const locale = resolveLocale(payload.locale ?? (await getRequestLocale()))
  const searchType = payload.type?.trim().toLowerCase()

  if (!query || query.length < 3) {
    return Response.json({
      data: [],
      message: 'Type at least 3 characters to search global databases.',
    })
  }

  if (!isCatalogSearchType(searchType)) {
    return Response.json({ error: 'Select a media type first.' }, { status: 400 })
  }

  if (containsBlockedSearchTerm(query)) {
    return Response.json({ error: getBlockedSearchMessage() }, { status: 400 })
  }

  const searchTerms = buildQuickImportSearchTerms(query)

  if (searchTerms.length === 0) {
    return Response.json({ data: [] })
  }

  console.info('[catalog-search] request', {
    providers: getCatalogProviderPlan(searchType),
    query,
    searchTermCount: searchTerms.length,
    type: searchType,
  })

  try {
    const candidates = await searchCatalogByMediaType(searchTerms, searchType, locale)

    console.info('[catalog-search] response', {
      query,
      resultCount: candidates.length,
      type: searchType,
    })

    return Response.json({ data: candidates.slice(0, 5) })
  } catch (error) {
    if (isCatalogSearchProviderError(error)) {
      console.warn('[catalog-search] provider error', {
        message: error.message,
        provider: error.provider,
        query,
        status: error.status,
        type: searchType,
      })

      return Response.json({ error: error.message }, { status: 502 })
    }

    console.error('[catalog-search] unexpected error', {
      message: error instanceof Error ? error.message : 'Unknown catalog search error.',
      query,
      type: searchType,
    })

    return Response.json({ error: 'Catalog search failed. Please try again.' }, { status: 500 })
  }
}
