import { t, translateStatus, translateType, type Locale, type MessageKey } from './i18n'
import { libraryCoverOptions, libraryRatingOptions, librarySortOptions, librarySourceOptions, libraryStatusOptions, libraryTypeOptions } from './library-filters'
import type { MediaShelfKey } from './media'
import { getShelfDefinitionBySlug } from './shelves'

function labelOptions<V extends string>(locale: Locale, options: readonly { label: string; value: V }[], keys: Partial<Record<V, MessageKey>>) {
  return options.map((option) => {
    const key = keys[option.value]
    return { ...option, label: key ? t(locale, key) : option.label }
  })
}

export function getLibraryDisplayOptions(locale: Locale) {
  return {
    type: libraryTypeOptions.map((option) => ({ ...option, label: option.value === 'all' ? t(locale, 'library.allTypes') : translateType(locale, option.value) })),
    status: libraryStatusOptions.map((option) => ({ ...option, label: option.value === 'all' ? t(locale, 'library.allStatuses') : translateStatus(locale, option.value) })),
    cover: labelOptions(locale, libraryCoverOptions, { all: 'library.allItems', 'has-cover': 'library.hasCover', 'no-cover': 'library.noCoverOption' }),
    source: labelOptions(locale, librarySourceOptions, { all: 'library.allSources', manual: 'library.manualSource' }),
    rating: labelOptions(locale, libraryRatingOptions, { all: 'library.allRatings', rated: 'library.rated', unrated: 'library.unrated' }),
    sort: labelOptions(locale, librarySortOptions, { 'created-desc': 'library.recentlyAdded', 'title-asc': 'library.sort.titleAsc', 'title-desc': 'library.sort.titleDesc', 'rating-desc': 'library.sort.ratingDesc', 'rating-asc': 'library.lowestRating', 'progress-desc': 'library.sort.progressDesc', status: 'form.status' }),
  }
}

const shelfKeys = {
  anime: ['shelf.anime', 'shelf.animeDescription'],
  'manga-family': ['shelf.manga', 'shelf.mangaDescription'],
  movies: ['shelf.movies', 'shelf.moviesDescription'],
  series: ['shelf.series', 'shelf.seriesDescription'],
  books: ['shelf.books', 'shelf.booksDescription'],
} as const satisfies Record<MediaShelfKey, readonly [MessageKey, MessageKey]>

export function getShelfDisplay(locale: Locale, key: MediaShelfKey) {
  const [label, description] = shelfKeys[key]
  return { label: t(locale, label), description: t(locale, description) }
}

export function getSavedViewLocationLabel(locale: Locale, pathname: string) {
  if (pathname === '/') return t(locale, 'nav.library')
  const shelf = getShelfDefinitionBySlug(pathname.split('/').at(-1) ?? '')
  return shelf ? t(locale, 'savedViews.shelf', { name: getShelfDisplay(locale, shelf.key).label }) : t(locale, 'savedViews.genericShelf')
}
