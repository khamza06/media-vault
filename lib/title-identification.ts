import { transliterate } from 'transliteration'
import type { CatalogSearchCandidate } from './catalog-types'
import type { MediaPageMetadata } from './media-page-metadata'
import { cleanMediaTitle } from './media-page-metadata'

export function normalizeMediaTitle(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('en').replace(/ё/g, 'е')
    .normalize('NFD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFC')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim().replace(/\s+/g, ' ')
}

function titleSimilarity(left: string, right: string) {
  const a = normalizeMediaTitle(left), b = normalizeMediaTitle(right)
  if (!a || !b) return 0
  if (a === b || a.replaceAll(' ', '') === b.replaceAll(' ', '')) return 1
  const latinA = normalizeMediaTitle(transliterate(a)), latinB = normalizeMediaTitle(transliterate(b))
  if (latinA && latinA === latinB) return 0.88
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * 0.85
  const tokensA = new Set(a.split(' ')), tokensB = new Set(b.split(' '))
  const shared = [...tokensA].filter(token => tokensB.has(token)).length
  return shared / Math.max(tokensA.size, tokensB.size) * 0.75
}

export function identificationSearchTerms(titles: string[]) {
  const originals = [...new Set(titles.map(cleanMediaTitle).filter(title => title.length >= 2 && title.length <= 200))].slice(0, 2)
  // Transliteration is a supplementary hint, not a translation or evidence of identity.
  const latin = originals[0] && /[^\x00-\x7f]/.test(originals[0]) ? transliterate(originals[0]) : ''
  return [...new Set([...originals, ...(latin.length >= 2 && latin.length <= 200 ? [latin] : [])])].slice(0, 3)
}

export function rankIdentifiedCandidates(candidates: CatalogSearchCandidate[], evidence: MediaPageMetadata, exact = false) {
  const distinct = [...new Map(candidates.filter(candidate => !candidate.isAdult).map(candidate => [candidate.id, candidate])).values()]
  const ranked = distinct.map(candidate => {
    const similarity = Math.max(0, ...evidence.titles.flatMap(title => [candidate.title, ...(candidate.alternativeTitles ?? [])].map(alias => titleSimilarity(title, alias))))
    const typeMatch = evidence.type === candidate.type
    const mangaFamily = ['Manga', 'Manhwa', 'Manhua']
    const typeConflict = evidence.type && !typeMatch && !(mangaFamily.includes(evidence.type) && mangaFamily.includes(candidate.type))
    const yearMatch = Boolean(evidence.year && candidate.year === evidence.year)
    const yearConflict = Boolean(evidence.year && candidate.year && !yearMatch)
    const authorMatch = Boolean(evidence.authors.length && candidate.authors?.some(author => evidence.authors.some(name => titleSimilarity(author, name) >= 0.85)))
    const signals: string[] = exact ? ['exact-id'] : [similarity >= 0.98 ? 'title-exact' : similarity >= 0.75 ? 'title-close' : 'title-weak']
    if (typeMatch) signals.push('type')
    if (yearMatch) signals.push('year')
    if (authorMatch) signals.push('author')
    const score = exact ? 1 : Math.max(0, Math.min(0.99, similarity * 0.72 + (typeMatch ? 0.12 : 0) + (yearMatch ? 0.1 : 0) + (authorMatch ? 0.1 : 0) - (typeConflict ? 0.35 : 0) - (yearConflict ? 0.18 : 0)))
    const confidence = exact ? 'exact' : score >= 0.86 && similarity >= 0.98 && !typeConflict && !yearConflict ? 'high' : score >= 0.6 ? 'possible' : 'low'
    return { ...candidate, identification: { confidence, score, signals }, score } as CatalogSearchCandidate
  }).filter(candidate => exact || candidate.score >= 0.3).sort((a, b) => b.score - a.score)
  // Same-title remakes/editions stay separate and are never presented as certain.
  return ranked.slice(0, 8).map(candidate => {
    if (!exact && ranked.some(other => other.id !== candidate.id && Math.abs(other.score - candidate.score) < 0.04)) {
      return { ...candidate, identification: { ...candidate.identification!, confidence: candidate.identification?.confidence === 'high' ? 'possible' as const : candidate.identification!.confidence } }
    }
    return candidate
  })
}
