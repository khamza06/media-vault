import { Parser } from 'htmlparser2'
import { mediaTypes, type MediaType } from './media'

export type MediaPageMetadata = {
  titles: string[]
  language?: string
  type?: MediaType
  year?: string
  authors: string[]
  canonicalUrl?: string
}

export function cleanMediaTitle(value: string) {
  return value.replace(/<[^>]*>/g, ' ').normalize('NFKC').replace(/\s+/g, ' ').trim()
    .replace(/\s+(?:[|–—]| - )\s*(?:watch|read|смотреть|читать|онлайн|online).*$/iu, '').slice(0, 240)
}

export function inferPageMediaType(value: string): MediaType | undefined {
  const normalized = value.toLowerCase().replace(/[^\p{L}]/gu, '')
  if (/manhwa|манхва/.test(normalized)) return 'Manhwa'
  if (/manhua|маньхуа/.test(normalized)) return 'Manhua'
  if (/anime|аниме/.test(normalized)) return 'Anime'
  if (/manga|comic|манга/.test(normalized)) return 'Manga'
  if (/tvseries|tvshow|tv_show|сериал/.test(normalized)) return 'TV Series'
  if (/movie|film|video.movie|фильм/.test(normalized)) return 'Movie'
  if (/book|novel|книга|小説|小说|小說|소설/.test(normalized)) return 'Book'
  return mediaTypes.find(type => type.toLowerCase() === normalized)
}

export function extractMediaPageMetadata(html: string, pageUrl: string): MediaPageMetadata {
  const result: MediaPageMetadata = { titles: [], authors: [] }
  const structured: string[] = [], primary: string[] = [], alternate: string[] = [], fallback: string[] = []
  let capture = '', text = '', tags = 0, restricted = false
  const add = (list: string[], value: unknown) => {
    if (typeof value === 'string' && value.length <= 1000) {
      const cleaned = cleanMediaTitle(value)
      if (cleaned.length >= 2) list.push(cleaned)
    }
  }
  function readStructured(value: unknown, depth = 0) {
    if (!value || depth > 5) return
    if (Array.isArray(value)) { for (const entry of value.slice(0, 32)) readStructured(entry, depth + 1); return }
    if (typeof value !== 'object') return
    const row = value as Record<string, unknown>
    const schemaType = Array.isArray(row['@type']) ? row['@type'].join(' ') : String(row['@type'] ?? '')
    const type = inferPageMediaType(schemaType)
    if (type) {
      result.type ??= type
      add(structured, row.name); add(structured, row.headline)
      const aliases = Array.isArray(row.alternateName) ? row.alternateName.slice(0, 16) : [row.alternateName]
      for (const alias of aliases) add(alternate, alias)
      const date = String(row.datePublished ?? row.dateCreated ?? row.startDate ?? '')
      result.year ??= /(?:18|19|20|21)\d{2}/.exec(date)?.[0]
      const authors = Array.isArray(row.author) ? row.author.slice(0, 8) : [row.author]
      for (const author of authors) add(result.authors, author && typeof author === 'object' ? (author as { name?: unknown }).name : author)
      if (typeof row.inLanguage === 'string') result.language ??= row.inLanguage.slice(0, 35)
    }
    for (const key of ['@graph', 'mainEntity', 'itemListElement', 'item']) readStructured(row[key], depth + 1)
  }
  const parser = new Parser({
    onopentag(name, attributes) {
      if (++tags > 15000) throw new Error('Metadata page is too complex')
      if (name === 'html' && attributes.lang) result.language ??= attributes.lang.slice(0, 35)
      if (name === 'meta') {
        const key = (attributes.property ?? attributes.name ?? attributes['http-equiv'] ?? '').toLowerCase()
        const content = attributes.content ?? ''
        if (['robots', 'mediavault', 'googlebot'].includes(key) && /noindex|nosnippet|noai/i.test(content)) restricted = true
        if (['og:title', 'twitter:title'].includes(key)) add(primary, content)
        if (['alternative-title', 'alternate-title', 'dc.title'].includes(key)) add(alternate, content)
        if (key === 'og:type') result.type ??= inferPageMediaType(content)
        if (key === 'og:locale' || key === 'content-language') result.language ??= content.slice(0, 35)
        if (['video:release_date', 'book:release_date'].includes(key)) result.year ??= /(?:18|19|20|21)\d{2}/.exec(content)?.[0]
      }
      if (name === 'link' && attributes.rel?.toLowerCase().split(/\s+/).includes('canonical')) {
        try {
          const url = new URL(attributes.href, pageUrl)
          if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.href.length <= 2048) result.canonicalUrl = url.href
        } catch { /* A canonical link is a hint, never a network request. */ }
      }
      if (name === 'title' || name === 'h1' || (name === 'script' && attributes.type?.toLowerCase() === 'application/ld+json')) { capture = name; text = '' }
    },
    ontext(value) { if (capture && text.length < 64 * 1024) text += value.slice(0, 64 * 1024 - text.length) },
    onclosetag(name) {
      if (name !== capture) return
      if (name === 'script') { try { readStructured(JSON.parse(text)) } catch { /* Optional malformed JSON-LD cannot discard valid OG data. */ } }
      else add(fallback, text)
      capture = ''; text = ''
    },
  }, { decodeEntities: true })
  parser.end(html)
  if (restricted) throw new Error('Page metadata use is restricted')
  result.titles = [...new Set([...structured, ...primary, ...alternate, ...fallback])].slice(0, 8)
  result.authors = [...new Set(result.authors)].slice(0, 8)
  return result
}
