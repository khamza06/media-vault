'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getProgressMode } from '../lib/media'
import { useLocale } from './LocaleProvider'

type Activity = { id: string; item_id: string; media_type: string; from_progress: number; to_progress: number; occurred_at: string; item: { title: string } | null }

export default function RecentProgressActivity() {
  const { locale, t } = useLocale()
  const [open, setOpen] = useState(false)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ rows: Activity[]; revision: number; error: boolean }>({ rows: [], revision: -1, error: false })
  const pending = open && state.revision !== revision
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetch('/api/progress-activity', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
      .then(async response => { if (!response.ok) throw new Error('Unavailable'); return response.json() })
      .then(payload => { if (!controller.signal.aborted) setState({ rows: Array.isArray(payload.data) ? payload.data : [], revision, error: false }) })
      .catch(() => { if (!controller.signal.aborted) setState(current => ({ ...current, revision, error: true })) })
    const refresh = () => setRevision(value => value + 1)
    window.addEventListener('media-vault-progress-updated', refresh)
    window.addEventListener('focus', refresh)
    return () => { controller.abort(); window.removeEventListener('media-vault-progress-updated', refresh); window.removeEventListener('focus', refresh) }
  }, [open, revision])
  return <details className="glass-panel-soft min-w-0 rounded-xl border border-slate-800 p-4" onToggle={event => { setOpen(event.currentTarget.open); if (event.currentTarget.open) setRevision(value => value + 1) }}>
    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-100">{t('progress.activity')}</summary>
    <p className="mb-3 text-xs text-slate-400">{t('progress.privateHistory')}</p>
    {pending && <p role="status" className="py-2 text-sm text-slate-300">{t('progress.loading')}</p>}
    {!pending && state.error && <p role="alert" className="text-sm text-amber-200">{t('progress.activityFailed')} <button type="button" className="min-h-11 px-2 font-semibold underline" onClick={() => setRevision(value => value + 1)}>{t('progress.retry')}</button></p>}
    {!pending && !state.error && !state.rows.length && <p className="py-2 text-sm text-slate-400">{t('progress.historyEmpty')}</p>}
    <ul className="divide-y divide-slate-800">
      {state.rows.map(row => <li key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm">
        <div className="min-w-0"><Link href={`/items/${encodeURIComponent(row.item_id)}`} className="break-words font-medium text-blue-200 underline">{row.item?.title ?? t('progress.item')}</Link>
          <p className="text-xs text-slate-300">{t(`progress.${getProgressMode(row.media_type)}`)}: {row.from_progress} → {row.to_progress}</p></div>
        <time className="text-xs text-slate-400" dateTime={row.occurred_at}>{new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.occurred_at))}</time>
      </li>)}
    </ul>
  </details>
}
