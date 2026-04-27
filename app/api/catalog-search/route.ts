import { getCurrentUser } from '../../../lib/auth/dal'
import { searchCatalogByMediaType } from '../../../lib/catalog-search'
import { getRequestLocale } from '../../../lib/i18n-server'
import { resolveLocale } from '../../../lib/i18n'
import { buildQuickImportSearchTerms } from '../../../lib/quick-import-parser'
import {
  containsBlockedSearchTerm,
  getBlockedSearchMessage,
  isCatalogSearchType,
} from '../../../lib/search-safety'

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

  if (!query || query.length < 2) {
    return Response.json({ data: [] })
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

  const candidates = await searchCatalogByMediaType(searchTerms, searchType, locale)

  return Response.json({ data: candidates.slice(0, 5) })
}
