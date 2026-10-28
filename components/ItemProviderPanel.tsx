'use client'

import Link from 'next/link'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ProviderDetails } from '../lib/provider-details'
import RelatedTitles from './catalog/RelatedTitles'
import { useLocale } from './LocaleProvider'
import type { MessageKey } from '../lib/i18n'

type LoadState = { status: 'idle' | 'loading' | 'error'; error?: string; errorKey?: MessageKey }
  | { status: 'ready'; data: ProviderDetails }

export default function ItemProviderPanel({ itemId, supported }: { itemId: string; supported: boolean }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const controllerRef = useRef<AbortController | null>(null)
  const panelId = useId()

  useEffect(() => () => controllerRef.current?.abort(), [])

  async function load() {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setState({ status: 'loading' })
    try {
      const response = await fetch(`/api/items/${encodeURIComponent(itemId)}/provider`, {
        signal: controller.signal, cache: 'no-store',
      })
      const payload = await response.json() as { data?: ProviderDetails; error?: string }
      if (controller.signal.aborted) return
      setState(response.ok && payload.data ? { status: 'ready', data: payload.data }
        : { status: 'error', error: payload.error, errorKey: 'provider.unavailable' })
    } catch {
      if (!controller.signal.aborted) setState({ status: 'error', errorKey: 'provider.offline' })
    }
  }

  return (
    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <button type="button" aria-expanded={open} aria-controls={panelId}
        onClick={() => { setOpen(!open); if (!open && supported && state.status === 'idle') void load() }}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">
        <span><span className="block text-sm font-semibold text-slate-100">{t('provider.about')}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-400">{t('provider.separate')}</span></span>
        <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-blue-200 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={panelId} hidden={!open} className="mt-4 min-w-0 space-y-4 border-t border-slate-800 pt-4">
        {!supported ? <p className="text-sm leading-6 text-slate-400">{t('provider.unsupported')}<Link href="/discover" className="text-blue-200 underline">{t('nav.discover')}</Link>{t('provider.unsupportedEnd')}</p> : null}
        {state.status === 'loading' ? <p role="status" className="text-sm text-slate-400">{t('catalog.loadingDetails')}</p> : null}
        {state.status === 'error' ? <div role="alert" className="space-y-3 text-sm text-slate-300">
          <p>{state.error ?? t(state.errorKey ?? 'provider.unavailable')}</p><button type="button" onClick={() => void load()} className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 font-semibold text-blue-200">{t('catalog.tryAgain')}</button>
        </div> : null}
        {state.status === 'ready' ? <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            {[state.data.provider, state.data.year, state.data.format, state.data.durationMinutes ? `${state.data.durationMinutes} min` : null]
              .filter(Boolean).map((label, index) => <span key={`${index}-${label}`} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">{label}</span>)}
          </div>
          {state.data.title ? <p className="break-words text-sm font-semibold text-slate-100">{state.data.title}</p> : null}
          <p className={`whitespace-pre-line break-words text-sm leading-7 text-slate-300 ${expanded || state.data.description.length <= 400 ? '' : 'line-clamp-6'}`}>
            {state.data.description || t('catalog.noDescription')}
          </p>
          {state.data.description.length > 400 ? <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="min-h-11 rounded-xl px-2 text-sm font-semibold text-blue-200">{expanded ? t('provider.showLess') : t('provider.showFull')}</button> : null}
          {state.data.genres.length > 0 ? <div className="flex flex-wrap gap-2">{state.data.genres.map((genre) => <span key={genre} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-400">{genre}</span>)}</div> : null}
          <a href={state.data.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-blue-200">
            {t('provider.openOn', { provider: state.data.provider })}<ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
          <p className="text-xs leading-5 text-slate-500">{t('provider.readOnlyHint')}</p>
          {state.data.provider === 'AniList' ? <RelatedTitles titles={state.data.relatedTitles ?? []} /> : null}
        </> : null}
      </div>
    </section>
  )
}
