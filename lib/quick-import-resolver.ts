import 'server-only'
import type { CatalogSearchCandidate } from './catalog-types'
import { searchAniListCandidates, searchJikanCandidates, searchKitsuCandidates, searchOpenLibraryCandidates, searchShikimoriCandidates, searchTmdbCandidatesByType } from './catalog-search'
import type { Locale } from './i18n'
import { getDefaultStatus, type MediaItemInput } from './media'
import { extractMediaPageMetadata, type MediaPageMetadata } from './media-page-metadata'
import { exactProviderReference, resolveExactProviderUrl } from './quick-import-exact'
import { extractQuickImportFromUrl } from './quick-import-parser'
import { fetchPublicPage, PageFetchError, validatePageUrl } from './safe-page-fetch'
import { identificationSearchTerms, rankIdentifiedCandidates } from './title-identification'
import { mapCatalogSearchTypeToMediaType, type CatalogSearchType } from './search-safety'

type Draft = Pick<MediaItemInput, 'externalRatingLabel' | 'externalRatingValue' | 'genres' | 'imageUrl' | 'notes' | 'status' | 'title' | 'totalProgress' | 'type'>
export type QuickImportPayload = { candidates: CatalogSearchCandidate[]; form: Draft; source: string; warning: string | null; warnings: string[]; requiresSelection: true; metadata: MediaPageMetadata }

function result(candidates: CatalogSearchCandidate[], metadata: MediaPageMetadata, source: string, warnings: string[], exact = false): QuickImportPayload {
  const type = metadata.type ?? ''
  return { candidates: rankIdentifiedCandidates(candidates, metadata, exact), form: { externalRatingLabel: '', externalRatingValue: '', genres: '', imageUrl: '', notes: '', status: type ? getDefaultStatus(type) : '', title: metadata.titles[0] ?? '', totalProgress: '', type }, source, warning: warnings[0] ?? null, warnings: [...new Set(warnings)], requiresSelection: true, metadata }
}

async function settledBeforeDeadline(operations: Array<Promise<CatalogSearchCandidate[]>>, signal: AbortSignal) {
  return Promise.all(operations.map(operation => new Promise<CatalogSearchCandidate[]>((resolve) => {
    const abort = () => resolve([])
    if (signal.aborted) { void operation.catch(() => {}); resolve([]); return }
    signal.addEventListener('abort', abort, { once: true })
    operation.then(value => resolve(value), () => resolve([])).finally(() => signal.removeEventListener('abort', abort))
  })))
}

export async function resolveQuickImport(input: string, locale: Locale, selectedType?: CatalogSearchType, metadataLanguage?: import('./metadata-language').MetadataLanguage): Promise<QuickImportPayload> {
  const signal = AbortSignal.timeout(18000)
  const warnings: string[] = []
  let metadata: MediaPageMetadata = { titles: [input], authors: [] }
  let source = 'title'
  const urlLike = /^(?:[a-z][a-z0-9+.-]*:\/\/|https?:|file:|data:|javascript:|gopher:|www\.)/i.test(input)
  if (urlLike) {
    const url = validatePageUrl(input)
    source = url.hostname
    if (exactProviderReference(url)) {
      try {
        const exact = (await settledBeforeDeadline([resolveExactProviderUrl(url, signal, metadataLanguage).then(rows => rows ?? [])], signal))[0]
        if (exact.length) return result(exact, { titles: [exact[0].title], authors: [], type: exact[0].type as MediaPageMetadata['type'] }, source, [], true)
      } catch { /* An unavailable exact ID is not substituted with an unrelated title. */ }
      return result([], { titles: [], authors: [] }, source, ['exact-unavailable'])
    }
    try {
      const page = await fetchPublicPage(url.href, signal)
      metadata = extractMediaPageMetadata(page.html, page.url)
    } catch (error) {
      if (error instanceof PageFetchError && error.code === 'unsafe-url') throw error
      warnings.push(error instanceof PageFetchError ? error.code : 'metadata-unavailable')
      metadata = { titles: [], authors: [] }
    }
    if (!metadata.titles.length) {
      try {
        const parsed = extractQuickImportFromUrl(url.href)
        if (!/^(?:\d+|tt\d+)$/.test(parsed.searchTerm)) metadata.titles = [parsed.searchTerm]
        metadata.type ??= parsed.kind === 'film' ? 'Movie' : parsed.kind === 'series' ? 'TV Series' : parsed.typeHint === 'ANIME' ? 'Anime' : parsed.typeHint === 'MANGA' ? 'Manga' : undefined
      } catch { /* User can always replace the URL with a title. */ }
    }
  }
  if (selectedType) metadata.type = mapCatalogSearchTypeToMediaType(selectedType)
  const terms = identificationSearchTerms(metadata.titles)
  if (!terms.length) return result([], metadata, source, [...warnings, 'no-match'])
  const hint = metadata.type === 'Anime' ? 'ANIME' : ['Manga', 'Manhwa', 'Manhua'].includes(metadata.type ?? '') ? 'MANGA' : null
  const language = /^(zh[-_]?(?:Hant|TW))/i.test(metadata.language ?? '') ? 'zh-TW' : /\p{Script=Cyrillic}/u.test(terms[0]) ? 'ru-RU' : /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(terms[0]) || /^ja/i.test(metadata.language ?? '') ? 'ja-JP' : /\p{Script=Hangul}/u.test(terms[0]) ? 'ko-KR' : /\p{Script=Han}/u.test(terms[0]) ? 'zh-CN' : 'en-US'
  const options = { language, metadataLanguage, pageSize: 8, includeDetails: false, strict: true, signal, onPageInfo: () => {}, ...(metadata.type === 'Manhwa' ? { countryOfOrigin: 'KR' as const } : metadata.type === 'Manhua' ? { countryOfOrigin: 'CN' as const } : {}) }
  const query = terms.slice(0, 1)
  const operations: Array<Promise<CatalogSearchCandidate[]>> = []
  if (!metadata.type || hint) operations.push(searchAniListCandidates(query, hint, options))
  if (!metadata.type || metadata.type === 'Movie') operations.push(searchTmdbCandidatesByType(query, 'movie', options))
  if (!metadata.type || metadata.type === 'TV Series') operations.push(searchTmdbCandidatesByType(query, 'tv', options))
  if (!metadata.type || metadata.type === 'Book') operations.push(searchOpenLibraryCandidates(query, options))
  if ((!metadata.type || hint) && /\p{Script=Cyrillic}/u.test(query[0])) operations.push(searchShikimoriCandidates(query, hint, options))
  const trackFailure = (operation: Promise<CatalogSearchCandidate[]>) => operation.catch(error => { warnings.push('provider-unavailable'); throw error })
  let candidates = (await settledBeforeDeadline(operations.map(trackFailure), signal)).flat()
  const ranked = rankIdentifiedCandidates(candidates, metadata)
  if ((!ranked.length || ranked[0].score < 0.6) && !signal.aborted) {
    const alternate = terms[1] ? [terms[1]] : query
    const fallback: Array<Promise<CatalogSearchCandidate[]>> = []
    if (!metadata.type || hint) {
      fallback.push(searchShikimoriCandidates(alternate, hint, options), searchJikanCandidates(alternate, hint, locale, options), searchKitsuCandidates(alternate, hint, locale, options))
      if (terms[1]) fallback.push(searchAniListCandidates(alternate, hint, options))
    }
    if (terms[1] && metadata.type === 'Movie') fallback.push(searchTmdbCandidatesByType(alternate, 'movie', options))
    if (terms[1] && metadata.type === 'TV Series') fallback.push(searchTmdbCandidatesByType(alternate, 'tv', options))
    if (terms[1] && metadata.type === 'Book') fallback.push(searchOpenLibraryCandidates(alternate, options))
    candidates = [...candidates, ...(await settledBeforeDeadline(fallback.map(trackFailure), signal)).flat()]
  }
  if (!rankIdentifiedCandidates(candidates, metadata).length) warnings.push('no-match')
  if (signal.aborted) warnings.push('provider-unavailable')
  return result(candidates, metadata, source, warnings)
}
