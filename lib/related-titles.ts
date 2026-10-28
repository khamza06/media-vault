export type RelatedTitle = {
  id: number
  title: string
  type: 'Anime' | 'Manga'
  relation: string
  coverUrl: string | null
  url: string
}

const labels: Record<string, string> = {
  ADAPTATION: 'Adaptation', PREQUEL: 'Prequel', SEQUEL: 'Sequel', PARENT: 'Parent story',
  SIDE_STORY: 'Side story', CHARACTER: 'Shared character', SUMMARY: 'Summary', ALTERNATIVE: 'Alternative version',
  SPIN_OFF: 'Spin-off', OTHER: 'Related', SOURCE: 'Source material', COMPILATION: 'Compilation',
  CONTAINS: 'Contains', SAME_UNIVERSE: 'Same universe',
}
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function safeCover(value: unknown) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null
  } catch { return null }
}

export function normalizeAniListRelations(value: unknown, currentId: number): RelatedTitle[] {
  if (!record(value) || !Array.isArray(value.edges)) return []
  const result: RelatedTitle[] = []
  const seen = new Set<number>()
  for (const edge of value.edges) {
    if (!record(edge) || !record(edge.node)) continue
    const node = edge.node
    const id = node.id
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1 || id > 2147483647 || id === currentId || seen.has(id)) continue
    if ((node.type !== 'ANIME' && node.type !== 'MANGA') || node.isAdult !== false) continue
    if (typeof edge.relationType !== 'string' || !Object.hasOwn(labels, edge.relationType)) continue
    const titles = record(node.title) ? node.title : {}
    const title = (text(titles.english) || text(titles.romaji) || text(titles.native)).slice(0, 300)
    if (!title) continue
    const cover = record(node.coverImage) ? node.coverImage : {}
    const type = node.type === 'ANIME' ? 'Anime' : 'Manga'
    result.push({ id, title, type, relation: labels[edge.relationType], coverUrl: safeCover(cover.large) ?? safeCover(cover.extraLarge), url: `https://anilist.co/${type.toLowerCase()}/${id}` })
    seen.add(id)
    if (result.length === 24) break
  }
  return result
}

export function getRelatedDiscoverHref(title: Pick<RelatedTitle, 'title' | 'type'>) {
  const query = title.title.trim().slice(0, 200)
  if (query.length < 3) return null
  return `/discover?${new URLSearchParams({ q: query, type: title.type.toLowerCase() })}`
}
