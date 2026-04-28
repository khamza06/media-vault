'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { deleteItemsBulkAction, incrementProgressAction } from '../app/actions/items'
import {
  defaultLibraryFilters,
  filterAndSortMediaItems,
  hasActiveLibraryFilters,
  hasSourceMetadata,
  type LibraryFilters,
} from '../lib/library-filters'
import { isMovieType, usesPageProgress, type MediaItem } from '../lib/media'
import { mediaCardGridClassName } from '../lib/media-card-grid'
import { BulkDeleteConfirmDialog, BulkSelectionToolbar } from './BulkSelectionControls'
import LibraryFilterControls from './LibraryFilterControls'
import { useToast } from './ToastProvider'
import type { AddToListOption } from './lists/AddToListButton'
import ShelfItemCard from './ShelfItemCard'

export default function ShelfGridView({
  description,
  items,
  listOptions,
  title,
}: {
  description: string
  items: MediaItem[]
  listOptions: AddToListOption[]
  title: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { showToast } = useToast()
  const [liveItems, setLiveItems] = useState(items)
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({})
  const [filters, setFilters] = useState<LibraryFilters>(defaultLibraryFilters)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)

  useEffect(() => {
    setLiveItems(items)
  }, [items])

  const showSourceFilter = useMemo(() => hasSourceMetadata(liveItems), [liveItems])

  useEffect(() => {
    if (!showSourceFilter && filters.source !== 'all') {
      setFilters((current) => ({ ...current, source: 'all' }))
    }
  }, [filters.source, showSourceFilter])

  useEffect(() => {
    if (selectionMode) {
      setSelectedIds(new Set())
    }
  }, [favoritesOnly, filters, selectionMode])

  const filteredItems = useMemo(() => {
    const baseItems = filterAndSortMediaItems(liveItems, filters, {
      enableSourceFilter: showSourceFilter,
    })

    if (!favoritesOnly) {
      return baseItems
    }

    return baseItems.filter((item) => item.favorite)
  }, [favoritesOnly, filters, liveItems, showSourceFilter])

  async function handleIncrement(item: MediaItem) {
    const nextProgress =
      typeof item.totalProgress === 'number' && item.totalProgress > 0
        ? Math.min(item.progress + 1, item.totalProgress)
        : item.progress + 1

    if (nextProgress === item.progress) {
      return
    }

    const isPaged = usesPageProgress(item.type)
    const nextStatus =
      isMovieType(item.type) && nextProgress >= 1
        ? 'Completed'
        : isPaged && item.status === 'Planning'
          ? 'Reading'
          : !isPaged && item.status === 'Planning'
            ? 'Watching'
            : item.status
    const nowIso = new Date().toISOString()

    setBusyIds((current) => ({ ...current, [item.id]: true }))
    setLiveItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id
          ? {
              ...candidate,
              currentEpisode: isPaged ? null : nextProgress,
              currentPage: isPaged ? nextProgress : null,
              lastActivityAt: nowIso,
              lastProgressAt: nowIso,
              progress: nextProgress,
              status: nextStatus,
            }
          : candidate
      )
    )

    const result = await incrementProgressAction(item.id)

    setBusyIds((current) => {
      const next = { ...current }
      delete next[item.id]
      return next
    })

    if (result.success) {
      showToast(`Progress updated: ${item.title}`)
      return
    }

    setLiveItems((current) => current.map((candidate) => (candidate.id === item.id ? item : candidate)))
    showToast(result.error ?? 'Failed to update progress.', 'error')
  }

  function toggleSelection(item: MediaItem) {
    setSelectedIds((current) => {
      const next = new Set(current)

      if (next.has(item.id)) {
        next.delete(item.id)
      } else {
        next.add(item.id)
      }

      return next
    })
  }

  function cancelSelectionMode() {
    setBulkDeleteError(null)
    setIsBulkDeleteOpen(false)
    setSelectionMode(false)
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

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 pb-32 sm:px-6 lg:px-8">
      <header className="mb-8 mt-6 max-w-3xl min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75">Shelf Detail</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">{title}</h1>
        <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">{description}</p>
      </header>

      <section className="mb-8 min-w-0 space-y-4">
        <LibraryFilterControls
          filters={filters}
          onChange={setFilters}
          showSourceFilter={showSourceFilter}
          totalCount={liveItems.length}
          visibleCount={filteredItems.length}
        />

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setFavoritesOnly((current) => !current)}
            className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              favoritesOnly
                ? 'border-blue-400/30 bg-blue-500/20 text-white'
                : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'
            }`}
          >
            Favorites only
          </button>
        </div>

        <BulkSelectionToolbar
          isDeleting={isBulkDeleting}
          isSelectionMode={selectionMode}
          onCancelSelection={cancelSelectionMode}
          onClearSelection={() => setSelectedIds(new Set())}
          onRequestDelete={() => {
            setBulkDeleteError(null)
            setIsBulkDeleteOpen(true)
          }}
          onSelectAllVisible={() => setSelectedIds(new Set(filteredItems.map((item) => item.id)))}
          onStartSelection={() => {
            setBulkDeleteError(null)
            setSelectionMode(true)
          }}
          selectedCount={selectedIds.size}
          visibleCount={filteredItems.length}
        />
      </section>

      {filteredItems.length === 0 ? (
        <section className="glass-panel-soft flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/10 px-6 text-center">
          <div>
            <h3 className="text-xl font-semibold text-white">No items match these filters.</h3>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Try another filter or add a few more titles to this category.
            </p>
          </div>
          {hasActiveLibraryFilters(filters) || favoritesOnly ? (
            <button
              type="button"
              onClick={() => {
                setFilters(defaultLibraryFilters)
                setFavoritesOnly(false)
              }}
              className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
            >
              Clear filters
            </button>
          ) : null}
        </section>
      ) : (
        <section className={mediaCardGridClassName}>
          {filteredItems.map((item) => (
            <ShelfItemCard
              key={item.id}
              isSelected={selectedIds.has(item.id)}
              isSelectionMode={selectionMode}
              item={item}
              listOptions={listOptions}
              onIncrement={handleIncrement}
              onToggleSelection={toggleSelection}
              progressBusy={Boolean(busyIds[item.id])}
              returnTo={pathname}
            />
          ))}
        </section>
      )}

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
    </main>
  )
}
