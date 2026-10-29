import type { CatalogSearchCandidate } from './catalog-types'
import type { MediaItemInput } from './media'

export type CatalogOwnedItem = {
  id: string
  title: string
  type: string
  externalSource: string | null
  externalId: string | null
}

function comparableTitle(title: string) {
  return title.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ')
}

export function getOwnedCatalogItem(candidate: CatalogSearchCandidate, items: CatalogOwnedItem[]) {
  const sameTypeItems = items.filter((item) => item.type === candidate.type ||
      (['Manga', 'Manhwa', 'Manhua'].includes(item.type) && ['Manga', 'Manhwa', 'Manhua'].includes(candidate.type))
  )
  const sameProvider = (item: CatalogOwnedItem) => item.externalSource?.toLowerCase() === candidate.provider.toLowerCase()
  const candidateId = candidate.id.split(':').at(-1)
  const exactMatch = sameTypeItems.find((item) => sameProvider(item) && item.externalId &&
    (item.externalId === candidateId || item.externalId === candidate.id))
  if (exactMatch) return exactMatch

  return sameTypeItems.find((item) => {
    // A title is not a cross-provider ID bridge. Keep the legacy title fallback
    // only for manual records; a known identity needs a verified exact match.
    if (item.externalSource && item.externalId) return false
    return comparableTitle(item.title) === comparableTitle(candidate.title)
  }) ?? null
}

export function mergeCatalogPages(current: CatalogSearchCandidate[], incoming: CatalogSearchCandidate[]) {
  return [...new Map([...current, ...incoming].map((item) => [item.id, item])).values()]
}

export function catalogCandidateToInput(candidate: CatalogSearchCandidate, notes = ''): MediaItemInput {
  return {
    completedAt: '', externalRatingLabel: candidate.externalRatingLabel ?? '',
    externalRatingValue: typeof candidate.externalRatingValue === 'number' ? String(candidate.externalRatingValue) : '',
    favorite: false, genres: candidate.genres, imageUrl: candidate.imageUrl, notes,
    progress: '', rating: '', startedAt: '', status: candidate.status, title: candidate.title,
    totalProgress: candidate.totalProgress, type: candidate.type,
  }
}
