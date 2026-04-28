'use client'

import { Check, Plus } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { deleteItemsBulkAction, incrementProgressAction } from '../app/actions/items'
import { BulkDeleteConfirmDialog, BulkSelectionToolbar } from './BulkSelectionControls'
import DeleteItemButton from './DeleteItemButton'
import EmptyVaultState from './EmptyVaultState'
import FavoriteToggleButton from './FavoriteToggleButton'
import { getGenreBadgeClass, translateGenre } from '../lib/genres'
import { useLocale } from './LocaleProvider'
import { useToast } from './ToastProvider'
import { translateStatus, translateType } from '../lib/i18n'
import type { MediaItem } from '../lib/media'
import { formatProgressValue, mediaStatuses, mediaTypes } from '../lib/media'
import { mediaCardGridClassName } from '../lib/media-card-grid'
import AppSelect from './ui/AppSelect'

type MediaLibraryProps = {
  items: MediaItem[]
}

type LibraryShelf = 'focus' | 'archive'
type SortMode = 'newest' | 'title-asc' | 'title-desc' | 'rating-desc' | 'progress-desc'

const focusStatuses = new Set(['Planning', 'Watching', 'Reading'])
const archiveStatuses = new Set(['Completed', 'Dropped'])

export default function MediaLibrary({ items }: MediaLibraryProps) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const copy = getLibraryCopy()

  const [liveItems, setLiveItems] = useState(items)
  const [activeAccent, setActiveAccent] = useState<string | null>(null)
  const [progressBusyIds, setProgressBusyIds] = useState<Record<string, boolean>>({})
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)
  const accentCacheRef = useRef(new Map<string, string>())

  const currentQuery = searchParams.toString()
  const selectedShelf = getShelfParam(searchParams.get('shelf'))
  const selectedStatus = getStatusParam(searchParams.get('status'))
  const selectedType = getTypeParam(searchParams.get('type'))
  const selectedGenre = searchParams.get('genre')?.trim() ?? ''
  const favoritesOnly = searchParams.get('favorites') === '1'
  const searchQuery = searchParams.get('q') ?? ''
  const sortBy = getSortParam(searchParams.get('sort'))
  const deferredQuery = useDeferredValue(searchQuery)
  const sortOptions = [
    { label: t('library.sort.newest'), value: 'newest' },
    { label: t('library.sort.titleAsc'), value: 'title-asc' },
    { label: t('library.sort.titleDesc'), value: 'title-desc' },
    { label: t('library.sort.ratingDesc'), value: 'rating-desc' },
    { label: t('library.sort.progressDesc'), value: 'progress-desc' },
  ]

  useEffect(() => {
    setLiveItems(items)
  }, [items])

  useEffect(() => {
    setSelectedIds((current) => {
      const validIds = new Set(items.map((item) => item.id))
      const next = new Set([...current].filter((id) => validIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [items])

  useEffect(() => {
    const root = document.documentElement

    if (activeAccent) {
      root.style.setProperty('--vault-accent-rgb', activeAccent)
    } else {
      root.style.removeProperty('--vault-accent-rgb')
    }

    return () => {
      root.style.removeProperty('--vault-accent-rgb')
    }
  }, [activeAccent])

  const shelfCounts = useMemo(
    () =>
      liveItems.reduce(
        (counts, item) => {
          if (focusStatuses.has(item.status)) {
            counts.focus += 1
          } else if (archiveStatuses.has(item.status)) {
            counts.archive += 1
          }

          return counts
        },
        { focus: 0, archive: 0 }
      ),
    [liveItems]
  )

  const shelfItems = useMemo(
    () =>
      liveItems.filter((item) =>
        selectedShelf === 'focus' ? focusStatuses.has(item.status) : archiveStatuses.has(item.status)
      ),
    [liveItems, selectedShelf]
  )

  const statusOptions = useMemo(
    () =>
      mediaStatuses.filter((status) =>
        selectedShelf === 'focus' ? focusStatuses.has(status) : archiveStatuses.has(status)
      ),
    [selectedShelf]
  )

  const favoritesCount = useMemo(
    () => shelfItems.filter((item) => item.favorite).length,
    [shelfItems]
  )

  const typeCounts = useMemo(
    () =>
      shelfItems.reduce<Record<string, number>>((counts, item) => {
        counts[item.type] = (counts[item.type] ?? 0) + 1
        return counts
      }, {}),
    [shelfItems]
  )

  const statusCounts = useMemo(
    () =>
      shelfItems.reduce<Record<string, number>>((counts, item) => {
        counts[item.status] = (counts[item.status] ?? 0) + 1
        return counts
      }, {}),
    [shelfItems]
  )

  const genreCounts = useMemo(
    () =>
      shelfItems.reduce<Record<string, number>>((counts, item) => {
        for (const genre of item.genres) {
          counts[genre] = (counts[genre] ?? 0) + 1
        }
        return counts
      }, {}),
    [shelfItems]
  )

  const topGenres = useMemo(
    () =>
      Object.entries(genreCounts)
        .sort((left, right) => {
          if (right[1] !== left[1]) {
            return right[1] - left[1]
          }

          return left[0].localeCompare(right[0], 'en')
        })
        .slice(0, 12),
    [genreCounts]
  )

  const hasActiveFilters =
    selectedStatus !== 'All' ||
    selectedType !== 'All' ||
    selectedGenre.length > 0 ||
    favoritesOnly ||
    sortBy !== 'newest' ||
    searchQuery.length > 0

  const filteredItems = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase()
    const nextItems = shelfItems.filter((item) => {
      const matchesStatus = selectedStatus === 'All' || item.status === selectedStatus
      const matchesType = selectedType === 'All' || item.type === selectedType
      const matchesGenre = selectedGenre.length === 0 || item.genres.includes(selectedGenre)
      const matchesFavorites = !favoritesOnly || item.favorite
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.type.toLowerCase().includes(normalizedQuery) ||
        item.genres.some((genre) => genre.toLowerCase().includes(normalizedQuery)) ||
        item.notes?.toLowerCase().includes(normalizedQuery) === true

      return matchesStatus && matchesType && matchesGenre && matchesFavorites && matchesQuery
    })

    nextItems.sort((left, right) => {
      switch (sortBy) {
        case 'title-asc':
          return left.title.localeCompare(right.title)
        case 'title-desc':
          return right.title.localeCompare(left.title)
        case 'rating-desc':
          return (right.rating ?? 0) - (left.rating ?? 0)
        case 'progress-desc':
          return right.progress - left.progress
        case 'newest':
        default:
          return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime()
      }
    })

    return nextItems
  }, [
    deferredQuery,
    favoritesOnly,
    selectedGenre,
    selectedStatus,
    selectedType,
    shelfItems,
    sortBy,
  ])

  function updateQueryString(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())

    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function resetFilters() {
    const params = new URLSearchParams()

    if (selectedShelf === 'archive') {
      params.set('shelf', 'archive')
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  function startSelectionMode() {
    setBulkDeleteError(null)
    setSelectionMode(true)
  }

  function cancelSelectionMode() {
    setBulkDeleteError(null)
    setIsBulkDeleteOpen(false)
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  function selectAllVisible() {
    setSelectedIds(new Set(filteredItems.map((item) => item.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function confirmBulkDelete() {
    const ids = [...selectedIds]

    if (ids.length === 0) {
      return
    }

    setIsBulkDeleting(true)
    setBulkDeleteError(null)

    const result = await deleteItemsBulkAction(ids)

    setIsBulkDeleting(false)

    if (!result.success) {
      setBulkDeleteError(result.error ?? 'Failed to delete selected items.')
      showToast(result.error ?? 'Failed to delete selected items.', 'error')
      return
    }

    const deletedIds = new Set(ids)
    setLiveItems((current) => current.filter((item) => !deletedIds.has(item.id)))
    setSelectedIds(new Set())
    setSelectionMode(false)
    setIsBulkDeleteOpen(false)
    showToast(
      result.failed > 0
        ? `Deleted ${result.deleted} items. ${result.failed} were skipped.`
        : `Deleted ${result.deleted} items.`
    )
    router.refresh()
  }

  function switchShelf(nextShelf: LibraryShelf) {
    const params = new URLSearchParams()

    if (nextShelf === 'archive') {
      params.set('shelf', 'archive')
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  async function resolveAccent(imageUrl: string | null) {
    if (!imageUrl) {
      setActiveAccent(null)
      return
    }

    const cached = accentCacheRef.current.get(imageUrl)
    if (cached) {
      setActiveAccent(cached)
      return
    }

    try {
      const accent = await extractCoverAccent(imageUrl)

      if (!accent) {
        return
      }

      accentCacheRef.current.set(imageUrl, accent)
      setActiveAccent(accent)
    } catch {
      setActiveAccent(null)
    }
  }

  async function handleIncrementProgress(item: MediaItem) {
    const nextProgress =
      typeof item.totalProgress === 'number' && item.totalProgress > 0
        ? Math.min(item.progress + 1, item.totalProgress)
        : item.progress + 1

    if (nextProgress === item.progress) {
      return
    }

    setProgressBusyIds((current) => ({ ...current, [item.id]: true }))
    setLiveItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, progress: nextProgress } : candidate
      )
    )

    const result = await incrementProgressAction(item.id)

    setProgressBusyIds((current) => {
      const next = { ...current }
      delete next[item.id]
      return next
    })

    if (result.success) {
      showToast(`Progress updated: ${item.title}`)
      return
    }

    setLiveItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, progress: item.progress } : candidate
      )
    )
    showToast(result.error ?? 'Failed to update progress.', 'error')
  }

  return (
    <>
      <section className="mb-8 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75">
              {copy.eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              {selectedShelf === 'focus' ? copy.focusTitle : copy.archiveTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {selectedShelf === 'focus' ? copy.focusDescription : copy.archiveDescription}
            </p>
          </div>
        </div>

        <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
          <FilterButton
            label={copy.focusShelf}
            isActive={selectedShelf === 'focus'}
            count={shelfCounts.focus}
            onClick={() => switchShelf('focus')}
          />
          <FilterButton
            label={copy.archiveShelf}
            isActive={selectedShelf === 'archive'}
            count={shelfCounts.archive}
            onClick={() => switchShelf('archive')}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="block">
            <span className="sr-only">{copy.searchLabel}</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) =>
                updateQueryString({
                  q: event.target.value.trim().length > 0 ? event.target.value : null,
                })
              }
              placeholder={t('library.searchPlaceholder')}
              className="glass-panel-soft min-h-14 w-full rounded-[24px] px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
            />
          </label>

          <label className="block">
            <span className="sr-only">{copy.sortLabel}</span>
            <AppSelect
              ariaLabel={copy.sortLabel}
              value={sortBy}
              onValueChange={(value) =>
                updateQueryString({
                  sort: value === 'newest' ? null : value,
                })
              }
              options={sortOptions}
              className="glass-panel-soft min-h-14 w-full rounded-[24px] px-4 py-3 text-white outline-none transition focus:border-blue-400/40"
            />
          </label>
        </div>

        <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
          <FilterButton
            label={t('library.favoritesOnly')}
            isActive={favoritesOnly}
            count={favoritesCount}
            onClick={() => updateQueryString({ favorites: favoritesOnly ? null : '1' })}
          />
          <FilterButton
            label={t('library.all')}
            isActive={selectedStatus === 'All'}
            count={shelfItems.length}
            onClick={() => updateQueryString({ status: null })}
          />
          {statusOptions.map((status) => (
            <FilterButton
              key={status}
              label={translateStatus('en', status)}
              isActive={selectedStatus === status}
              count={statusCounts[status] ?? 0}
              onClick={() => updateQueryString({ status })}
            />
          ))}
        </div>

        <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
          <FilterButton
            label={t('library.allTypes')}
            isActive={selectedType === 'All'}
            count={shelfItems.length}
            onClick={() => updateQueryString({ type: null })}
          />
          {mediaTypes.map((type) => (
            <FilterButton
              key={type}
              label={translateType('en', type)}
              isActive={selectedType === type}
              count={typeCounts[type] ?? 0}
              onClick={() => updateQueryString({ type })}
            />
          ))}
        </div>

        {topGenres.length > 0 ? (
          <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
            <FilterButton
              label={t('library.allGenres')}
              isActive={selectedGenre.length === 0}
              count={Object.keys(genreCounts).length}
              onClick={() => updateQueryString({ genre: null })}
            />
            {topGenres.map(([genre, count]) => (
              <FilterButton
                key={genre}
                label={genre}
                isActive={selectedGenre === genre}
                count={count}
                onClick={() => updateQueryString({ genre: selectedGenre === genre ? null : genre })}
              />
            ))}
          </div>
        ) : null}

        <p className="text-sm text-slate-400">
          {copy.showing
            .replace('{filtered}', String(filteredItems.length))
            .replace('{total}', String(shelfItems.length))}
        </p>

        {hasActiveFilters ? (
          <div>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-blue-400/30 hover:bg-white/10 hover:text-white"
            >
              {t('library.clearFilters')}
            </button>
          </div>
        ) : null}

        <BulkSelectionToolbar
          isDeleting={isBulkDeleting}
          isSelectionMode={selectionMode}
          onCancelSelection={cancelSelectionMode}
          onClearSelection={clearSelection}
          onRequestDelete={() => {
            setBulkDeleteError(null)
            setIsBulkDeleteOpen(true)
          }}
          onSelectAllVisible={selectAllVisible}
          onStartSelection={startSelectionMode}
          selectedCount={selectedIds.size}
          visibleCount={filteredItems.length}
        />
      </section>

      <div className={mediaCardGridClassName}>
        {liveItems.length === 0 ? (
            <EmptyVaultState message="Your vault is empty. Time to start a new adventure!" />
        ) : null}

        {liveItems.length > 0 && shelfItems.length === 0 ? (
          <EmptyVaultState message={copy.emptyShelf} />
        ) : null}

        {shelfItems.length > 0 && filteredItems.length === 0 ? (
          <EmptyVaultState message={t('library.emptyFiltered')} />
        ) : null}

        {filteredItems.map((item) => {
          const isSelected = selectedIds.has(item.id)

          return (
          <article
            key={item.id}
            className="group"
            onMouseEnter={() => void resolveAccent(item.imageUrl)}
            onMouseLeave={() => setActiveAccent(null)}
            onTouchStart={() => void resolveAccent(item.imageUrl)}
          >
            <Link
              href={{
                pathname: `/items/${item.id}`,
                query: currentQuery ? { back: currentQuery } : undefined,
              }}
              onClick={(event) => {
                if (!selectionMode) {
                  return
                }

                event.preventDefault()
                toggleSelection(item.id)
              }}
              role={selectionMode ? 'button' : undefined}
              aria-pressed={selectionMode ? isSelected : undefined}
              aria-label={
                selectionMode ? (isSelected ? `Deselect ${item.title}` : `Select ${item.title}`) : undefined
              }
              className="block"
            >
              <div
                className={`glass-panel-soft relative aspect-[2/3] overflow-hidden rounded-[24px] transition-all duration-300 group-hover:border-blue-400/30 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] group-active:shadow-[0_0_20px_rgba(59,130,246,0.3)] ${
                  isSelected ? 'border-blue-400/70 shadow-[0_0_24px_rgba(59,130,246,0.35)]' : ''
                }`}
              >
                <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-90" />
                <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_28%)] opacity-0 transition duration-300 group-hover:opacity-100" />

                {selectionMode ? (
                  <span
                    className={`absolute left-2 top-2 z-30 inline-flex h-11 w-11 items-center justify-center rounded-xl border text-white shadow-lg transition ${
                      isSelected ? 'border-blue-300 bg-blue-500' : 'border-slate-600 bg-slate-950/90'
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected ? <Check className="h-5 w-5" /> : null}
                  </span>
                ) : null}

                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 20vw, 16vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center text-slate-500">
                    <span className="mb-2 text-2xl">{t('library.noCover')}</span>
                    <span className="text-xs">{t('library.addImageUrl')}</span>
                  </div>
                )}

                <div className="absolute bottom-2 left-2 z-20 flex gap-2">
                  {item.favorite ? (
                    <span className="rounded-md bg-amber-400/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-950 backdrop-blur-sm">
                      {t('common.favorite')}
                    </span>
                  ) : null}
                  <span className="rounded-md bg-slate-700/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                    {translateStatus('en', item.status)}
                  </span>
                  {item.rating ? (
                    <span className="rounded-md bg-blue-600/90 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                      {item.rating} / 10
                    </span>
                  ) : null}
                </div>
              </div>

              <h3
                className="mt-3 truncate text-[15px] font-bold tracking-tight text-slate-50 transition-colors group-hover:text-blue-300"
                title={item.title}
              >
                {item.title}
              </h3>
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <span className="capitalize">{translateType('en', item.type)}</span>
                {item.progress > 0 || item.totalProgress !== null ? (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-600" />
                    <span>{formatProgressValue(item)}</span>
                  </>
                ) : null}
              </p>

              {item.genres.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.genres.slice(0, 3).map((genre) => (
                    <span
                      key={genre}
                      className={`rounded-full border px-2 py-1 text-[10px] ${getGenreBadgeClass(
                        genre
                      )}`}
                    >
                      {translateGenre(genre, 'en')}
                    </span>
                  ))}
                  {item.genres.length > 3 ? (
                    <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-400">
                      +{item.genres.length - 3}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </Link>

            {!selectionMode ? (
            <div className="relative z-10 mt-3 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void handleIncrementProgress(item)
                }}
                disabled={Boolean(progressBusyIds[item.id])}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`Add progress for ${item.title}`}
              >
                <Plus className="h-4 w-4" />
              </button>
              <FavoriteToggleButton favorite={item.favorite} id={item.id} title={item.title} />
              <Link
                href={{
                  pathname: `/items/${item.id}/edit`,
                  query: {
                    returnTo: currentQuery ? `/?${currentQuery}` : '/',
                  },
                }}
                className="rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-blue-500 hover:text-white"
              >
                {t('common.edit')}
              </Link>
              <DeleteItemButton id={item.id} imageUrl={item.imageUrl} title={item.title} />
            </div>
            ) : null}
          </article>
          )
        })}
      </div>

      <BulkDeleteConfirmDialog
        count={selectedIds.size}
        errorMessage={bulkDeleteError}
        isDeleting={isBulkDeleting}
        isOpen={isBulkDeleteOpen}
        onCancel={() => {
          if (!isBulkDeleting) {
            setIsBulkDeleteOpen(false)
          }
        }}
        onConfirm={confirmBulkDelete}
      />
    </>
  )
}

type FilterButtonProps = {
  count?: number
  isActive: boolean
  label: string
  onClick: () => void
}

function FilterButton({ count, isActive, label, onClick }: FilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition-all duration-300 ${
        isActive
          ? 'border-blue-400/30 bg-blue-500/20 text-white shadow-[0_0_20px_rgba(59,130,246,0.22)]'
          : 'border-white/10 bg-white/5 text-slate-300 hover:border-blue-400/20 hover:bg-white/10'
      }`}
    >
      {label}
      {typeof count === 'number' ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            isActive ? 'bg-white/20 text-white' : 'bg-slate-800/90 text-slate-200'
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}

function getSortParam(value: string | null): SortMode {
  switch (value) {
    case 'title-asc':
    case 'title-desc':
    case 'rating-desc':
    case 'progress-desc':
      return value
    case 'newest':
    default:
      return 'newest'
  }
}

function getStatusParam(value: string | null) {
  if (value && mediaStatuses.includes(value as (typeof mediaStatuses)[number])) {
    return value
  }

  return 'All'
}

function getTypeParam(value: string | null) {
  if (value && mediaTypes.includes(value as (typeof mediaTypes)[number])) {
    return value
  }

  return 'All'
}

function getShelfParam(value: string | null): LibraryShelf {
  return value === 'archive' ? 'archive' : 'focus'
}

function getLibraryCopy() {
  return {
    eyebrow: 'Shelves',
    focusShelf: 'Focus Shelf',
    archiveShelf: 'Archive Shelf',
    focusTitle: 'Focus Shelf',
    archiveTitle: 'Archive Shelf',
    focusDescription: 'Titles you are actively reading, watching, or keeping close in your near-term stack.',
    archiveDescription: 'Completed and dropped titles live here, so the main library stays shorter and easier to scan.',
    searchLabel: 'Search titles',
    sortLabel: 'Sort items',
    showing: 'Showing {filtered} of {total} in this shelf',
    emptyShelf: 'This shelf is empty right now.',
  }
}

async function extractCoverAccent(imageUrl: string) {
  return new Promise<string | null>((resolve) => {
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.referrerPolicy = 'no-referrer'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const width = 24
        const height = 24
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')

        if (!context) {
          resolve(null)
          return
        }

        context.drawImage(image, 0, 0, width, height)
        const { data } = context.getImageData(0, 0, width, height)
        let red = 0
        let green = 0
        let blue = 0
        let pixels = 0

        for (let index = 0; index < data.length; index += 4) {
          const alpha = data[index + 3]

          if (alpha < 120) {
            continue
          }

          red += data[index]
          green += data[index + 1]
          blue += data[index + 2]
          pixels += 1
        }

        if (pixels === 0) {
          resolve(null)
          return
        }

        resolve(
          `${Math.round(red / pixels)} ${Math.round(green / pixels)} ${Math.round(blue / pixels)}`
        )
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = imageUrl
  })
}
