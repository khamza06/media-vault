export type QuickImportSource =
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

export type QuickImportTypeHint = 'ANIME' | 'MANGA' | null

export type ParsedQuickImportUrl = {
  hostname: string
  kind: 'film' | 'series' | null
  rawUrl: string
  searchTerm: string
  source: QuickImportSource
  typeHint: QuickImportTypeHint
}

const GENERIC_NOISE_TOKENS = new Set([
  'anime',
  'animes',
  'book',
  'books',
  'catalog',
  'chapter',
  'chapters',
  'comic',
  'comics',
  'en',
  'episode',
  'episodes',
  'film',
  'kind',
  'manga',
  'mangas',
  'manhua',
  'manhwa',
  'news',
  'novel',
  'novels',
  'online',
  'read',
  'reader',
  'ru',
  'serial',
  'series',
  'tv',
  'title',
  'titles',
  'v',
  'watch',
  'watching',
  'аниме',
  'глава',
  'главы',
  'книга',
  'книги',
  'манга',
  'манхва',
  'маньхуа',
  'серии',
  'сериал',
  'серия',
  'смотреть',
  'фильм',
  'читать',
])

const ANIME_HINT_TOKENS = new Set([
  'anime',
  'animes',
  'episode',
  'episodes',
  'ova',
  'ona',
  'tv',
  'yummyanime',
  'аниме',
  'серия',
  'серии',
])

const MANGA_HINT_TOKENS = new Set([
  'book',
  'books',
  'chapter',
  'chapters',
  'comic',
  'comics',
  'manga',
  'mangas',
  'manhua',
  'manhwa',
  'novel',
  'novels',
  'readmanga',
  'глава',
  'главы',
  'книга',
  'книги',
  'манга',
  'манхва',
  'маньхуа',
  'ранобэ',
  'читать',
])

function normalizeSegment(value: string) {
  return decodeURIComponent(value)
    .replace(/\?.*$/, '')
    .replace(/#.*/, '')
    .replace(/\.(html?|php|aspx?|jsp)$/i, '')
    .replace(/[-_/+.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSearchTerm(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^(?:\d+\s+)+/, '')
    .trim()
}

function inferSource(hostname: string): QuickImportSource {
  if (hostname.endsWith('imdb.com')) {
    return 'imdb'
  }

  if (hostname.endsWith('kinopoisk.ru')) {
    return 'kinopoisk'
  }

  if (hostname.endsWith('mangalib.me') || hostname.endsWith('mangalib.org')) {
    return 'mangalib'
  }

  if (hostname.endsWith('remanga.org')) {
    return 'remanga'
  }

  if (hostname.endsWith('mangabuff.ru')) {
    return 'mangabuff'
  }

  if (hostname.endsWith('senkuro.com')) {
    return 'senkuro'
  }

  if (hostname.endsWith('readmanga.live') || hostname.endsWith('readmanga.ru')) {
    return 'readmanga'
  }

  if (hostname.endsWith('myanimelist.net')) {
    return 'myanimelist'
  }

  if (hostname.endsWith('shikimori.one') || hostname.endsWith('shikimori.me')) {
    return 'shikimori'
  }

  if (hostname.endsWith('yummyanime.tv')) {
    return 'yummyanime'
  }

  return 'generic'
}

function inferTypeHint(hostname: string, pathTokens: string[]) {
  const normalizedTokens = pathTokens.map((token) => token.toLowerCase())

  if (hostname.endsWith('imdb.com') || hostname.endsWith('kinopoisk.ru')) {
    return null
  }

  if (normalizedTokens.some((token) => ANIME_HINT_TOKENS.has(token))) {
    return 'ANIME'
  }

  if (normalizedTokens.some((token) => MANGA_HINT_TOKENS.has(token))) {
    return 'MANGA'
  }

  return null
}

export function buildQuickImportSearchTerms(searchTerm: string) {
  const normalized = normalizeSearchTerm(searchTerm)
  const tokens = normalized.split(' ').filter(Boolean)
  const prunedTokens = tokens.filter(
    (token) => !/^\d+$/.test(token) && !GENERIC_NOISE_TOKENS.has(token.toLowerCase())
  )
  const terms = new Set<string>()

  const addTerm = (value: string) => {
    const cleaned = normalizeSearchTerm(value)

    if (cleaned.length > 1) {
      terms.add(cleaned)
    }
  }

  addTerm(normalized)
  addTerm(prunedTokens.join(' '))
  addTerm(prunedTokens.slice(-4).join(' '))

  if (prunedTokens.length <= 4) {
    for (const token of prunedTokens) {
      if (token.length > 3) {
        addTerm(token)
      }
    }
  }

  return [...terms]
}

export function extractQuickImportFromUrl(rawUrl: string): ParsedQuickImportUrl {
  let url: URL

  try {
    url = new URL(rawUrl.trim())
  } catch {
    throw new Error('Paste a valid URL first.')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http and https links are supported.')
  }

  const hostname = url.hostname.replace(/^www\./, '').toLowerCase()
  const source = inferSource(hostname)
  const pathSegments = url.pathname.split('/').filter(Boolean)
  const normalizedSegments = pathSegments.map(normalizeSegment).filter(Boolean)
  const kind =
    pathSegments[0]?.toLowerCase() === 'film'
      ? 'film'
      : pathSegments[0]?.toLowerCase() === 'series'
        ? 'series'
        : null

  if (source === 'kinopoisk') {
    const idMatch = /\/(film|series)\/(\d+)/i.exec(url.pathname)
    const searchTerm = idMatch?.[2] ?? normalizeSearchTerm(normalizedSegments.join(' '))

    if (!searchTerm) {
      throw new Error('Could not extract a usable title from this link.')
    }

    return {
      hostname,
      kind,
      rawUrl: url.toString(),
      searchTerm,
      source,
      typeHint: null,
    }
  }

  if (source === 'imdb') {
    const imdbId = /\/title\/(tt\d+)/i.exec(url.pathname)?.[1] ?? null
    const searchTerm = imdbId ?? normalizeSearchTerm(normalizedSegments.join(' '))

    if (!searchTerm) {
      throw new Error('Could not extract a usable title from this link.')
    }

    return {
      hostname,
      kind: null,
      rawUrl: url.toString(),
      searchTerm,
      source,
      typeHint: null,
    }
  }

  const searchTerm = normalizeSearchTerm(normalizedSegments.join(' '))

  if (!searchTerm) {
    throw new Error('Could not extract a usable title from this link.')
  }

  return {
    hostname,
    kind: null,
    rawUrl: url.toString(),
    searchTerm,
    source,
    typeHint: inferTypeHint(hostname, normalizedSegments),
  }
}
