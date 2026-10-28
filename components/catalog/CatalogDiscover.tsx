'use client'

import { Search, X } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import type { CatalogSearchCandidate, CatalogSearchPage, CatalogSearchSource } from '../../lib/catalog-types'
import { fetchCatalogPage } from '../../lib/catalog-client'
import { getOwnedCatalogItem, mergeCatalogPages, type CatalogOwnedItem } from '../../lib/catalog-view'
import { mediaCardGridClassName } from '../../lib/media-card-grid'
import { MIN_CATALOG_QUERY_LENGTH, catalogSearchTypes, isCatalogSearchType, mapCatalogSearchTypeToMediaType } from '../../lib/search-safety'
import { translateType } from '../../lib/i18n'
import CoverPlaceholder from '../CoverPlaceholder'
import { useLocale } from '../LocaleProvider'
import AddToListButton, { type AddToListOption } from '../lists/AddToListButton'
import AppSelect from '../ui/AppSelect'
import ActionFeedback from '../ui/ActionFeedback'
import CatalogPreview from './CatalogPreview'

export default function CatalogDiscover({ ownedItems, lists, loadPage = fetchCatalogPage }: {
  ownedItems: CatalogOwnedItem[]
  lists: AddToListOption[]
  loadPage?: typeof fetchCatalogPage
}) {
  const params = useSearchParams()
  const { locale, t } = useLocale()
  const urlQuery = params.get('q') ?? ''
  const typeParam = params.get('type')
  const type = isCatalogSearchType(typeParam) ? typeParam : 'anime'
  const sourceParam = params.get('source')
  const canChooseSources = type === 'anime' || type === 'manga'
  const source: CatalogSearchSource = canChooseSources && ['jikan', 'kitsu', 'shikimori'].includes(sourceParam ?? '') ? sourceParam as CatalogSearchSource : 'primary'
  const [query, setQuery] = useState(urlQuery)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchId = useId()
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery)
  const [cursor, setCursor] = useState({ key: '', page: 1 })
  const [response, setResponse] = useState<(CatalogSearchPage & { key: string }) | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<CatalogSearchCandidate | null>(null)
  const trimmedQuery = query.trim()
  const key = JSON.stringify([trimmedQuery, type, source, locale])
  const [lastSearchKey, setLastSearchKey] = useState(key)
  const page = cursor.key === key ? cursor.page : 1
  const visible = response?.key === key ? response : null

  // Returning to a previous query/source starts at page one, not an orphaned later page.
  if (lastSearchKey !== key) {
    setLastSearchKey(key)
    setCursor({ key, page: 1 })
  }

  // External navigation/back updates the draft; our own trimmed URL writes keep typing intact.
  if (lastUrlQuery !== urlQuery) {
    setLastUrlQuery(urlQuery)
    if (query.trim() !== urlQuery) setQuery(urlQuery)
  }

  function updateFilter(name: 'type' | 'source', value: string) {
    const url = new URL(window.location.href)
    if ((name === 'type' && value === 'anime') || (name === 'source' && value === 'primary')) url.searchParams.delete(name)
    else url.searchParams.set(name, value)
    if (name === 'type') url.searchParams.delete('source')
    if (trimmedQuery) url.searchParams.set('q', trimmedQuery)
    else url.searchParams.delete('q')
    window.history.pushState(null, '', `${url.pathname}${url.search}`)
  }

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const url = new URL(window.location.href)
      if (trimmedQuery) url.searchParams.set('q', trimmedQuery)
      else url.searchParams.delete('q')
      window.history.replaceState(null, '', `${url.pathname}${url.search}`)
      if (trimmedQuery.length < MIN_CATALOG_QUERY_LENGTH) {
        setIsLoading(false)
        setError('')
        return
      }
      setIsLoading(true)
      setError('')
      try {
        const payload = await loadPage({ query: trimmedQuery, type, source, locale, page }, controller.signal)
        if (cancelled) return
        setResponse((current) => ({ ...payload, key, data: page > 1 && current?.key === key ? mergeCatalogPages(current.data, payload.data) : payload.data }))
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Search failed. Try again.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, page > 1 ? 0 : 400)
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort() }
  }, [key, loadPage, locale, page, retry, source, trimmedQuery, type])

  const primaryLabel = canChooseSources ? 'AniList' : type === 'book' ? 'Open Library' : 'TMDB'
  return (
    <div className="space-y-6">
      <section aria-label="Catalog search" className="grid min-w-0 gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_10rem_11rem]">
        <div className="min-w-0">
          <label htmlFor={searchId} className="mb-2 block text-sm font-semibold text-slate-300">{t('catalog.searchTitles')}</label>
          <div className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 pl-4 pr-1 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/30">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input id={searchId} ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} type="text" inputMode="search" enterKeyHint="search" maxLength={200} autoComplete="off" autoCorrect="off" spellCheck={false} placeholder={t('catalog.placeholder')} className="min-h-12 min-w-0 w-full bg-transparent text-base text-slate-100 outline-none placeholder:text-slate-500" />
            {query ? <button type="button" aria-label={t('catalog.clearSearch')} onClick={() => { setQuery(''); searchRef.current?.focus() }} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white"><X aria-hidden="true" className="h-4 w-4" /></button> : null}
          </div>
        </div>
        <label className="min-w-0"><span className="mb-2 block text-sm font-semibold text-slate-300">{t('catalog.mediaType')}</span>
          <AppSelect ariaLabel={t('catalog.mediaType')} value={type} onValueChange={(value) => updateFilter('type', value)} options={catalogSearchTypes.map((value) => ({ value, label: value === 'series' ? t('catalog.series') : translateType(locale, mapCatalogSearchTypeToMediaType(value)) }))} />
        </label>
        <label className="min-w-0"><span className="mb-2 block text-sm font-semibold text-slate-300">{t('catalog.source')}</span>
          <AppSelect ariaLabel={t('catalog.source')} value={source} onValueChange={(value) => updateFilter('source', value)} disabled={!canChooseSources} options={[{ value: 'primary', label: primaryLabel }, ...(canChooseSources ? [{ value: 'jikan', label: 'MyAnimeList / Jikan' }, { value: 'kitsu', label: 'Kitsu' }, { value: 'shikimori', label: 'Shikimori' }] : [])]} />
        </label>
        <p className="text-xs leading-5 text-slate-400 md:col-span-3">{t('catalog.instructions')}</p>
      </section>

      {error ? <ActionFeedback tone="error"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-4">{t('catalog.tryAgain')}</button></ActionFeedback> : null}
      {isLoading ? <ActionFeedback tone="pending">{t('catalog.searching', { provider: source === 'primary' ? primaryLabel : source })}</ActionFeedback> : null}
      {trimmedQuery.length < MIN_CATALOG_QUERY_LENGTH ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h2 className="text-xl font-semibold">{t('catalog.emptyHeading')}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{t('catalog.shortQuery')}</p>
        </section>
      ) : visible ? (
        <section aria-label={t('catalog.results', { count: visible.data.length, provider: visible.provider })} aria-busy={isLoading}>
          <p role="status" className="mb-4 text-sm text-slate-400">{t('catalog.results', { count: visible.data.length, provider: visible.provider })}{visible.page > 1 ? t('catalog.pages', { count: visible.page }) : ''}</p>
          {visible.data.length === 0 ? <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">{t(canChooseSources ? 'catalog.noMatchesSources' : 'catalog.noMatches')}</div> : (
            <div className={mediaCardGridClassName}>
              {visible.data.map((item) => {
                const owned = getOwnedCatalogItem(item, ownedItems)
                return <article key={item.id} className="flex min-w-0 flex-col gap-2">
                  <button type="button" onClick={() => setSelected(item)} aria-label={t('catalog.preview', { title: item.title })} className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900 p-2 text-left transition hover:border-blue-400/50 focus-visible:outline-2 focus-visible:outline-blue-400">
                    <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-slate-950">{item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : <CoverPlaceholder title={item.title} type={item.type} typeLabel={translateType(locale, item.type)} />}</div>
                    <h2 className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-100">{item.title}</h2>
                    <p className="mt-2 text-xs text-slate-400">{translateType(locale, item.type)} / {item.year ?? t('catalog.unknownYear')}</p>
                    <p className="mt-2 text-xs font-medium text-blue-200">{t(owned ? 'catalog.alreadySaved' : 'catalog.previewTitle')}</p>
                  </button>
                  {owned ? <AddToListButton itemId={owned.id} itemTitle={owned.title} lists={lists} /> : null}
                </article>
              })}
            </div>
          )}
          {visible.hasMore ? <button type="button" disabled={isLoading} onClick={() => setCursor({ key, page: visible.page + 1 })} className="mx-auto mt-6 flex min-h-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-6 text-sm font-semibold text-slate-100 hover:border-blue-400 disabled:opacity-50">{t(isLoading ? 'common.loading' : 'catalog.showMore')}</button> : null}
        </section>
      ) : !isLoading && !error ? <p role="status" className="text-sm text-slate-400">{t('catalog.preparing')}</p> : null}
      {selected ? <CatalogPreview key={selected.id} candidate={selected} ownedItem={getOwnedCatalogItem(selected, ownedItems)} onClose={() => setSelected(null)} /> : null}
    </div>
  )
}
