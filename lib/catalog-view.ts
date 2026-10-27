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
  return items.find((item) => {
    const sameType = item.type === candidate.type ||
      (['Manga', 'Manhwa', 'Manhua'].includes(item.type) && ['Manga', 'Manhwa', 'Manhua'].includes(candidate.type))
    if (!sameType) return false
    if (item.externalSource?.toLowerCase() === candidate.provider.toLowerCase() && item.externalId) {
      const candidateId = candidate.id.split(':').at(-1)
      if (item.externalId === candidateId || item.externalId === candidate.id) return true
    }
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
