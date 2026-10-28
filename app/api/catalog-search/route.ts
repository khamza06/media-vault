import { getCurrentUser } from '../../../lib/auth/dal'
import {
  isCatalogSearchProviderError,
  searchCatalogByMediaType,
  searchCatalogPage,
} from '../../../lib/catalog-search'
import type { CatalogSearchSource } from '../../../lib/catalog-types'
import { getRequestLocale } from '../../../lib/i18n-server'
import { resolveLocale } from '../../../lib/i18n'
import { buildQuickImportSearchTerms } from '../../../lib/quick-import-parser'
import {
  MIN_CATALOG_QUERY_LENGTH,
  containsBlockedSearchTerm,
  getBlockedSearchMessage,
  isCatalogSearchType,
  isMangaCatalogSearchType,
  type CatalogSearchType,
} from '../../../lib/search-safety'

function getCatalogProviderPlan(type: CatalogSearchType) {
  switch (type) {
    case 'anime':
    case 'manga':
    case 'manhwa':
    case 'manhua':
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

  let payload: Record<string, unknown>

  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 })
    }
    payload = body as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const query = typeof payload.query === 'string' ? payload.query.trim() : ''
  const locale = resolveLocale(typeof payload.locale === 'string' ? payload.locale : await getRequestLocale())
  const searchType = typeof payload.type === 'string' ? payload.type.trim().toLowerCase() : ''
  if (query.length > 200) {
    return Response.json({ error: 'Search titles must be 200 characters or fewer.' }, { status: 400 })
  }

  if (!query || query.length < MIN_CATALOG_QUERY_LENGTH) {
    return Response.json({
      data: [],
      message: 'Type at least 2 characters to search global databases.',
    })
  }

  if (!isCatalogSearchType(searchType)) {
    return Response.json({ error: 'Select a media type first.' }, { status: 400 })
  }

  if (containsBlockedSearchTerm(query)) {
    return Response.json({ error: getBlockedSearchMessage() }, { status: 400 })
  }

  const fullSearch = payload.mode === 'full'
  const source = payload.source ?? 'primary'
  const page = payload.page ?? 1
  if (fullSearch && (
    typeof page !== 'number' || !Number.isInteger(page) || page < 1 || page > 500 ||
    typeof source !== 'string' || !['primary', 'jikan', 'kitsu', 'shikimori'].includes(source) ||
    (source !== 'primary' && searchType !== 'anime' && !isMangaCatalogSearchType(searchType))
  )) {
    return Response.json({ error: 'Invalid search source or page.' }, { status: 400 })
  }

  const searchTerms = buildQuickImportSearchTerms(query)

  if (!fullSearch && searchTerms.length === 0) {
    return Response.json({ data: [] })
  }

  console.info('[catalog-search] request', {
    providers: getCatalogProviderPlan(searchType),
    queryLength: query.length,
    searchTermCount: searchTerms.length,
    type: searchType,
  })

  try {
    if (fullSearch) {
      return Response.json(await searchCatalogPage(query, searchType, locale, source as CatalogSearchSource, page as number))
    }
    const candidates = await searchCatalogByMediaType(searchTerms, searchType, locale)

    console.info('[catalog-search] response', {
      queryLength: query.length,
      resultCount: candidates.length,
      type: searchType,
    })

    return Response.json({ data: candidates.slice(0, 5) })
  } catch (error) {
    if (isCatalogSearchProviderError(error)) {
      console.warn('[catalog-search] provider error', {
        message: error.message,
        provider: error.provider,
        queryLength: query.length,
        status: error.status,
        type: searchType,
      })

      return Response.json({ error: error.message }, { status: 502 })
    }

    console.error('[catalog-search] unexpected error', {
      message: error instanceof Error ? error.message : 'Unknown catalog search error.',
      queryLength: query.length,
      type: searchType,
    })

    return Response.json({ error: 'Catalog search failed. Please try again.' }, { status: 500 })
  }
}
