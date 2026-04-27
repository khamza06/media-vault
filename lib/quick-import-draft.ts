import type { MediaItemInput } from './media'
import { extractQuickImportFromUrl } from './quick-import-parser'

type QuickImportDraftSource =
  | 'generic'
  | 'imdb'
  | 'kinopoisk'
  | 'mangalib'
  | 'mangabuff'
  | 'myanimelist'
  | 'readmanga'
  | 'remanga'
  | 'senkuro'
  | 'shikimori'
  | 'yummyanime'

type QuickImportDraftForm = Pick<
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

export type QuickImportDraftPayload = {
  form: QuickImportDraftForm
  source: QuickImportDraftSource
  warning: string
}

function normalizeTitleFragment(value: string) {
  return decodeURIComponent(value)
    .replace(/\?.*$/, '')
    .replace(/#.*/, '')
    .replace(/\.(html|php)$/i, '')
    .replace(/^(\d+[-_ ]+)+/, '')
    .replace(/[-_+]+/g, ' ')
    .replace(/[_-]+$/, '')
    .replace(/\s+[a-zа-я]\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toTitleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getLastMeaningfulNamedSegment(segments: string[]) {
  return (
    [...segments]
      .reverse()
      .find(
        (segment) =>
          segment &&
          !/^\d+$/.test(segment) &&
          !['main', 'info', 'chapters', 'chapter', 'comments', 'reviews', 'read'].includes(
            segment.toLowerCase()
          )
      ) ?? null
  )
}

function getSegmentAfter(segments: string[], marker: string) {
  const index = segments.findIndex((segment) => segment.toLowerCase() === marker.toLowerCase())
  return index >= 0 ? segments[index + 1] ?? null : null
}

function buildReadableTitle(value: string | null | undefined, fallback: string) {
  const normalized = value ? normalizeTitleFragment(value) : ''
  return normalized ? toTitleCase(normalized) : fallback
}

function createDraftForm(
  overrides: Pick<QuickImportDraftForm, 'status' | 'title' | 'type'> &
    Partial<Pick<QuickImportDraftForm, 'genres' | 'imageUrl' | 'notes' | 'totalProgress'>>
): QuickImportDraftForm {
  return {
    externalRatingLabel: '',
    externalRatingValue: '',
    genres: '',
    imageUrl: '',
    notes: '',
    totalProgress: '',
    ...overrides,
  }
}

export function buildQuickImportDraft(value: string): QuickImportDraftPayload | null {
  let url: URL

  try {
    url = new URL(value.trim())
  } catch {
    return null
  }

  const hostname = url.hostname.replace(/^www\./, '').toLowerCase()
  const segments = url.pathname.split('/').filter(Boolean)

  if (hostname.endsWith('mangalib.me') || hostname.endsWith('mangalib.org')) {
    const slug = segments.at(-1) ?? null

    return {
      form: createDraftForm({
        status: 'Reading',
        title: buildReadableTitle(slug, 'Imported Manga'),
        type: 'Manga',
      }),
      source: 'mangalib',
      warning: 'The page could not be parsed fully, so a draft manga entry was prepared from the link.',
    }
  }

  if (hostname.endsWith('remanga.org')) {
    const slug = getSegmentAfter(segments, 'manga') ?? segments[0]

    return {
      form: createDraftForm({
        status: 'Reading',
        title: buildReadableTitle(slug, 'Imported Manga'),
        type: 'Manga',
      }),
      source: 'remanga',
      warning: 'ReManga did not return enough metadata, so a draft entry was prepared from the link.',
    }
  }

  if (hostname.endsWith('mangabuff.ru')) {
    const slug = getSegmentAfter(segments, 'manga') ?? segments.at(-1) ?? segments[0]

    return {
      form: createDraftForm({
        status: 'Reading',
        title: buildReadableTitle(slug, 'Imported Manga'),
        type: 'Manga',
      }),
      source: 'mangabuff',
      warning: 'MangaBuff metadata was incomplete, so a draft entry was prepared from the link.',
    }
  }

  if (hostname.endsWith('myanimelist.net')) {
    const mediaType =
      segments[0] === 'anime' ? 'Anime' : segments[0] === 'manga' ? 'Manga' : 'Anime'
    const status = segments[0] === 'anime' ? 'Planning' : 'Reading'

    return {
      form: createDraftForm({
        status,
        title: buildReadableTitle(segments[2] ?? getLastMeaningfulNamedSegment(segments), 'Imported Title'),
        type: mediaType,
      }),
      source: 'myanimelist',
      warning: 'MyAnimeList metadata was incomplete, so a draft entry was prepared from the link.',
    }
  }

  if (hostname.endsWith('shikimori.one') || hostname.endsWith('shikimori.me')) {
    const mediaType =
      segments[0] === 'animes' ? 'Anime' : segments[0] === 'mangas' ? 'Manga' : 'Anime'
    const status = segments[0] === 'animes' ? 'Planning' : 'Reading'
    const slug = (segments[1] ?? '').replace(/^\d+-/, '') || getLastMeaningfulNamedSegment(segments)

    return {
      form: createDraftForm({
        status,
        title: buildReadableTitle(slug, 'Imported Title'),
        type: mediaType,
      }),
      source: 'shikimori',
      warning: 'Shikimori metadata was incomplete, so a draft entry was prepared from the link.',
    }
  }

  if (hostname.endsWith('kinopoisk.ru')) {
    const kind =
      segments[0] === 'series' ? 'TV Series' : segments[0] === 'film' ? 'Movie' : 'Movie'
    const itemId = /\/(film|series)\/(\d+)/i.exec(url.pathname)?.[2] ?? ''

    return {
      form: createDraftForm({
        status: 'Planning',
        title: itemId ? `Kinopoisk ${kind === 'TV Series' ? 'series' : 'movie'} #${itemId}` : 'Imported Movie',
        type: kind,
      }),
      source: 'kinopoisk',
      warning: 'Kinopoisk blocked automatic extraction, so a draft entry was prepared from the link.',
    }
  }

  if (hostname.endsWith('imdb.com')) {
    const imdbId = /\/title\/(tt\d+)/i.exec(url.pathname)?.[1] ?? ''

    return {
      form: createDraftForm({
        status: 'Planning',
        title: imdbId ? `IMDb ${imdbId}` : 'Imported Movie',
        type: 'Movie',
      }),
      source: 'imdb',
      warning: 'IMDb metadata was incomplete, so a draft entry was prepared from the link.',
    }
  }

  try {
    const parsed = extractQuickImportFromUrl(value)

    return {
      form: createDraftForm({
        status: parsed.typeHint === 'ANIME' ? 'Planning' : 'Reading',
        title: buildReadableTitle(parsed.searchTerm, 'Imported Title'),
        type: parsed.typeHint === 'ANIME' ? 'Anime' : parsed.typeHint === 'MANGA' ? 'Manga' : 'Manga',
      }),
      source: parsed.source,
      warning: 'A draft entry was prepared from the link.',
    }
  } catch {
    return null
  }
}
