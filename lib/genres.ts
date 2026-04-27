import type { Locale } from './i18n'

const GENRE_LABELS = {
  Action: { en: 'Action', ru: 'Экшен' },
  Adventure: { en: 'Adventure', ru: 'Приключения' },
  'Avant Garde': { en: 'Avant Garde', ru: 'Авангард' },
  'Boys Love': { en: 'Boys Love', ru: 'Сёнэн-ай' },
  Comedy: { en: 'Comedy', ru: 'Комедия' },
  Crime: { en: 'Crime', ru: 'Криминал' },
  Demons: { en: 'Demons', ru: 'Демоны' },
  Detective: { en: 'Detective', ru: 'Детектив' },
  Drama: { en: 'Drama', ru: 'Драма' },
  Ecchi: { en: 'Ecchi', ru: 'Этти' },
  Fantasy: { en: 'Fantasy', ru: 'Фэнтези' },
  Game: { en: 'Game', ru: 'Игры' },
  Gore: { en: 'Gore', ru: 'Жестокость' },
  Harem: { en: 'Harem', ru: 'Гарем' },
  Historical: { en: 'Historical', ru: 'История' },
  Horror: { en: 'Horror', ru: 'Ужасы' },
  Isekai: { en: 'Isekai', ru: 'Исекай' },
  Josei: { en: 'Josei', ru: 'Дзёсэй' },
  Kids: { en: 'Kids', ru: 'Детское' },
  Magic: { en: 'Magic', ru: 'Магия' },
  'Martial Arts': { en: 'Martial Arts', ru: 'Боевые искусства' },
  Mecha: { en: 'Mecha', ru: 'Меха' },
  Military: { en: 'Military', ru: 'Военное' },
  Music: { en: 'Music', ru: 'Музыка' },
  Mystery: { en: 'Mystery', ru: 'Мистика' },
  Parody: { en: 'Parody', ru: 'Пародия' },
  Police: { en: 'Police', ru: 'Полиция' },
  Psychological: { en: 'Psychological', ru: 'Психология' },
  Romance: { en: 'Romance', ru: 'Романтика' },
  School: { en: 'School', ru: 'Школа' },
  'Sci-Fi': { en: 'Sci-Fi', ru: 'Науч. фантастика' },
  Seinen: { en: 'Seinen', ru: 'Сэйнэн' },
  Shoujo: { en: 'Shoujo', ru: 'Сёдзё' },
  Shounen: { en: 'Shounen', ru: 'Сёнэн' },
  'Slice of Life': { en: 'Slice of Life', ru: 'Повседневность' },
  Space: { en: 'Space', ru: 'Космос' },
  Sports: { en: 'Sports', ru: 'Спорт' },
  Supernatural: { en: 'Supernatural', ru: 'Сверхъестественное' },
  Suspense: { en: 'Suspense', ru: 'Саспенс' },
  Thriller: { en: 'Thriller', ru: 'Триллер' },
  Vampires: { en: 'Vampires', ru: 'Вампиры' },
  Yaoi: { en: 'Yaoi', ru: 'Яой' },
  Yuri: { en: 'Yuri', ru: 'Юри' },
} as const

type CanonicalGenre = keyof typeof GENRE_LABELS
export const canonicalGenres = Object.keys(GENRE_LABELS) as CanonicalGenre[]

const GENRE_SYNONYMS: Record<string, CanonicalGenre> = {
  action: 'Action',
  adventure: 'Adventure',
  avantgarde: 'Avant Garde',
  boyslove: 'Boys Love',
  comedy: 'Comedy',
  crime: 'Crime',
  demons: 'Demons',
  detective: 'Detective',
  drama: 'Drama',
  ecchi: 'Ecchi',
  fantasy: 'Fantasy',
  game: 'Game',
  gore: 'Gore',
  harem: 'Harem',
  historical: 'Historical',
  history: 'Historical',
  horror: 'Horror',
  isekai: 'Isekai',
  josei: 'Josei',
  kids: 'Kids',
  magic: 'Magic',
  martialarts: 'Martial Arts',
  mecha: 'Mecha',
  military: 'Military',
  music: 'Music',
  mystery: 'Mystery',
  parody: 'Parody',
  police: 'Police',
  psychological: 'Psychological',
  romance: 'Romance',
  school: 'School',
  scifi: 'Sci-Fi',
  sciencefiction: 'Sci-Fi',
  seinen: 'Seinen',
  shoujo: 'Shoujo',
  shojo: 'Shoujo',
  shounen: 'Shounen',
  shonen: 'Shounen',
  sliceoflife: 'Slice of Life',
  space: 'Space',
  sports: 'Sports',
  supernatural: 'Supernatural',
  suspense: 'Suspense',
  thriller: 'Thriller',
  vampires: 'Vampires',
  yaoi: 'Yaoi',
  yuri: 'Yuri',
  экшен: 'Action',
  приключения: 'Adventure',
  авангард: 'Avant Garde',
  сененай: 'Boys Love',
  сёнэнай: 'Boys Love',
  комедия: 'Comedy',
  криминал: 'Crime',
  демоны: 'Demons',
  детектив: 'Detective',
  драма: 'Drama',
  этти: 'Ecchi',
  фэнтези: 'Fantasy',
  игры: 'Game',
  жестокость: 'Gore',
  гарем: 'Harem',
  история: 'Historical',
  ужасы: 'Horror',
  исекай: 'Isekai',
  дзёсэй: 'Josei',
  дзесэй: 'Josei',
  детское: 'Kids',
  магия: 'Magic',
  боевыеискусства: 'Martial Arts',
  меха: 'Mecha',
  военное: 'Military',
  музыка: 'Music',
  мистика: 'Mystery',
  пародия: 'Parody',
  полиция: 'Police',
  психология: 'Psychological',
  романтика: 'Romance',
  школа: 'School',
  научнаяфантастика: 'Sci-Fi',
  научфантастика: 'Sci-Fi',
  сэйнэн: 'Seinen',
  седзе: 'Shoujo',
  сёдзё: 'Shoujo',
  сенен: 'Shounen',
  сёнэн: 'Shounen',
  повседневность: 'Slice of Life',
  космос: 'Space',
  спорт: 'Sports',
  сверхъестественное: 'Supernatural',
  саспенс: 'Suspense',
  триллер: 'Thriller',
  вампиры: 'Vampires',
  яой: 'Yaoi',
  юри: 'Yuri',
}

function normalizeGenreKey(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.'’`"]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, '')
    .trim()
}

function titleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function resolveCanonicalGenre(value: string) {
  const normalized = normalizeGenreKey(value)

  if (!normalized) {
    return ''
  }

  return GENRE_SYNONYMS[normalized] ?? titleCase(value.trim())
}

export function translateGenre(value: string, locale: Locale) {
  const canonical = resolveCanonicalGenre(value)

  if (!canonical) {
    return ''
  }

  const known = GENRE_LABELS[canonical as CanonicalGenre]
  return known ? known[locale] : canonical
}

export function normalizeGenreList(genres: string[]) {
  return Array.from(
    new Set(
      genres
        .map(resolveCanonicalGenre)
        .map((genre) => genre.trim().replace(/\s+/g, ' '))
        .filter(Boolean)
    )
  )
}

export function localizeGenreList(genres: string[], locale: Locale) {
  return normalizeGenreList(genres).map((genre) => translateGenre(genre, locale))
}

export function localizeGenreCsv(value: string, locale: Locale) {
  return localizeGenreList(
    value
      .split(',')
      .map((genre) => genre.trim())
      .filter(Boolean),
    locale
  ).join(', ')
}

export function getGenreBadgeClass(genre: string) {
  switch (resolveCanonicalGenre(genre)) {
    case 'Action':
    case 'Martial Arts':
      return 'border-red-400/30 bg-red-500/12 text-red-100'
    case 'Drama':
    case 'Romance':
      return 'border-blue-400/30 bg-blue-500/12 text-blue-100'
    case 'Fantasy':
    case 'Isekai':
    case 'Supernatural':
      return 'border-violet-400/30 bg-violet-500/12 text-violet-100'
    case 'Sci-Fi':
    case 'Space':
    case 'Mecha':
      return 'border-cyan-400/30 bg-cyan-500/12 text-cyan-100'
    case 'Comedy':
    case 'Parody':
      return 'border-amber-400/30 bg-amber-500/12 text-amber-100'
    case 'Slice of Life':
    case 'School':
      return 'border-emerald-400/30 bg-emerald-500/12 text-emerald-100'
    case 'Thriller':
    case 'Horror':
    case 'Mystery':
      return 'border-rose-400/30 bg-rose-500/12 text-rose-100'
    default:
      return 'border-slate-600/70 bg-slate-900/80 text-slate-200'
  }
}
