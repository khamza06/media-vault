'use client'

import { ChevronDown, Filter, X } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

import {
  defaultLibraryFilters,
  hasActiveLibraryFilters,
  libraryCoverOptions,
  libraryRatingOptions,
  librarySortOptions,
  librarySourceOptions,
  libraryStatusOptions,
  libraryTypeOptions,
  type LibraryCoverFilter,
  type LibraryFilters,
  type LibraryRatingFilter,
  type LibrarySortMode,
  type LibrarySourceFilter,
} from '../lib/library-filters'
import AppSelect from './ui/AppSelect'

type LibraryFilterControlsProps = {
  actions?: ReactNode
  filters: LibraryFilters
  onChange: (filters: LibraryFilters) => void
  showSourceFilter: boolean
  showTypeFilter?: boolean
  totalCount: number
  visibleCount: number
}

const controlClassName =
  'min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30'

export default function LibraryFilterControls({
  actions,
  filters,
  onChange,
  showSourceFilter,
  showTypeFilter = true,
  totalCount,
  visibleCount,
}: LibraryFilterControlsProps) {
  const hasActiveFilters = hasActiveLibraryFilters(filters)
  const advancedId = useId()
  const [showAdvanced, setShowAdvanced] = useState(
    filters.cover !== 'all' || filters.rating !== 'all' || filters.source !== 'all' || filters.sort !== 'created-desc'
  )
  const activeChips = [
    { key: 'query' as const, label: filters.query.trim() ? `Search: ${filters.query}` : null },
    ...([
      ['type', libraryTypeOptions],
      ['status', libraryStatusOptions],
      ['cover', libraryCoverOptions],
      ['rating', libraryRatingOptions],
      ['source', librarySourceOptions],
      ['sort', librarySortOptions],
    ] as const).map(([key, options]) => ({
      key,
      label: filters[key] !== defaultLibraryFilters[key]
        ? options.find((option) => option.value === filters[key])?.label ?? null
        : null,
    })),
  ].filter((chip) => chip.label)

  function updateFilters(nextFilters: Partial<LibraryFilters>) {
    onChange({
      ...filters,
      ...nextFilters,
    })
  }

  function clearFilters() {
    onChange(defaultLibraryFilters)
  }

  return (
    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-100">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-blue-200">
            <Filter className="h-4 w-4" />
          </span>
          <span>Library filters</span>
        </div>
        <div className="flex min-w-0 flex-col gap-2 text-sm text-slate-400 sm:flex-row sm:items-center">
          <span>
            Showing <span className="font-semibold text-slate-100">{visibleCount}</span> of{' '}
            <span className="font-semibold text-slate-100">{totalCount}</span> items
          </span>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className={`mt-4 grid min-w-0 grid-cols-2 gap-3 ${showTypeFilter ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <label className="col-span-2 min-w-0 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Search
          </span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => updateFilters({ query: event.target.value })}
            placeholder="Search title, notes, genres..."
            className={controlClassName}
          />
        </label>

        {showTypeFilter ? (
          <label className="min-w-0 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Type</span>
            <AppSelect
              ariaLabel="Type filter"
              value={filters.type}
              onValueChange={(type) => updateFilters({ type })}
              options={libraryTypeOptions}
              className={controlClassName}
            />
          </label>
        ) : null}

        <label className="min-w-0 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Status
          </span>
          <AppSelect
            ariaLabel="Status filter"
            value={filters.status}
            onValueChange={(value) => updateFilters({ status: value })}
            options={libraryStatusOptions}
            className={controlClassName}
          />
        </label>

      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        aria-expanded={showAdvanced}
        aria-controls={advancedId}
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-blue-200 hover:text-white focus-visible:outline-2 focus-visible:outline-blue-400"
      >
        Advanced filters
        <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
      </button>
      {actions}
      </div>
      <div id={advancedId} hidden={!showAdvanced}>
        <div className="mt-2 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">

        <label className="min-w-0 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Cover
          </span>
          <AppSelect
            ariaLabel="Cover filter"
            value={filters.cover}
            onValueChange={(value) => updateFilters({ cover: value as LibraryCoverFilter })}
            options={libraryCoverOptions}
            className={controlClassName}
          />
        </label>

        {showSourceFilter ? (
          <label className="min-w-0 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Source
            </span>
            <AppSelect
              ariaLabel="Source filter"
              value={filters.source}
              onValueChange={(value) => updateFilters({ source: value as LibrarySourceFilter })}
              options={librarySourceOptions}
              className={controlClassName}
            />
          </label>
        ) : null}

        <label className="min-w-0 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Rating
          </span>
          <AppSelect
            ariaLabel="Rating filter"
            value={filters.rating}
            onValueChange={(value) => updateFilters({ rating: value as LibraryRatingFilter })}
            options={libraryRatingOptions}
            className={controlClassName}
          />
        </label>

        <label className="min-w-0 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Sort
          </span>
          <AppSelect
            ariaLabel="Sort library"
            value={filters.sort}
            onValueChange={(value) => updateFilters({ sort: value as LibrarySortMode })}
            options={librarySortOptions}
            className={controlClassName}
          />
        </label>
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div className="mt-3 flex min-w-0 flex-wrap gap-2" aria-label="Active filters">
          {activeChips.map((chip) => (
            <button key={chip.key} type="button" onClick={() => updateFilters({ [chip.key]: defaultLibraryFilters[chip.key] })} aria-label={`Remove ${chip.label} filter`} className="inline-flex max-w-full min-h-9 items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 text-left text-xs font-medium text-blue-100 hover:border-blue-400/50 focus-visible:outline-2 focus-visible:outline-blue-400">
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{chip.label}</span><X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
