import 'server-only'

import type { CatalogSearchCandidate } from './catalog-types'
import { searchUniversalCatalog } from './catalog-search'
import type { Locale } from './i18n'
import { buildQuickImportSearchTerms, extractQuickImportFromUrl } from './quick-import-parser'
import type { MediaItemInput } from './media'

type QuickImportForm = Pick<
  MediaItemInput,
  | 'externalRatingLabel'
  | 'externalRatingValue'
  | 'genres'
  | 'imageUrl'
  | 'notes'
  | 'status'
  | 'title'
  | 'totalProgress'
  | 'type'
>
type QuickImportCandidate = CatalogSearchCandidate

export type QuickImportPayload = {
  candidates: QuickImportCandidate[]
  form: QuickImportForm
  source: string
  warning: string | null
}

function toReadableTitle(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function buildDraftForm(searchTerm: string, typeHint: 'ANIME' | 'MANGA' | null) {
  const title = toReadableTitle(
    searchTerm
      .replace(/^tt\d+$/i, 'IMDb')
      .replace(/^\d+\s+/, '')
      .trim()
  )

  return {
    externalRatingLabel: '',
    externalRatingValue: '',
    genres: '',
    imageUrl: '',
    notes: '',
    status: typeHint === 'ANIME' ? 'Planning' : 'Reading',
    title: title || 'Imported title',
    totalProgress: '',
    type: typeHint === 'ANIME' ? 'Anime' : typeHint === 'MANGA' ? 'Manga' : 'Manga',
  } satisfies QuickImportForm
}

export async function resolveQuickImport(url: string, locale: Locale): Promise<QuickImportPayload> {
  const parsed = extractQuickImportFromUrl(url)
  const searchTerms = buildQuickImportSearchTerms(parsed.searchTerm)

  if (searchTerms.length === 0) {
    return {
      candidates: [],
      form: buildDraftForm(parsed.searchTerm, parsed.typeHint),
      source: parsed.source,
      warning: 'No search terms could be extracted, so a draft item was prepared from the link.',
    }
  }

  const candidates = (await searchUniversalCatalog(searchTerms, parsed.typeHint, locale)).sort(
    (left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.title.localeCompare(right.title)
    }
  )

  const bestCandidate = candidates[0]

  if (!bestCandidate) {
    return {
      candidates: [],
      form: buildDraftForm(searchTerms[0] ?? parsed.searchTerm, parsed.typeHint),
      source: parsed.source,
      warning: 'No confident match was found in the external catalogs, so a draft item was prepared instead.',
    }
  }

  const form = {
    externalRatingLabel: bestCandidate.externalRatingLabel ?? '',
    externalRatingValue:
      typeof bestCandidate.externalRatingValue === 'number'
        ? String(bestCandidate.externalRatingValue)
        : '',
    genres: bestCandidate.genres,
    imageUrl: bestCandidate.imageUrl,
    notes: bestCandidate.description,
    status: bestCandidate.status,
    title: bestCandidate.title,
    totalProgress: bestCandidate.totalProgress,
    type: bestCandidate.type,
  } satisfies QuickImportForm

  if (candidates.length > 1 && bestCandidate.score < 0.25) {
    return {
      candidates,
      form,
      source: parsed.source,
      warning: 'Multiple possible matches were found. Review the suggestions below before saving.',
    }
  }

  return {
    candidates,
    form,
    source: parsed.source,
    warning: null,
  }
}
