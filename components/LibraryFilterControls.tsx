'use client'

import { Filter, X } from 'lucide-react'

import {
  defaultLibraryFilters,
  hasActiveLibraryFilters,
  libraryCoverOptions,
  libraryRatingOptions,
  librarySortOptions,
  librarySourceOptions,
  libraryStatusOptions,
  type LibraryCoverFilter,
  type LibraryFilters,
  type LibraryRatingFilter,
  type LibrarySortMode,
  type LibrarySourceFilter,
} from '../lib/library-filters'

type LibraryFilterControlsProps = {
  filters: LibraryFilters
  onChange: (filters: LibraryFilters) => void
  showSourceFilter: boolean
  totalCount: number
  visibleCount: number
}

const controlClassName =
  'min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30'

export default function LibraryFilterControls({
  filters,
  onChange,
  showSourceFilter,
  totalCount,
  visibleCount,
}: LibraryFilterControlsProps) {
  const hasActiveFilters = hasActiveLibraryFilters(filters)

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

      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="min-w-0 space-y-2 sm:col-span-2 xl:col-span-2">
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

        <label className="min-w-0 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Status
          </span>
          <select
            value={filters.status}
            onChange={(event) => updateFilters({ status: event.target.value })}
            className={controlClassName}
          >
            {libraryStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Cover
          </span>
          <select
            value={filters.cover}
            onChange={(event) =>
              updateFilters({ cover: event.target.value as LibraryCoverFilter })
            }
            className={controlClassName}
          >
            {libraryCoverOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {showSourceFilter ? (
          <label className="min-w-0 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Source
            </span>
            <select
              value={filters.source}
              onChange={(event) =>
                updateFilters({ source: event.target.value as LibrarySourceFilter })
              }
              className={controlClassName}
            >
              {librarySourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="min-w-0 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Rating
          </span>
          <select
            value={filters.rating}
            onChange={(event) =>
              updateFilters({ rating: event.target.value as LibraryRatingFilter })
            }
            className={controlClassName}
          >
            {libraryRatingOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Sort
          </span>
          <select
            value={filters.sort}
            onChange={(event) => updateFilters({ sort: event.target.value as LibrarySortMode })}
            className={controlClassName}
          >
            {librarySortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}
