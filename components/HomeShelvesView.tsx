'use client'

import Link from 'next/link'
import { BookOpen, Clapperboard, Library, MonitorPlay, Sparkles, Tv } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { incrementProgressAction } from '../app/actions/items'
import { useBulkDeleteRequest } from './useBulkDeleteRequest'
import { isInProgressItem } from '../lib/continue-items'
import type { DiscoverRecommendation } from '../lib/home-signals'
import {
  defaultLibraryFilters,
  filterAndSortMediaItems,
  getLibraryFiltersFromSearchParams,
  hasActiveLibraryFilters,
  hasSourceMetadata,
  type LibraryFilters,
  writeLibraryFiltersToSearchParams,
} from '../lib/library-filters'
import { isMovieType, usesPageProgress, type MediaItem } from '../lib/media'
import { shelfDefinitions } from '../lib/shelves'
import { getMediaCardGridClassName } from '../lib/media-card-grid'
import { applyBulkItemChange } from '../lib/bulk-item-changes'
import { getShelfDisplay } from '../lib/library-display'
import { useLocale } from './LocaleProvider'
import BulkItemActions from './BulkItemActions'
import { BulkDeleteConfirmDialog, BulkSelectionToolbar } from './BulkSelectionControls'
import ContinueShelf from './ContinueShelf'
import DiscoverRecommendationCard from './DiscoverRecommendationCard'
import RecommendationCarousel from './RecommendationCarousel'
import LibraryFilterControls from './LibraryFilterControls'
import SetupChecklist, { type SetupChecklistState } from './onboarding/SetupChecklist'
import { useToast } from './ToastProvider'
import type { AddToListOption } from './lists/AddToListButton'
import ShelfItemCard from './ShelfItemCard'
import LibraryTools from './LibraryTools'
import { useVaultPreferences } from './VaultPreferencesProvider'

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
  const { locale, t } = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const { view } = useVaultPreferences()
  const [liveItems, setLiveItems] = useState(items)
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({})
  const [activeAccent, setActiveAccent] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const { isDeleting: isBulkDeleting, error: bulkDeleteError, setError: setBulkDeleteError, deleteSelected } = useBulkDeleteRequest({
    onDeleted(ids) {
      setLiveItems((current) => current.filter((item) => !ids.has(item.id)))
      setSelectedIds((current) => new Set([...current].filter((id) => !ids.has(id))))
    },
    onComplete() { setSelectionMode(false); setIsBulkDeleteOpen(false) },
  })
  const [dismissedRecommendations, setDismissedRecommendations] = useState<Set<string>>(
    () => new Set()
  )
  const accentCacheRef = useRef(new Map<string, string>())
  const filters = useMemo(() => getLibraryFiltersFromSearchParams(searchParams), [searchParams])
  const selectionFilterKey = JSON.stringify(filters)
  const currentQuery = searchParams.toString()
  const currentReturnTo = currentQuery ? `${pathname}?${currentQuery}` : pathname

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

  const updateFilterUrl = useCallback(
    (nextFilters: LibraryFilters) => {
      const params = writeLibraryFiltersToSearchParams(
        new URLSearchParams(searchParams.toString()),
        nextFilters,
        { includeSource: showSourceFilter }
      )
      const query = params.toString()

      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams, showSourceFilter]
  )

  useEffect(() => {
    if (!showSourceFilter && filters.source !== 'all') {
      updateFilterUrl({ ...filters, source: 'all' })
    }
  }, [filters, showSourceFilter, updateFilterUrl])

  useEffect(() => {
    if (selectionMode) {
      setSelectedIds(new Set())
    }
  }, [selectionFilterKey, selectionMode, view])

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
  const inProgressCount = filteredItems.filter(isInProgressItem).length

  const completedUniverse = useMemo(() => {
    const groups = [
      { label: 'manga-family', match: (item: MediaItem) => ['Manga', 'Manhwa', 'Manhua'].includes(item.type) },
      { label: 'anime', match: (item: MediaItem) => item.type === 'Anime' },
      { label: 'movies', match: (item: MediaItem) => item.type === 'Movie' },
      { label: 'series', match: (item: MediaItem) => item.type === 'TV Series' },
      { label: 'books', match: (item: MediaItem) => item.type === 'Book' },
    ] as const

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
    () => view === 'table' ? filteredItems : sortedShelves.flatMap((shelf) => shelf.items),
    [sortedShelves, filteredItems, view]
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
    if (busyIds[item.id]) return
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

    try {
      const result = await incrementProgressAction(item.id)
      if (result.success) {
        showToast(`Progress updated: ${item.title}`)
        return
      }
      setLiveItems((current) => current.map((candidate) => (candidate.id === item.id ? item : candidate)))
      showToast(result.error ?? 'Failed to update progress.', 'error')
    } catch {
      setLiveItems((current) => current.map((candidate) => (candidate.id === item.id ? item : candidate)))
      showToast('Could not update progress. Check your connection and try again.', 'error')
    } finally {
      setBusyIds((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
    }
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

  function confirmBulkDelete() { void deleteSelected([...selectedIds]) }

  const selectionToolbar = (
    <BulkSelectionToolbar
          isDeleting={isBulkDeleting || Object.keys(busyIds).length > 0}
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
  )

  return (
    <div className="min-w-0 space-y-8">
      <section className="min-w-0 space-y-4">
        <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-4">
          <InsightCard label={t(hasActiveLibraryFilters(filters, { includeSort: false }) ? 'library.matchingItems' : 'library.totalItems')} value={String(visibleCount)} />
          <InsightCard label={t('library.inProgress')} value={String(inProgressCount)} />
          <InsightCard label={t('library.completed')} value={String(completedCount)} />
        </div>

        <LibraryFilterControls
          actions={!selectionMode ? selectionToolbar : null}
          filters={filters}
          onChange={updateFilterUrl}
          showSourceFilter={showSourceFilter}
          totalCount={totalCount}
          visibleCount={visibleCount}
        />

        {selectionMode ? selectionToolbar : null}
        {selectionMode ? <BulkItemActions items={liveItems.filter((item) => selectedIds.has(item.id))}
          lists={listOptions} onDone={cancelSelectionMode}
          onUpdated={(change, ids) => setLiveItems((current) => applyBulkItemChange(current, change, ids))} /> : null}
        <LibraryTools filters={filters} items={filteredItems} returnTo={currentReturnTo} selectionActive={selectionMode} />
      </section>

      {totalCount === 0 ? (
        <SetupChecklist state={onboardingState} variant="empty" />
      ) : visibleCount === 0 ? (
        <section className="glass-panel-soft flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/10 px-6 text-center">
          <Sparkles className="h-8 w-8 text-slate-500" />
          <div>
            <h3 className="text-xl font-semibold text-white">{t('library.noMatches')}</h3>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              {t('library.tryFilters')}
            </p>
          </div>
          {hasActiveLibraryFilters(filters) ? (
            <button
              type="button"
              onClick={() => updateFilterUrl(defaultLibraryFilters)}
              className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
            >
              {t('library.clearFilters')}
            </button>
          ) : null}
        </section>
      ) : (
        <>
          {totalCount < 3 ? (
            <SetupChecklist state={onboardingState} variant="compact" />
          ) : null}

          {view !== 'table' ? <ContinueShelf
            items={filteredItems}
            listOptions={listOptions}
            busyIds={busyIds}
            isSelectionMode={selectionMode}
            onIncrement={handleIncrement}
            accentHandler={resolveAccent}
            returnTo={currentReturnTo}
            density={view === 'compact' ? 'compact' : 'comfortable'}
          /> : null}

          {view === 'table' ? (
            <section aria-label={t('library.itemsRegion')} className={getMediaCardGridClassName(view)}>
              {filteredItems.map((item) => (
                <ShelfItemCard key={item.id} item={item} layout="row" listOptions={listOptions}
                  onIncrement={handleIncrement} progressBusy={Boolean(busyIds[item.id])}
                  isSelected={selectedIds.has(item.id)} isSelectionMode={selectionMode}
                  onToggleSelection={toggleSelection} returnTo={currentReturnTo} />
              ))}
            </section>
          ) : sortedShelves.map((shelf) => {
            const ShelfIcon = shelfIcons[shelf.key]

            return (
              <section key={shelf.key} className="min-w-0 space-y-4">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/12 text-blue-200">
                      <ShelfIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold tracking-tight text-white sm:text-2xl">{getShelfDisplay(locale, shelf.key).label}</h2>
                      <p className="text-sm text-slate-400">{getShelfDisplay(locale, shelf.key).description}</p>
                    </div>
                  </div>
                  <Link
                    href={getShelfHref(shelf.slug, currentQuery)}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400/30 hover:text-white sm:shrink-0"
                  >
                    {t('library.seeAll')}
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
                        layout="rail"
                        density={view === 'compact' ? 'compact' : 'comfortable'}
                        listOptions={listOptions}
                        onIncrement={handleIncrement}
                        onToggleSelection={toggleSelection}
                        progressBusy={Boolean(busyIds[item.id])}
                        returnTo={currentReturnTo}
                      />
                    ))
                  ) : (
                    <article className="glass-panel-soft flex min-h-[220px] min-w-[260px] items-center justify-center rounded-xl border border-dashed border-white/10 px-6 text-center text-sm text-slate-400">
                      {hasActiveLibraryFilters(filters, { includeSort: false })
                        ? t('library.shelfEmptyFiltered')
                        : t('library.shelfEmpty')}
                    </article>
                  )}
                </div>
              </section>
            )
          })}
        </>
      )}

      <details className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <summary className="cursor-pointer rounded-xl text-sm font-semibold text-slate-100 focus-visible:outline-2 focus-visible:outline-blue-400">
          {t('library.completionByType')}
        </summary>
        <p className="mt-3 text-sm text-slate-400">{t('library.completionHint')}</p>
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {completedUniverse.map((group) => (
            <article key={group.label} className="min-w-0 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <h3 className="text-sm font-semibold text-slate-100">{getShelfDisplay(locale, group.label).label}</h3>
              <p className="vault-metric mt-3 text-2xl font-bold text-white">
                {group.completionRate === null ? t('library.zeroItems') : `${group.completionRate}%`}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {group.total > 0 ? t('library.completedTotal', { completed: group.completed, total: group.total }) : t('library.noItemsYet')}
              </p>
            </article>
          ))}
        </div>
      </details>

      <section className="min-w-0 space-y-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-white sm:text-2xl">{t('library.recommended')}</h2>
            <p className="text-sm text-slate-400">
              {t('library.recommendationHint')}
            </p>
          </div>
        </div>

        {visibleRecommendations.length > 0 ? (
          <RecommendationCarousel itemCount={visibleRecommendations.length}>
            {visibleRecommendations.map((recommendation) => (
              <DiscoverRecommendationCard
                key={`${recommendation.provider}-${recommendation.title}`}
                listOptions={listOptions}
                onDismiss={dismissRecommendation}
                ownedItem={getOwnedRecommendationItem(recommendation)}
                recommendation={recommendation}
              />
            ))}
          </RecommendationCarousel>
        ) : (
          <section className="glass-panel-soft flex min-h-[180px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/10 px-6 text-center">
            <Sparkles className="h-8 w-8 text-slate-500" />
            <div>
              <h3 className="text-xl font-semibold text-white">{t('library.noRecommendations')}</h3>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                {t('library.noRecommendationsHint')}
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

function getShelfHref(slug: string, query: string) {
  return query ? `/shelves/${slug}?${query}` : `/shelves/${slug}`
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
    <article className="glass-panel surface-highlight min-w-0 rounded-xl p-3 sm:p-5">
      <p className="min-h-8 text-xs text-slate-300 sm:min-h-0 sm:text-sm">{label}</p>
      <p className="vault-metric mt-2 text-2xl font-bold text-white sm:mt-3 sm:text-3xl">{value}</p>
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
