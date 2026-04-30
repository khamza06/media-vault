'use client'

import Link from 'next/link'
import { BookOpen, Clapperboard, Library, MonitorPlay, Sparkles, Tv } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { deleteItemsBulkAction, incrementProgressAction } from '../app/actions/items'
import type { DiscoverRecommendation } from '../lib/home-signals'
import {
  defaultLibraryFilters,
  filterAndSortMediaItems,
  hasActiveLibraryFilters,
  hasSourceMetadata,
  type LibraryFilters,
} from '../lib/library-filters'
import { isMovieType, usesPageProgress, type MediaItem } from '../lib/media'
import { shelfDefinitions } from '../lib/shelves'
import { BulkDeleteConfirmDialog, BulkSelectionToolbar } from './BulkSelectionControls'
import DiscoverRecommendationCard from './DiscoverRecommendationCard'
import LibraryFilterControls from './LibraryFilterControls'
import SetupChecklist, { type SetupChecklistState } from './onboarding/SetupChecklist'
import { useToast } from './ToastProvider'
import type { AddToListOption } from './lists/AddToListButton'
import ShelfItemCard from './ShelfItemCard'

const shelfIcons = {
  anime: Tv,
  'manga-family': Library,
  movies: Clapperboard,
  series: MonitorPlay,
  books: BookOpen,
} as const

const DISMISSED_DISCOVER_RECOMMENDATIONS_KEY = 'media-vault-dismissed-ai-discover'

export default function HomeShelvesView({
  items,
  listOptions,
  onboardingState,
  recommendations,
}: {
  items: MediaItem[]
  listOptions: AddToListOption[]
  onboardingState: SetupChecklistState
  recommendations: DiscoverRecommendation[]
}) {
  const router = useRouter()
  const { showToast } = useToast()
  const [liveItems, setLiveItems] = useState(items)
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({})
  const [activeAccent, setActiveAccent] = useState<string | null>(null)
  const [filters, setFilters] = useState<LibraryFilters>(defaultLibraryFilters)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)
  const [dismissedRecommendations, setDismissedRecommendations] = useState<Set<string>>(
    () => new Set()
  )
  const accentCacheRef = useRef(new Map<string, string>())

  useEffect(() => {
    setLiveItems(items)
  }, [items])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DISMISSED_DISCOVER_RECOMMENDATIONS_KEY)
      const parsed = stored ? (JSON.parse(stored) as unknown) : []

      if (Array.isArray(parsed)) {
        setDismissedRecommendations(
          new Set(parsed.filter((value): value is string => typeof value === 'string'))
        )
      }
    } catch {
      setDismissedRecommendations(new Set())
    }
  }, [])

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
  }, [filters, selectionMode])

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

  const filteredItems = useMemo(
    () => filterAndSortMediaItems(liveItems, filters, { enableSourceFilter: showSourceFilter }),
    [filters, liveItems, showSourceFilter]
  )

  const totalCount = liveItems.length
  const visibleCount = filteredItems.length
  const completedCount = filteredItems.filter(isCompletedItem).length
  const inProgressCount = filteredItems.filter((item) =>
    ['Watching', 'Reading', 'Re-Watching'].includes(item.status)
  ).length

  const completedUniverse = useMemo(() => {
    const groups = [
      { label: 'Manga', match: (item: MediaItem) => ['Manga', 'Manhwa', 'Manhua'].includes(item.type) },
      { label: 'Anime', match: (item: MediaItem) => item.type === 'Anime' },
      { label: 'Movies', match: (item: MediaItem) => item.type === 'Movie' },
      { label: 'Series', match: (item: MediaItem) => item.type === 'TV Series' },
      { label: 'Books', match: (item: MediaItem) => item.type === 'Book' },
    ]

    return groups.map((group) => {
      const groupItems = filteredItems.filter(group.match)
      const completed = groupItems.filter(isCompletedItem).length
      const total = groupItems.length
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : null

      return { completed, completionRate, label: group.label, total }
    })
  }, [filteredItems])

  const sortedShelves = useMemo(() => {
    return shelfDefinitions
      .map((shelf) => {
        const shelfItems = filteredItems
          .filter((item) => shelf.types.some((type) => type === item.type))
          .sort((left, right) => {
            return (
              new Date(right.lastActivityAt ?? right.createdAt ?? 0).getTime() -
              new Date(left.lastActivityAt ?? left.createdAt ?? 0).getTime()
            )
          })

        const shelfUpdatedAt = shelfItems[0]?.lastActivityAt ?? shelfItems[0]?.createdAt ?? null

        return {
          ...shelf,
          items: shelfItems.slice(0, 6),
          totalCount: shelfItems.length,
          updatedAt: shelfUpdatedAt ? new Date(shelfUpdatedAt).getTime() : 0,
        }
      })
      .sort((left, right) => right.updatedAt - left.updatedAt)
  }, [filteredItems])

  const visibleShelfItems = useMemo(
    () => sortedShelves.flatMap((shelf) => shelf.items),
    [sortedShelves]
  )
  const ownedRecommendationItems = useMemo(() => {
    const byTitleAndType = new Map<string, MediaItem>()
    const byExternalId = new Map<string, MediaItem>()

    for (const item of liveItems) {
      byTitleAndType.set(getRecommendationTitleTypeKey(item.title, item.type), item)

      if (item.externalSource && item.externalId) {
        byExternalId.set(`${item.externalSource.toLowerCase()}::${item.externalId}`, item)
      }
    }

    return { byExternalId, byTitleAndType }
  }, [liveItems])
  const visibleRecommendations = useMemo(
    () =>
      recommendations.filter(
        (recommendation) => !dismissedRecommendations.has(getRecommendationKey(recommendation))
      ),
    [dismissedRecommendations, recommendations]
  )

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

  async function handleIncrement(item: MediaItem) {
    const nextProgress =
      typeof item.totalProgress === 'number' && item.totalProgress > 0
        ? Math.min(item.progress + 1, item.totalProgress)
        : item.progress + 1

    if (nextProgress === item.progress) {
      return
    }

    const nextStatus =
      isMovieType(item.type) && nextProgress >= 1
        ? 'Completed'
        : usesPageProgress(item.type) && item.status === 'Planning'
          ? 'Reading'
          : !usesPageProgress(item.type) && item.status === 'Planning'
            ? 'Watching'
            : item.status

    const nowIso = new Date().toISOString()

    setBusyIds((current) => ({ ...current, [item.id]: true }))
    setLiveItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id
          ? {
              ...candidate,
              currentEpisode: usesPageProgress(candidate.type) ? null : nextProgress,
              currentPage: usesPageProgress(candidate.type) ? nextProgress : null,
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

  function dismissRecommendation(recommendation: DiscoverRecommendation) {
    const key = getRecommendationKey(recommendation)

    setDismissedRecommendations((current) => {
      const next = new Set(current)
      next.add(key)

      try {
        window.localStorage.setItem(
          DISMISSED_DISCOVER_RECOMMENDATIONS_KEY,
          JSON.stringify([...next])
        )
      } catch {}

      return next
    })
  }

  function getOwnedRecommendationItem(recommendation: DiscoverRecommendation) {
    const [, externalId] = recommendation.id.split(':')
    const externalMatch = externalId
      ? ownedRecommendationItems.byExternalId.get(`anilist::${externalId}`)
      : null

    if (externalMatch) {
      return externalMatch
    }

    return (
      ownedRecommendationItems.byTitleAndType.get(
        getRecommendationTitleTypeKey(recommendation.title, recommendation.type)
      ) ?? null
    )
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
    <div className="min-w-0 space-y-10">
      <section className="min-w-0 space-y-5">
        <div className="max-w-3xl min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75">
            Completion KPIs
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-3xl">Completion Progress</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Track how much of each media family you have completed.
          </p>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
          <InsightCard label="Total Items" value={String(totalCount)} />
          <InsightCard label="In Progress" value={String(inProgressCount)} />
          <InsightCard label="Completed" value={String(completedCount)} />
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
          {completedUniverse.map((group) => (
            <article key={group.label} className="glass-panel surface-highlight min-w-0 rounded-xl px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{group.label}</p>
              <div className="mt-3 space-y-2">
                <p className="text-2xl font-bold tracking-tight text-white">
                  {group.completionRate === null ? '0 items' : `${group.completionRate}%`}
                </p>
                <p className="text-sm text-slate-400">
                  {group.total > 0
                    ? `${group.completed} completed / ${group.total} total`
                    : 'Nothing in this family yet'}
                </p>
              </div>
            </article>
          ))}
        </div>

        <LibraryFilterControls
          filters={filters}
          onChange={setFilters}
          showSourceFilter={showSourceFilter}
          totalCount={totalCount}
          visibleCount={visibleCount}
        />

        <BulkSelectionToolbar
          isDeleting={isBulkDeleting}
          isSelectionMode={selectionMode}
          onCancelSelection={cancelSelectionMode}
          onClearSelection={() => setSelectedIds(new Set())}
          onRequestDelete={() => {
            setBulkDeleteError(null)
            setIsBulkDeleteOpen(true)
          }}
          onSelectAllVisible={() => setSelectedIds(new Set(visibleShelfItems.map((item) => item.id)))}
          onStartSelection={() => {
            setBulkDeleteError(null)
            setSelectionMode(true)
          }}
          selectedCount={selectedIds.size}
          visibleCount={visibleShelfItems.length}
        />
      </section>

      {totalCount === 0 ? (
        <SetupChecklist state={onboardingState} variant="empty" />
      ) : visibleCount === 0 ? (
        <section className="glass-panel-soft flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/10 px-6 text-center">
          <Sparkles className="h-8 w-8 text-slate-500" />
          <div>
            <h3 className="text-xl font-semibold text-white">No items match these filters.</h3>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Try a different status, cover, source, rating, or search term.
            </p>
          </div>
          {hasActiveLibraryFilters(filters) ? (
            <button
              type="button"
              onClick={() => setFilters(defaultLibraryFilters)}
              className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
            >
              Clear filters
            </button>
          ) : null}
        </section>
      ) : (
        <>
          {totalCount < 3 ? (
            <SetupChecklist state={onboardingState} variant="compact" />
          ) : null}

          {sortedShelves.map((shelf) => {
            const ShelfIcon = shelfIcons[shelf.key]

            return (
              <section key={shelf.key} className="min-w-0 space-y-4">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/12 text-blue-200">
                      <ShelfIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold tracking-tight text-white sm:text-2xl">{shelf.label}</h2>
                      <p className="text-sm text-slate-400">{shelf.description}</p>
                    </div>
                  </div>
                  <Link
                    href={`/shelves/${shelf.slug}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400/30 hover:text-white sm:shrink-0"
                  >
                    See All
                  </Link>
                </div>

                <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2 md:gap-4">
                  {shelf.items.length > 0 ? (
                    shelf.items.map((item) => (
                      <ShelfItemCard
                        key={item.id}
                        accentHandler={resolveAccent}
                        isSelected={selectedIds.has(item.id)}
                        isSelectionMode={selectionMode}
                        item={item}
                        listOptions={listOptions}
                        onIncrement={handleIncrement}
                        onToggleSelection={toggleSelection}
                        progressBusy={Boolean(busyIds[item.id])}
                        returnTo={`/shelves/${shelf.slug}`}
                      />
                    ))
                  ) : (
                    <article className="glass-panel-soft flex min-h-[220px] min-w-[260px] items-center justify-center rounded-xl border border-dashed border-white/10 px-6 text-center text-sm text-slate-400">
                      Nothing here yet. Add the first title to start this shelf.
                    </article>
                  )}
                </div>
              </section>
            )
          })}
        </>
      )}

      <section className="min-w-0 space-y-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-white sm:text-2xl">AI Discover</h2>
            <p className="text-sm text-slate-400">
              Recommendations based on your highest-rated titles, excluding media already in your vault.
            </p>
          </div>
        </div>

        {visibleRecommendations.length > 0 ? (
          <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2 md:gap-4">
            {visibleRecommendations.map((recommendation) => (
              <DiscoverRecommendationCard
                key={`${recommendation.provider}-${recommendation.title}`}
                listOptions={listOptions}
                onDismiss={dismissRecommendation}
                ownedItem={getOwnedRecommendationItem(recommendation)}
                recommendation={recommendation}
              />
            ))}
          </div>
        ) : (
          <section className="glass-panel-soft flex min-h-[180px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/10 px-6 text-center">
            <Sparkles className="h-8 w-8 text-slate-500" />
            <div>
              <h3 className="text-xl font-semibold text-white">No recommendations yet.</h3>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                Rate a few titles highly and your discover shelf will start learning your taste.
              </p>
            </div>
          </section>
        )}
      </section>

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
    </div>
  )
}

function getRecommendationKey(recommendation: DiscoverRecommendation) {
  return `${recommendation.provider}:${recommendation.id}:${recommendation.title}`
}

function getRecommendationTitleTypeKey(title: string, type: string) {
  return `${getRecommendationTypeFamily(type)}::${normalizeRecommendationTitle(title)}`
}

function getRecommendationTypeFamily(type: string) {
  return ['Manga', 'Manhwa', 'Manhua'].includes(type) ? 'Manga' : type
}

function normalizeRecommendationTitle(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0400-\u04ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="glass-panel surface-highlight min-w-0 rounded-xl px-4 py-4 sm:px-5 sm:py-5">
      <p className="text-xs text-slate-300 sm:text-sm">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-white sm:mt-3 sm:text-3xl">{value}</p>
    </article>
  )
}

function isCompletedItem(item: MediaItem) {
  return item.status.trim().toLowerCase() === 'completed'
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

        resolve(`${Math.round(red / pixels)} ${Math.round(green / pixels)} ${Math.round(blue / pixels)}`)
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = imageUrl
  })
}
