'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'

import {
  refreshCurrentUserItemMetadata,
  type MetadataRefreshResult,
} from '../app/actions/metadata'
import { useToast } from './ToastProvider'

function formatResultMessage(result: MetadataRefreshResult) {
  if (result.error) {
    return result.error
  }

  if (result.updated === 0) {
    return `Checked ${result.checked} items. No metadata updates were needed.`
  }

  return `Checked ${result.checked} items and updated ${result.updated}.`
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  )
}

export default function MetadataRefreshButton() {
  const router = useRouter()
  const { showToast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<MetadataRefreshResult | null>(null)

  function handleRefresh() {
    setResult(null)

    startTransition(async () => {
      const nextResult = await refreshCurrentUserItemMetadata()
      setResult(nextResult)

      const message = formatResultMessage(nextResult)
      showToast(message, nextResult.error ? 'error' : 'success')

      if (!nextResult.error) {
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Refresh provider metadata</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Fill official ratings, missing covers, genres, and missing totals from AniList
            or TMDB without changing your notes, status, progress, rating, favorites, or lists.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isPending}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Refreshing...' : 'Refresh metadata'}
        </button>
      </div>

      {result ? (
        <div
          className={`mt-4 rounded-xl border p-4 ${
            result.error
              ? 'border-red-500/30 bg-red-500/10 text-red-100'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.error ? (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold">{formatResultMessage(result)}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <SummaryPill label="Checked" value={result.checked} />
                <SummaryPill label="Updated" value={result.updated} />
                <SummaryPill label="Ratings" value={result.ratingsAdded} />
                <SummaryPill label="Covers" value={result.coversAdded} />
                <SummaryPill label="Skipped" value={result.skipped} />
                <SummaryPill label="Failed" value={result.failed} />
              </div>
              {result.genresUpdated > 0 || result.totalsUpdated > 0 ? (
                <p className="mt-3 text-xs leading-5 text-emerald-100/80">
                  Genres updated: {result.genresUpdated}. Totals filled:{' '}
                  {result.totalsUpdated}.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
