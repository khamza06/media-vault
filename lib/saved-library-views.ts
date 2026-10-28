import { getLibraryFiltersFromSearchParams, writeLibraryFiltersToSearchParams, type LibraryFilters } from './library-filters'
import type { MediaItem } from './media'
import { getShelfDefinitionBySlug } from './shelves'

export type SavedLibraryView = {
  id: string
  name: string
  pathname: string
  filters: LibraryFilters
  favoritesOnly: boolean
}
export type SavedLibraryViewInput = Omit<SavedLibraryView, 'id'>
const paramFields = { query: 'q', type: 'type', status: 'status', cover: 'cover', rating: 'rating', source: 'source', sort: 'sort' } as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isLibraryViewPath(path: unknown): path is string {
  if (path === '/') return true
  return typeof path === 'string' && /^\/shelves\/[a-z-]+$/.test(path)
    && !!getShelfDefinitionBySlug(path.slice('/shelves/'.length))
}

export function normalizeSavedView(input: unknown, id: string): SavedLibraryView | null {
  if (!isRecord(input) || typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 60
    || !isLibraryViewPath(input.pathname) || !isRecord(input.filters)
    || !/^[a-z0-9-]{1,80}$/i.test(id)) return null
  const params = new URLSearchParams()
  for (const [field, param] of Object.entries(paramFields)) {
    const value = input.filters[field]
    if (typeof value === 'string') params.set(param, value)
  }
  if ((params.get('q')?.length ?? 0) > 300) return null
  return { id, name: input.name.trim(), pathname: input.pathname,
    filters: getLibraryFiltersFromSearchParams(params), favoritesOnly: input.favoritesOnly === true }
}

export function parseSavedLibraryViews(value: unknown): SavedLibraryView[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  const names = new Set<string>()
  const result: SavedLibraryView[] = []
  for (const candidate of value.slice(0, 12)) {
    const view = isRecord(candidate) && typeof candidate.id === 'string' ? normalizeSavedView(candidate, candidate.id) : null
    const name = view?.name.toLocaleLowerCase('en-US')
    if (!view || !name || ids.has(view.id) || names.has(name)) continue
    result.push(view); ids.add(view.id); names.add(name)
  }
  return result
}

export function getSavedLibraryViewHref(view: SavedLibraryView) {
  const params = writeLibraryFiltersToSearchParams(new URLSearchParams(), view.filters)
  if (view.favoritesOnly) params.set('favorites', '1')
  const query = params.toString()
  return query ? `${view.pathname}?${query}` : view.pathname
}

export function pickPlanningItem(items: readonly MediaItem[], random = Math.random) {
  const pool = items.filter((item) => item.status.trim().toLowerCase() === 'planning')
  if (pool.length === 0) return null
  const value = random()
  const index = Number.isFinite(value) ? Math.max(0, Math.min(pool.length - 1, Math.floor(value * pool.length))) : 0
  return pool[index]
}
