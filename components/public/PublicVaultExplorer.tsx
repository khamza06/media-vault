'use client'

import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import PublicLibraryGrid from '../PublicLibraryGrid'
import type { MediaItem } from '../../lib/media'
import AppSelect from '../ui/AppSelect'

type RatingFilter = 'all' | 'rated' | 'unrated' | '9plus' | '8plus' | '7plus'
type SortMode = 'recent' | 'title-asc' | 'rating-desc' | 'status'

type PublicVaultExplorerProps = {
  items: MediaItem[]
}

const controlClassName =
  'min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30'

const ratingOptions: Array<{ label: string; value: RatingFilter }> = [
  { label: 'All ratings', value: 'all' },
  { label: 'Rated', value: 'rated' },
  { label: 'Unrated', value: 'unrated' },
  { label: '9+', value: '9plus' },
  { label: '8+', value: '8plus' },
  { label: '7+', value: '7plus' },
]

const sortOptions: Array<{ label: string; value: SortMode }> = [
  { label: 'Recently added', value: 'recent' },
  { label: 'Title A-Z', value: 'title-asc' },
  { label: 'Highest rating', value: 'rating-desc' },
  { label: 'Status', value: 'status' },
]

export default function PublicVaultExplorer({ items }: PublicVaultExplorerProps) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('recent')

  const typeOptions = useMemo(() => getUniqueOptions(items.map((item) => item.type)), [items])
  const statusOptions = useMemo(() => getUniqueOptions(items.map((item) => item.status)), [items])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const nextItems = items.filter((item) => {
      if (normalizedQuery) {
        const haystack = [item.title, item.type, item.status, ...item.genres]
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(normalizedQuery)) {
          return false
        }
      }

      if (typeFilter !== 'all' && item.type !== typeFilter) {
        return false
      }

      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false
      }

      return matchesRatingFilter(item.rating, ratingFilter)
    })

    return sortPublicItems(nextItems, sortMode)
  }, [items, query, ratingFilter, sortMode, statusFilter, typeFilter])

  const hasActiveFilters =
    query.trim().length > 0 ||
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    ratingFilter !== 'all' ||
    sortMode !== 'recent'

  function clearFilters() {
    setQuery('')
    setTypeFilter('all')
    setStatusFilter('all')
    setRatingFilter('all')
    setSortMode('recent')
  }

  return (
    <section className="min-w-0 space-y-5">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
              <SlidersHorizontal className="h-4 w-4" />
              Public Vault
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Showing <span className="font-semibold text-slate-100">{filteredItems.length}</span>{' '}
              of <span className="font-semibold text-slate-100">{items.length}</span> public items
            </p>
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Search
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search public titles, types, statuses, genres..."
                className={`${controlClassName} pl-11`}
              />
            </div>
          </label>

          <label className="min-w-0 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Type
            </span>
            <AppSelect
              ariaLabel="Type filter"
              value={typeFilter}
              onValueChange={setTypeFilter}
              options={[
                { label: 'All types', value: 'all' },
                ...typeOptions.map((type) => ({ label: type, value: type })),
              ]}
              className={controlClassName}
            />
          </label>

          <label className="min-w-0 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Status
            </span>
            <AppSelect
              ariaLabel="Status filter"
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { label: 'All statuses', value: 'all' },
                ...statusOptions.map((status) => ({ label: status, value: status })),
              ]}
              className={controlClassName}
            />
          </label>

          <label className="min-w-0 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Rating
            </span>
            <AppSelect
              ariaLabel="Rating filter"
              value={ratingFilter}
              onValueChange={(value) => setRatingFilter(value as RatingFilter)}
              options={ratingOptions}
              className={controlClassName}
            />
          </label>

          <label className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Sort
            </span>
            <AppSelect
              ariaLabel="Sort public vault"
              value={sortMode}
              onValueChange={(value) => setSortMode(value as SortMode)}
              options={sortOptions}
              className={controlClassName}
            />
          </label>
        </div>
      </div>

      <PublicLibraryGrid
        emptyMessage={
          items.length === 0 ? 'No public items yet.' : 'No items match these filters.'
        }
        items={filteredItems}
      />
    </section>
  )
}

function getUniqueOptions(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  )
}

function matchesRatingFilter(rating: number | null, filter: RatingFilter) {
  switch (filter) {
    case 'rated':
      return typeof rating === 'number'
    case 'unrated':
      return typeof rating !== 'number'
    case '9plus':
      return typeof rating === 'number' && rating >= 9
    case '8plus':
      return typeof rating === 'number' && rating >= 8
    case '7plus':
      return typeof rating === 'number' && rating >= 7
    case 'all':
    default:
      return true
  }
}

function sortPublicItems(items: MediaItem[], sortMode: SortMode) {
  const copy = [...items]

  switch (sortMode) {
    case 'title-asc':
      return copy.sort((left, right) => left.title.localeCompare(right.title))
    case 'rating-desc':
      return copy.sort((left, right) => {
        const leftRating = typeof left.rating === 'number' ? left.rating : -1
        const rightRating = typeof right.rating === 'number' ? right.rating : -1
        return rightRating - leftRating || left.title.localeCompare(right.title)
      })
    case 'status':
      return copy.sort(
        (left, right) =>
          left.status.localeCompare(right.status) || left.title.localeCompare(right.title)
      )
    case 'recent':
    default:
      return copy.sort(
        (left, right) =>
          getTimestamp(right.createdAt) - getTimestamp(left.createdAt) ||
          left.title.localeCompare(right.title)
      )
  }
}

function getTimestamp(value: string | null) {
  if (!value) {
    return 0
  }

  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}
