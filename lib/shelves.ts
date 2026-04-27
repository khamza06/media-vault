import type { MediaItem, MediaShelfKey, MediaType } from './media'
import { getMediaShelfKey } from './media'

export type ShelfDefinition = {
  description: string
  key: MediaShelfKey
  label: string
  slug: string
  types: MediaType[]
}

export const shelfDefinitions: ShelfDefinition[] = [
  {
    key: 'anime',
    slug: 'anime',
    label: 'Anime Family',
    description: 'Fresh episodes, re-watches, and your current anime momentum.',
    types: ['Anime'],
  },
  {
    key: 'manga-family',
    slug: 'manga-family',
    label: 'Manga Family',
    description: 'Manga, manhwa, and manhua in one reading shelf.',
    types: ['Manga', 'Manhwa', 'Manhua'],
  },
  {
    key: 'movies',
    slug: 'movies',
    label: 'Movies',
    description: 'Standalone films ready for a focused watch.',
    types: ['Movie'],
  },
  {
    key: 'series',
    slug: 'series',
    label: 'Series',
    description: 'TV and streaming series with long-form progress tracking.',
    types: ['TV Series'],
  },
  {
    key: 'books',
    slug: 'books',
    label: 'Books',
    description: 'Books, novels, and long-form page-based reading.',
    types: ['Book'],
  },
]

export function getShelfDefinitionBySlug(slug: string) {
  return shelfDefinitions.find((shelf) => shelf.slug === slug) ?? null
}

export function getShelfDefinitionByType(type: string) {
  const shelfKey = getMediaShelfKey(type)
  return shelfDefinitions.find((shelf) => shelf.key === shelfKey) ?? shelfDefinitions[0]
}

export function filterItemsForShelf(items: MediaItem[], slug: string) {
  const shelf = getShelfDefinitionBySlug(slug)

  if (!shelf) {
    return []
  }

  return items.filter((item) => shelf.types.some((type) => type === item.type))
}
