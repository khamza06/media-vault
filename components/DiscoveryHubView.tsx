'use client'

import {
  BookOpenText,
  Clapperboard,
  Filter,
  Grid2X2,
  List,
  LoaderCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tv,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import EmptyVaultState from './EmptyVaultState'
import { getGenreBadgeClass, translateGenre } from '../lib/genres'
import { formatExternalRatingValue, formatProgressValue, type MediaItem } from '../lib/media'
import AppSelect from './ui/AppSelect'

type DiscoveryHubViewProps = {
  availableGenres: string[]
  items: MediaItem[]
  totalCount: number
}

type LayoutMode = 'grid' | 'list'
type SortMode = 'recent' | 'title' | 'rating' | 'year'

type DraftFilters = {
  genres: string[]
  query: string
  ratingMax: number
  ratingMin: number
  status: string
  types: string[]
}

const defaultDraftFilters: DraftFilters = {
  genres: [],
  query: '',
  ratingMax: 10,
  ratingMin: 1,
  status: 'All',
  types: [],
}

const typeOptions = [
  { id: 'Anime', label: 'Anime', icon: Tv },
  { id: 'Manga', label: 'Manga', icon: BookOpenText },
  { id: 'Movie', label: 'Movie', icon: Clapperboard },
  { id: 'Series', label: 'Series', icon: Tv },
] as const

const statusOptions = ['All', 'Reading', 'Watching', 'Completed', 'Planning'] as const
const statusSelectOptions = statusOptions.map((status) => ({
  label: status === 'All' ? 'All statuses' : status,
  value: status,
}))
const sortSelectOptions: Array<{ label: string; value: SortMode }> = [
  { label: 'Recently Updated', value: 'recent' },
  { label: 'Title (A-Z)', value: 'title' },
  { label: 'Rating (High-Low)', value: 'rating' },
  { label: 'Release Year', value: 'year' },
]

export default function DiscoveryHubView({
  availableGenres,
  items,
  totalCount,
}: DiscoveryHubViewProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const activeLayout = getLayoutParam(searchParams.get('view'))
  const activeSort = getSortParam(searchParams.get('sortBy') ?? searchParams.get('sort'))

  const [draftFilters, setDraftFilters] = useState<DraftFilters>(() => readFiltersFromSearchParams(searchParams))

  useEffect(() => {
    setDraftFilters(readFiltersFromSearchParams(searchParams))
  }, [searchParams])

  const activeSummary = useMemo(() => {
    const parts: string[] = []

    if (draftFilters.query.trim()) {
      parts.push(`query: ${draftFilters.query.trim()}`)
    }

    if (draftFilters.types.length > 0) {
      parts.push(`${draftFilters.types.length} types`)
    }

    if (draftFilters.genres.length > 0) {
      parts.push(`${draftFilters.genres.length} genres`)
    }

    if (draftFilters.status !== 'All') {
      parts.push(`status: ${draftFilters.status}`)
    }

    if (draftFilters.ratingMin > 1 || draftFilters.ratingMax < 10) {
      parts.push(`rating: ${draftFilters.ratingMin}-${draftFilters.ratingMax}`)
    }

    return parts.length > 0 ? parts.join(' / ') : 'No filters applied.'
  }, [draftFilters])

  const activeFilterCount = useMemo(() => {
    let count = 0

    if (draftFilters.query.trim()) {
      count += 1
    }

    if (draftFilters.types.length > 0) {
      count += 1
    }

    if (draftFilters.genres.length > 0) {
      count += 1
    }

    if (draftFilters.status !== 'All') {
      count += 1
    }

    if (draftFilters.ratingMin > 1 || draftFilters.ratingMax < 10) {
      count += 1
    }

    return count
  }, [draftFilters])

  function updateDraft<K extends keyof DraftFilters>(key: K, value: DraftFilters[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }))
  }

  function toggleType(type: string) {
    updateDraft(
      'types',
      draftFilters.types.includes(type)
        ? draftFilters.types.filter((entry) => entry !== type)
        : [...draftFilters.types, type]
    )
  }

  function toggleGenre(genre: string) {
    updateDraft(
      'genres',
      draftFilters.genres.includes(genre)
        ? draftFilters.genres.filter((entry) => entry !== genre)
        : [...draftFilters.genres, genre]
    )
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString())

    setParam(params, 'q', draftFilters.query.trim() || null)
    setParam(params, 'types', draftFilters.types.length > 0 ? draftFilters.types.join(',') : null)
    setParam(params, 'genres', draftFilters.genres.length > 0 ? draftFilters.genres.join(',') : null)
    setParam(params, 'status', draftFilters.status !== 'All' ? draftFilters.status : null)
    setParam(params, 'ratingMin', draftFilters.ratingMin > 1 ? String(draftFilters.ratingMin) : null)
    setParam(params, 'ratingMax', draftFilters.ratingMax < 10 ? String(draftFilters.ratingMax) : null)

    const query = params.toString()

    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })

    setIsDrawerOpen(false)
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString())
    setDraftFilters(defaultDraftFilters)
    params.delete('q')
    params.delete('types')
    params.delete('genres')
    params.delete('status')
    params.delete('ratingMin')
    params.delete('ratingMax')

    startTransition(() => {
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false })
    })
    setIsDrawerOpen(false)
  }

  function updateSort(sort: SortMode) {
    const params = new URLSearchParams(searchParams.toString())
    setParam(params, 'sortBy', sort === 'recent' ? null : sort)

    startTransition(() => {
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false })
    })
  }

  function updateLayout(layout: LayoutMode) {
    const params = new URLSearchParams(searchParams.toString())
    setParam(params, 'view', layout === 'grid' ? null : layout)

    startTransition(() => {
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false })
    })
  }

  const filterControls = (
    <div className="space-y-4">
      <section className="glass-panel-soft rounded-xl border border-white/10 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Search className="h-4 w-4 text-blue-300" />
          Search
        </div>
        <input
          type="search"
          value={draftFilters.query}
          onChange={(event) => updateDraft('query', event.target.value)}
          placeholder="Search title, notes..."
          className="min-h-12 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/30"
        />
      </section>

      <section className="glass-panel-soft rounded-xl border border-white/10 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4 text-blue-300" />
          Media Type
        </div>
        <div className="flex flex-wrap gap-2">
          {typeOptions.map((option) => {
            const Icon = option.icon
            const isActive = draftFilters.types.includes(option.id)

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleType(option.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
                  isActive
                    ? 'border-blue-400/30 bg-blue-500/20 text-white shadow-[0_0_18px_rgba(59,130,246,0.18)]'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:border-blue-400/20 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="glass-panel-soft rounded-xl border border-white/10 p-4">
        <div className="mb-3 text-sm font-semibold text-white">Status</div>
        <AppSelect
          ariaLabel="Status filter"
          value={draftFilters.status}
          onValueChange={(value) => updateDraft('status', value)}
          options={statusSelectOptions}
          className="min-h-12 w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/30"
        />
      </section>

      <section className="glass-panel-soft rounded-xl border border-white/10 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Star className="h-4 w-4 text-blue-300" />
          Rating Range
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-4">
          <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
            <span>{draftFilters.ratingMin}</span>
            <span>{draftFilters.ratingMax}</span>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-slate-500">
                Minimum
              </span>
              <input
                type="range"
                min={1}
                max={10}
                value={draftFilters.ratingMin}
                onChange={(event) => {
                  const nextMin = Number(event.target.value)
                  updateDraft('ratingMin', Math.min(nextMin, draftFilters.ratingMax))
                }}
                className="w-full accent-blue-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-slate-500">
                Maximum
              </span>
              <input
                type="range"
                min={1}
                max={10}
                value={draftFilters.ratingMax}
                onChange={(event) => {
                  const nextMax = Number(event.target.value)
                  updateDraft('ratingMax', Math.max(nextMax, draftFilters.ratingMin))
                }}
                className="w-full accent-blue-500"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="glass-panel-soft rounded-xl border border-white/10 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <SlidersHorizontal className="h-4 w-4 text-blue-300" />
          Genre Cloud
        </div>
        {availableGenres.length > 0 ? (
          <div className="flex max-h-[320px] flex-wrap gap-2 overflow-y-auto pr-1">
            {availableGenres.map((genre) => {
              const isActive = draftFilters.genres.includes(genre)

              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className={`rounded-xl border px-3 py-2 text-xs transition ${getGenreBadgeClass(
                    genre
                  )} ${isActive ? 'ring-2 ring-white/25' : 'opacity-90 hover:opacity-100'}`}
                >
                  {translateGenre(genre, 'en')}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No genres available in this library yet.</p>
        )}
      </section>
    </div>
  )

  const filterActions = (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
      <button
        type="button"
        onClick={applyFilters}
        disabled={isPending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(59,130,246,0.28)] transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
        Apply filters
      </button>

      {activeFilterCount > 0 ? (
        <button
          type="button"
          onClick={clearFilters}
          disabled={isPending}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-blue-400/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  )

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/95 shadow-2xl shadow-slate-950/30">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-100">
            Filters
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {activeFilterCount > 0
              ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`
              : 'No filters active'}
          </p>
        </div>
        <Filter className="h-5 w-5 shrink-0 text-blue-300" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {filterControls}
      </div>

      <div className="shrink-0 border-t border-slate-800 bg-slate-900/95 p-4">
        {filterActions}
      </div>
    </div>
  )

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
      <aside className="hidden lg:sticky lg:top-28 lg:block lg:h-[calc(100vh-8rem)] lg:self-start">
        {sidebar}
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="glass-panel-soft flex min-w-0 flex-col gap-4 rounded-xl border border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">
              Showing {items.length} of {totalCount} items found.
            </p>
            <p className="mt-1 text-xs text-slate-400">{activeSummary}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-blue-400/20 hover:bg-white/10 lg:hidden"
            >
              <Filter className="h-4 w-4" />
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>

            <AppSelect
              ariaLabel="Sort results"
              value={activeSort}
              onValueChange={(value) => updateSort(value as SortMode)}
              options={sortSelectOptions}
              className="min-h-11 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white outline-none transition focus:border-blue-400/40 focus:ring-2 focus:ring-blue-500/30"
            />

            <div className="inline-flex overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <button
                type="button"
                onClick={() => updateLayout('grid')}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center px-3 ${
                  activeLayout === 'grid' ? 'bg-blue-500/20 text-white' : 'text-slate-300'
                }`}
                aria-label="Grid view"
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => updateLayout('list')}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center px-3 ${
                  activeLayout === 'list' ? 'bg-blue-500/20 text-white' : 'text-slate-300'
                }`}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {isPending ? (
          <div className="glass-panel-soft flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-white/10">
            <LoaderCircle className="h-8 w-8 animate-spin text-blue-300" />
            <p className="text-sm text-slate-300">Loading filtered results...</p>
          </div>
        ) : items.length === 0 ? (
          <EmptyVaultState message="No titles matched this filter set. Try broadening the search." />
        ) : activeLayout === 'list' ? (
          <div className="space-y-3">
            {items.map((item) => (
              <DiscoveryListCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
            {items.map((item) => (
              <DiscoveryGridCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      <div
        className={`fixed inset-0 z-[1000] bg-slate-950/70 backdrop-blur-sm transition lg:hidden ${
          isDrawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setIsDrawerOpen(false)}
      >
        <aside
          className={`absolute inset-y-0 left-0 flex h-[100dvh] w-[88vw] max-w-sm flex-col bg-slate-950/95 p-4 pb-6 transition-transform ${
            isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Filters</p>
              <p className="text-xs text-slate-400">Fine-tune this library view.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200"
              aria-label="Close filters"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1">{sidebar}</div>
        </aside>
      </div>
    </div>
  )
}

function DiscoveryGridCard({ item }: { item: MediaItem }) {
  return (
    <article className="group">
      <div className="glass-panel-soft relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 transition-all duration-300 group-hover:border-blue-400/30 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.2)]">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">No Cover</div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
            {item.rating ? (
              <span className="shrink-0 rounded-xl border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-100">
                {item.rating}/10
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-300">{[item.type, item.status].filter(Boolean).join(' / ')}</p>
          {item.externalRatingLabel && typeof item.externalRatingValue === 'number' ? (
            <p className="mt-1 text-[11px] font-medium text-blue-200">
              {formatExternalRating(item.externalRatingLabel, item.externalRatingValue)}
            </p>
          ) : null}
        </div>
      </div>

      {item.genres.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.genres.slice(0, 3).map((genre) => (
            <span
              key={genre}
              className={`rounded-xl border px-2 py-1 text-[10px] ${getGenreBadgeClass(genre)}`}
            >
              {translateGenre(genre, 'en')}
            </span>
          ))}
          {item.genres.length > 3 ? (
            <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">
              +{item.genres.length - 3}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function DiscoveryListCard({ item }: { item: MediaItem }) {
  return (
    <article className="glass-panel-soft flex gap-4 rounded-xl border border-white/10 p-4">
      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-900/80">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.title} fill sizes="80px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-slate-500">No Cover</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-lg font-semibold text-white">{item.title}</h3>
          <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300">
            {item.type}
          </span>
          <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300">
            {item.status}
          </span>
          {item.rating ? (
            <span className="rounded-xl border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-100">
              {item.rating}/10
            </span>
          ) : null}
          {item.externalRatingLabel && typeof item.externalRatingValue === 'number' ? (
            <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200">
              {formatExternalRating(item.externalRatingLabel, item.externalRatingValue)}
            </span>
          ) : null}
        </div>

        <p className="mt-2 text-sm text-slate-400">{formatProgressValue(item)}</p>

        {item.genres.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.genres.map((genre) => (
              <span
                key={genre}
                className={`rounded-xl border px-2 py-1 text-[10px] ${getGenreBadgeClass(genre)}`}
              >
                {translateGenre(genre, 'en')}
              </span>
            ))}
          </div>
        ) : null}

        {item.notes ? <p className="mt-3 line-clamp-2 text-sm text-slate-300">{item.notes}</p> : null}
      </div>
    </article>
  )
}

function readFiltersFromSearchParams(searchParams: ReturnType<typeof useSearchParams>): DraftFilters {
  const parsedRatingMin = getRatingParam(searchParams.get('ratingMin'), 1)
  const parsedRatingMax = getRatingParam(searchParams.get('ratingMax'), 10)
  const ratingMin = Math.min(parsedRatingMin, parsedRatingMax)
  const ratingMax = Math.max(parsedRatingMin, parsedRatingMax)

  return {
    genres: parseCsvParam(searchParams.get('genres')),
    query: searchParams.get('q') ?? '',
    ratingMax,
    ratingMin,
    status: getStatusParam(searchParams.get('status')),
    types: parseCsvParam(searchParams.get('types')),
  }
}

function getRatingParam(value: string | null, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(10, Math.max(1, Math.round(parsed)))
}

function parseCsvParam(value: string | null) {
  if (!value) {
    return [] as string[]
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function getStatusParam(value: string | null) {
  return statusOptions.includes((value ?? 'All') as (typeof statusOptions)[number])
    ? (value ?? 'All')
    : 'All'
}

function getSortParam(value: string | null): SortMode {
  if (value === 'title' || value === 'rating' || value === 'year') {
    return value
  }

  return 'recent'
}

function getLayoutParam(value: string | null): LayoutMode {
  return value === 'list' ? 'list' : 'grid'
}

function setParam(params: URLSearchParams, key: string, value: string | null) {
  if (!value) {
    params.delete(key)
  } else {
    params.set(key, value)
  }
}

function formatExternalRating(label: string, value: number) {
  return formatExternalRatingValue(label, value)
}



