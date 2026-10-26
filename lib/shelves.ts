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
    label: 'Anime',
    description: 'Your anime, from first episodes to re-watches.',
    types: ['Anime'],
  },
  {
    key: 'manga-family',
    slug: 'manga-family',
    label: 'Manga',
    description: 'Manga, manhwa, and manhua in one reading shelf.',
    types: ['Manga', 'Manhwa', 'Manhua'],
  },
  {
    key: 'movies',
    slug: 'movies',
    label: 'Movies',
    description: 'Your films, watched and planned.',
    types: ['Movie'],
  },
  {
    key: 'series',
    slug: 'series',
    label: 'Series',
    description: 'Keep track of your TV and streaming series.',
    types: ['TV Series'],
  },
  {
    key: 'books',
    slug: 'books',
    label: 'Books',
    description: 'Your reading list, one page at a time.',
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
