'use client'

import { LoaderCircle, Search, Sparkles, Star, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { dispatchOpenAddModal } from '../lib/add-modal-events'
import type { CatalogSearchCandidate } from '../lib/catalog-types'
import { formatExternalRatingValue } from '../lib/media'
import { type CatalogSearchType, catalogSearchTypes } from '../lib/search-safety'
import { useLocale } from './LocaleProvider'
import AppSelect from './ui/AppSelect'

function getResultTitle(item: CatalogSearchCandidate) {
  return item.title?.trim() || 'Untitled'
}

function getResultYear(item: CatalogSearchCandidate) {
  return item.year?.trim() || 'Unknown year'
}

function getResultPoster(item: CatalogSearchCandidate) {
  return item.imageUrl?.trim() || ''
}

function getRatingCopy(item: CatalogSearchCandidate) {
  if (!item.externalRatingLabel || typeof item.externalRatingValue !== 'number') {
    return null
  }

  return formatExternalRatingValue(item.externalRatingLabel, item.externalRatingValue)
}

function getTypeLabel(type: CatalogSearchType) {
  switch (type) {
    case 'anime':
      return 'Anime'
    case 'manga':
      return 'Manga'
    case 'movie':
      return 'Movie'
    case 'series':
      return 'Series'
    case 'book':
      return 'Book'
    default:
      return 'Type'
  }
}

const catalogTypeOptions = [
  { label: 'Select type', value: '' },
  ...catalogSearchTypes.map((type) => ({
    label: getTypeLabel(type),
    value: type,
  })),
]

export default function HeaderCatalogSearch() {
  const { locale } = useLocale()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogSearchCandidate[] | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isDesktopInputActive, setIsDesktopInputActive] = useState(false)
  const [isMobileOverlayOpen, setIsMobileOverlayOpen] = useState(false)
  const [isMobileInputActive, setIsMobileInputActive] = useState(false)
  const [searchType, setSearchType] = useState<CatalogSearchType | ''>('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const desktopInputRef = useRef<HTMLInputElement | null>(null)
  const mobileInputRef = useRef<HTMLInputElement | null>(null)
  const mobileOverlayRef = useRef<HTMLDivElement | null>(null)
  const searchRequestIdRef = useRef(0)

  useEffect(() => {
    setQuery('')
    setResults(null)
    setHasSearched(false)
    setErrorMessage('')
    setIsLoading(false)
    setIsDesktopInputActive(false)
    setIsMobileInputActive(false)
  }, [searchType])

  useEffect(() => {
    if (!isMobileOverlayOpen || !searchType) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      mobileInputRef.current?.focus()
    }, 120)

    return () => window.clearTimeout(timeoutId)
  }, [isMobileOverlayOpen, searchType])

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (!searchType || trimmedQuery.length < 2) {
      searchRequestIdRef.current += 1
      setResults(null)
      setHasSearched(false)
      setErrorMessage('')
      setIsLoading(false)
      return
    }

    const requestId = searchRequestIdRef.current + 1
    searchRequestIdRef.current = requestId
    const controller = new AbortController()

    setHasSearched(false)
    setResults(null)
    setIsLoading(true)
    setErrorMessage('')

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/catalog-search', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ locale, query: trimmedQuery, type: searchType }),
        })

        const payload = (await response.json()) as {
          data?: CatalogSearchCandidate[]
          error?: string
        }

        if (searchRequestIdRef.current !== requestId) {
          return
        }

        if (!response.ok) {
          setResults([])
          setErrorMessage(payload.error ?? 'Search failed.')
          return
        }

        setResults(payload.data ?? [])
      } catch {
        if (controller.signal.aborted || searchRequestIdRef.current !== requestId) {
          return
        }

        setResults([])
        setErrorMessage('Search failed.')
      } finally {
        if (controller.signal.aborted || searchRequestIdRef.current !== requestId) {
          return
        }

        setHasSearched(true)
        setIsLoading(false)
      }
    }, 220)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [locale, query, searchType])

  useEffect(() => {
    function isInsideSearchSurface(target: Node) {
      return Boolean(
        containerRef.current?.contains(target) || mobileOverlayRef.current?.contains(target)
      )
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!isInsideSearchSurface(event.target as Node)) {
        setIsDesktopInputActive(false)
        setIsMobileInputActive(false)
        setResults(null)
        setHasSearched(false)
        setErrorMessage('')
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDesktopInputActive(false)
        setIsMobileInputActive(false)
        setIsMobileOverlayOpen(false)
        setResults(null)
        setHasSearched(false)
        setErrorMessage('')
        setQuery('')
        desktopInputRef.current?.blur()
        mobileInputRef.current?.blur()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const trimmedQuery = query.trim()
  const hasTypedQuery = Boolean(searchType) && trimmedQuery.length > 0
  const shouldShowDesktopDropdown = hasTypedQuery && isDesktopInputActive
  const shouldShowMobileResults =
    hasTypedQuery &&
    isMobileOverlayOpen &&
    (isMobileInputActive || isLoading || hasSearched || trimmedQuery.length >= 2)
  const desktopTypeSelectClass = searchType
    ? 'border-blue-500/70 bg-slate-950 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.16)] focus:border-blue-400'
    : 'border-slate-700 bg-slate-950 text-white'
  const mobileTypeSelectClass = searchType
    ? 'border-blue-500/80 bg-slate-950 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.18)] focus:border-blue-400'
    : 'border-slate-700 bg-slate-950 text-white'

  function clearSearch(options?: { blur?: boolean; closeMobile?: boolean }) {
    setQuery('')
    setResults(null)
    setHasSearched(false)
    setErrorMessage('')
    setIsDesktopInputActive(false)
    setIsMobileInputActive(false)

    if (options?.blur) {
      desktopInputRef.current?.blur()
      mobileInputRef.current?.blur()
    }

    if (options?.closeMobile) {
      setIsMobileOverlayOpen(false)
    }
  }

  function handleCandidateSelect(item: CatalogSearchCandidate) {
    dispatchOpenAddModal({ candidate: item })
    clearSearch({ blur: true, closeMobile: true })
  }

  function renderResultsContent() {
    if (trimmedQuery.length < 3) {
      return (
        <div className="px-4 py-4 text-sm text-slate-300">
          Type at least 3 characters to search global databases.
        </div>
      )
    }

    if (isLoading) {
      return (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-white">
          <LoaderCircle className="h-4 w-4 animate-spin text-blue-300" />
          Searching...
        </div>
      )
    }

    if (errorMessage) {
      return <div className="px-4 py-4 text-sm text-amber-200">{errorMessage}</div>
    }

    if (!hasSearched) {
      return (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-300">
          <LoaderCircle className="h-4 w-4 animate-spin text-blue-300" />
          Searching...
        </div>
      )
    }

    if ((results?.length ?? 0) === 0) {
      return (
        <div className="px-4 py-4 text-sm text-slate-200">
          No matches found. Try a different title.
        </div>
      )
    }

    return (
      <div className="max-h-[400px] overflow-y-auto p-2">
        {results?.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleCandidateSelect(item)}
            className="flex w-full cursor-pointer items-start gap-3 rounded-xl p-2 text-left transition hover:bg-blue-600/30"
          >
            {getResultPoster(item) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getResultPoster(item)}
                alt={getResultTitle(item)}
                className="h-14 w-10 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-[10px] text-slate-400">
                N/A
              </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-semibold text-white">
                  {getResultTitle(item)}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{getResultYear(item)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {getRatingCopy(item) ? (
                  <span className="inline-flex items-center gap-1 text-sm text-slate-300">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {getRatingCopy(item)}
                  </span>
                ) : null}
                <span className="shrink-0 rounded-xl border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-100">
                  {item.type}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    )
  }

  return (
    <>
      <div ref={containerRef} className="relative z-[120] md:min-w-[320px] md:max-w-[680px] md:flex-1">
        <button
          type="button"
          onClick={() => setIsMobileOverlayOpen(true)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-white shadow-[0_12px_30px_rgba(2,6,23,0.35)] transition hover:border-blue-400/40 hover:bg-slate-900 md:hidden"
          aria-label="Open search"
        >
          <Search className="h-5 w-5" />
        </button>

        <div className="hidden items-center gap-3 md:flex">
          <div className="flex min-w-[156px] items-center">
            <AppSelect
              ariaLabel="Search media type"
              value={searchType}
              onValueChange={(value) => setSearchType(value as CatalogSearchType | '')}
              options={catalogTypeOptions}
              className={`h-12 min-h-12 w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-blue-500/40 ${desktopTypeSelectClass}`}
            />
          </div>

          <div className="flex h-12 flex-1 items-center rounded-xl border border-slate-700 bg-slate-950 pl-4 pr-3 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/40">
            <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              ref={desktopInputRef}
              type="text"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
              }}
              onInput={(event) => {
                setQuery(event.currentTarget.value)
              }}
              onFocus={() => setIsDesktopInputActive(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  const activeElement = document.activeElement
                  if (!containerRef.current?.contains(activeElement)) {
                    setIsDesktopInputActive(false)
                  }
                }, 0)
              }}
              placeholder={searchType ? 'Search global databases...' : 'Select type first...'}
              className="w-full bg-transparent pl-3 text-sm font-medium text-white outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500"
              disabled={!searchType}
            />
            {query ? (
              <button
                type="button"
                onClick={() => clearSearch()}
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            {isLoading ? (
              <Sparkles className="h-4 w-4 animate-pulse text-blue-300" aria-hidden="true" />
            ) : null}
          </div>
        </div>

        {shouldShowDesktopDropdown ? (
          <div className="absolute left-0 top-full z-[9999] mt-1 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
            <p className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Search Results
            </p>
            {renderResultsContent()}
          </div>
        ) : null}
      </div>

      {isMobileOverlayOpen ? (
        <div ref={mobileOverlayRef} className="fixed inset-0 z-[1000] bg-slate-950/98 md:hidden">
          <div className="safe-top flex h-full flex-col px-4 pb-6 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Search
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">Find your next title</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOverlayOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-white shadow-[0_12px_30px_rgba(2,6,23,0.35)] transition hover:border-blue-400/40 hover:bg-slate-900"
                aria-label="Close search"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative mt-5">
              <div className="space-y-3">
                <AppSelect
                  ariaLabel="Search media type"
                  value={searchType}
                  onValueChange={(value) => setSearchType(value as CatalogSearchType | '')}
                  options={catalogTypeOptions}
                  className={`h-12 min-h-12 w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-blue-500/40 ${mobileTypeSelectClass}`}
                />

                <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/40">
                  <Search className="h-4 w-4 text-slate-300" aria-hidden="true" />
                  <input
                    ref={mobileInputRef}
                    type="text"
                    inputMode="search"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setIsMobileInputActive(true)
                    }}
                    onInput={(event) => {
                      setQuery(event.currentTarget.value)
                      setIsMobileInputActive(true)
                    }}
                    onFocus={() => setIsMobileInputActive(true)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        const activeElement = document.activeElement
                        if (
                          activeElement &&
                          !containerRef.current?.contains(activeElement) &&
                          !mobileOverlayRef.current?.contains(activeElement)
                        ) {
                          setIsMobileInputActive(false)
                        }
                      }, 0)
                    }}
                    placeholder={searchType ? 'Search global databases...' : 'Select type first...'}
                    className="w-full bg-transparent pl-1 text-base font-semibold text-white outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500"
                    disabled={!searchType}
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => clearSearch()}
                      className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              {shouldShowMobileResults ? (
                <div className="absolute left-0 top-full z-[999] mt-2 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
                  <p className="px-4 pt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                    Search Results
                  </p>
                  {renderResultsContent()}
                </div>
              ) : null}
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-hidden">
              {!shouldShowMobileResults ? (
                <div className="glass-panel-soft flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-6 text-center">
                  <Search className="h-8 w-8 text-slate-500" />
                  <p className="mt-4 text-sm text-slate-400">
                    Pick a media type and start typing to search the global databases.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

