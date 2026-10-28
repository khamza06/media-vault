'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { dispatchOpenAddModal } from '../../lib/add-modal-events'
import type { CatalogSearchCandidate } from '../../lib/catalog-types'
import type { CatalogOwnedItem } from '../../lib/catalog-view'
import { formatExternalRatingValue } from '../../lib/media'
import CoverPlaceholder from '../CoverPlaceholder'
import ActionFeedback from '../ui/ActionFeedback'
import { useLocale } from '../LocaleProvider'
import { translateType, type MessageKey } from '../../lib/i18n'

export default function CatalogPreview({ candidate, ownedItem, onClose }: {
  candidate: CatalogSearchCandidate
  ownedItem: CatalogOwnedItem | null
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { locale, t } = useLocale()
  const [details, setDetails] = useState(candidate)
  const [isLoading, setIsLoading] = useState(candidate.provider === 'TMDB')
  const [warning, setWarning] = useState<{ text?: string; fallback: MessageKey } | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  useEffect(() => {
    if (candidate.provider !== 'TMDB') return
    const controller = new AbortController()
    let cancelled = false
    async function loadDetails() {
      try {
        const response = await fetch('/api/catalog-details', {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: candidate.id, type: candidate.type === 'Movie' ? 'movie' : 'series' }),
        })
        const payload = await response.json() as { data?: CatalogSearchCandidate; error?: string }
        if (cancelled) return
        if (response.ok && payload.data) setDetails(payload.data)
        else setWarning({ text: payload.error, fallback: 'catalog.extraUnavailable' })
      } catch {
        if (!cancelled) setWarning({ fallback: 'catalog.extraOffline' })
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadDetails()
    return () => { cancelled = true; controller.abort() }
  }, [candidate])

  const description = details.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim()

  return (
    <dialog ref={dialogRef} onClose={() => {
      // Strict Mode can queue a cleanup close event after the dialog has reopened.
      if (!dialogRef.current?.open) onClose()
    }} aria-labelledby="catalog-preview-title"
      className="fixed inset-0 m-auto max-h-[calc(100dvh_-_3rem_-_env(safe-area-inset-bottom))] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/80">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-5 py-3">
        <p className="text-sm font-semibold text-slate-400">{t('catalog.titlePreview')}</p>
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label={t('catalog.closePreview')}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-400"><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <div className="grid min-w-0 gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <div className="mx-auto aspect-[2/3] w-28 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 sm:w-full">
            {details.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={details.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : <CoverPlaceholder title={details.title} type={details.type} typeLabel={translateType(locale, details.type)} />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">{details.provider} / {translateType(locale, details.type)}</p>
            <h2 id="catalog-preview-title" className="mt-2 break-words text-2xl font-bold tracking-tight">{details.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{details.year ?? t('catalog.unknownYear')}{details.subtitle ? ` / ${details.subtitle}` : ''}</p>
            {details.externalRatingLabel && typeof details.externalRatingValue === 'number' ? (
              <p className="mt-3 text-sm font-semibold text-amber-200">{formatExternalRatingValue(details.externalRatingLabel, details.externalRatingValue)}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {details.genres.split(',').map((genre) => genre.trim()).filter(Boolean).map((genre) => (
                <span key={genre} className="rounded-xl border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300">{genre}</span>
              ))}
            </div>
          </div>
        </div>
        {isLoading ? <ActionFeedback tone="pending">{t('catalog.loadingDetails')}</ActionFeedback> : null}
        {warning ? <p role="status" className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">{warning.text ?? t(warning.fallback)}</p> : null}
        <p className="whitespace-pre-line break-words text-sm leading-7 text-slate-300">{description ? description.slice(0, 5000) : t('catalog.noDescription')}</p>
        {ownedItem ? (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-sm font-semibold text-emerald-100">{t('catalog.alreadySaved')}</p>
            <Link href={`/items/${ownedItem.id}`} className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm">{t('catalog.openItem')}</Link>
          </div>
        ) : (
          <button type="button" disabled={isLoading} onClick={() => {
            dialogRef.current?.close()
            dispatchOpenAddModal({ candidate: details })
          }} className="min-h-12 w-full rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-wait disabled:opacity-60">{t('catalog.addToVault')}</button>
        )}
        <p className="text-xs leading-5 text-slate-400">{t('catalog.reviewHint')}</p>
      </div>
    </dialog>
  )
}
