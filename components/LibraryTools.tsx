'use client'
import { translateError } from '../lib/ui-i18n'


import Image from 'next/image'
import Link from 'next/link'
import { Shuffle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LibraryFilters } from '../lib/library-filters'
import type { MediaItem } from '../lib/media'
import { getSavedLibraryViewHref, pickPlanningItem } from '../lib/saved-library-views'
import { getSavedViewLocationLabel } from '../lib/library-display'
import { translateStatus, translateType } from '../lib/i18n'
import { useLocale } from './LocaleProvider'
import CoverPlaceholder from './CoverPlaceholder'
import LibraryViewControls from './LibraryViewControls'
import { useVaultPreferences } from './VaultPreferencesProvider'
import { useToast } from './ToastProvider'

const buttonClass = 'min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-blue-200 transition hover:border-blue-400/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:opacity-50'

export default function LibraryTools({ filters, favoritesOnly = false, items, returnTo, selectionActive = false }: {
  filters: LibraryFilters
  favoritesOnly?: boolean
  items: MediaItem[]
  returnTo: string
  selectionActive?: boolean
}) {
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <LibraryViewControls />
        {!selectionActive ? <PlanningPicker key={returnTo} items={items} returnTo={returnTo} /> : null}
      </div>
      <SavedViews filters={filters} favoritesOnly={favoritesOnly} pathname={returnTo.split('?')[0]} />
    </div>
  )
}

function SavedViews({ filters, favoritesOnly, pathname }: { filters: LibraryFilters; favoritesOnly: boolean; pathname: string }) {
  const { locale, t } = useLocale()
  const { savedViews, saveView, removeSavedView, canSave } = useVaultPreferences()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const { showToast } = useToast()
  if (!canSave) return null
  return (
    <details className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-3">
      <summary className="min-h-11 cursor-pointer rounded-xl px-1 py-3 text-sm font-semibold text-slate-200 focus-visible:outline-2 focus-visible:outline-blue-400">{t('savedViews.heading', { count: savedViews.length })}</summary>
      <p className="mt-2 text-xs leading-5 text-slate-400">{t('savedViews.hint')}</p>
      <form className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row" onSubmit={(event) => {
        event.preventDefault()
        const result = saveView({ name, pathname, filters, favoritesOnly })
        if (!result.success) { setError(result.error ?? t('savedViews.saveError')); return }
        setName(''); setError('')
        showToast(t(result.persistent ? 'savedViews.saved' : 'savedViews.sessionOnly'))
      }}>
        <input aria-label={t('savedViews.name')} value={name} maxLength={60} onChange={(event) => { setName(event.target.value); setError('') }} placeholder={t('savedViews.placeholder')}
          className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30" />
        <button type="submit" className={buttonClass}>{t('savedViews.save')}</button>
      </form>
      {error ? <p role="alert" className="mt-3 text-sm text-red-200">{translateError(locale, error)}</p> : null}
      {savedViews.length === 0 ? <p className="mt-3 text-xs text-slate-500">{t('savedViews.empty')}</p> : (
        <ul className="mt-3 space-y-2">
          {savedViews.map((view) => <li key={view.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1">
            <Link href={getSavedLibraryViewHref(view)} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-xl py-2 focus-visible:outline-2 focus-visible:outline-blue-400">
              <span className="break-words text-sm font-semibold text-slate-100">{view.name}</span>
              <span className="text-xs text-slate-500">{getSavedViewLocationLabel(locale, view.pathname)}</span>
            </Link>
            <button type="button" aria-label={t('savedViews.remove', { name: view.name })} onClick={() => removeSavedView(view.id)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-900 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-blue-400"><X aria-hidden="true" className="h-4 w-4" /></button>
          </li>)}
        </ul>
      )}
    </details>
  )
}

function PlanningPicker({ items, returnTo }: { items: MediaItem[]; returnTo: string }) {
  const { t } = useLocale()
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [isEmpty, setIsEmpty] = useState(false)
  const pool = items.filter((item) => item.status.trim().toLowerCase() === 'planning')
  const picked = pool.find((item) => item.id === pickedId)
  function pick() {
    const next = pickPlanningItem(pool.length > 1 ? pool.filter((item) => item.id !== pickedId) : pool)
    if (!next) { setIsEmpty(true); return }
    setPickedId(next.id); setIsEmpty(false)
  }
  return (
    <div className="min-w-0 sm:max-w-sm">
      <button type="button" onClick={pick} className={`${buttonClass} inline-flex items-center justify-center gap-2`}><Shuffle aria-hidden="true" className="h-4 w-4" />{t('picker.action')}</button>
      {isEmpty ? <p role="status" className="mt-2 text-xs leading-5 text-slate-400">{t('picker.empty')}</p> : null}
      {picked ? <PlanningPreview item={picked} returnTo={returnTo} count={pool.length} onClose={() => setPickedId(null)} onPick={pick} /> : null}
    </div>
  )
}

function PlanningPreview({ item, returnTo, count, onClose, onPick }: { item: MediaItem; returnTo: string; count: number; onClose: () => void; onPick: () => void }) {
  const { locale, t } = useLocale()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return (
    <dialog ref={ref} aria-labelledby="planning-picker-title" onClose={() => { if (!ref.current?.open) onClose() }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh_-_3rem_-_env(safe-area-inset-bottom))] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-5 text-slate-100 shadow-2xl backdrop:bg-slate-950/80 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">{t('picker.fromPlanning')}</p>
      <div className="mt-4 grid min-w-0 grid-cols-[80px_minmax(0,1fr)] items-start gap-4">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-slate-950">
          {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="80px" className="object-cover" /> : <CoverPlaceholder title={item.title} type={item.type} typeLabel={translateType(locale, item.type)} ariaLabel={t('card.coverPlaceholder', { title: item.title })} />}
        </div>
        <div className="min-w-0"><h2 id="planning-picker-title" className="break-words text-lg font-bold">{item.title}</h2>
          <p className="mt-2 text-sm text-slate-400">{translateType(locale, item.type)} / {translateStatus(locale, item.status)}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{t(count === 1 ? 'picker.countOne' : 'picker.countMany', { count })}</p></div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Link href={{ pathname: `/items/${item.id}`, query: { returnTo } }} className={`${buttonClass} flex items-center justify-center bg-blue-500/10`}>{t('picker.open')}</Link>
        <button type="button" disabled={count < 2} onClick={onPick} className={buttonClass}>{t('picker.another')}</button>
        <button type="button" onClick={() => ref.current?.close()} className={`${buttonClass} sm:col-span-2`}>{t('picker.close')}</button>
      </div>
    </dialog>
  )
}
