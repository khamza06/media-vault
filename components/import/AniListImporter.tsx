'use client'

import {
  fetchAniListLibraryByUsername,
  importAniListItems,
  type AniListFetchResult,
  type AniListImportCandidate,
  type AniListImportResult,
} from '@/app/actions/import'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useMemo, useState } from 'react'

const PREVIEW_LIMIT = 250

function getCandidateKey(candidate: AniListImportCandidate, index: number) {
  return `${candidate.external_source}:${candidate.type}:${
    candidate.external_id ?? 'no-id'
  }:${candidate.title}:${index}`
}

function formatTypeLabel(type: AniListImportCandidate['type']) {
  switch (type) {
    case 'anime':
      return 'Anime'
    case 'manhwa':
      return 'Manhwa'
    case 'manhua':
      return 'Manhua'
    case 'manga':
    default:
      return 'Manga'
  }
}

function formatImportResult(result: AniListImportResult) {
  if (result.error) {
    return result.error
  }

  if (result.imported > 0) {
    return `Imported ${result.imported} AniList items. Skipped ${result.skipped} duplicates.`
  }

  return `No items imported. ${result.skipped} items were skipped as duplicates.`
}

function formatExternalScore(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return 'No official score'
  }

  return `AniList ${value.toFixed(1)} / 10`
}

export default function AniListImporter({ canImport = false }: { canImport?: boolean }) {
  const router = useRouter()
  const [candidates, setCandidates] = useState<AniListImportCandidate[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [fetchResult, setFetchResult] = useState<AniListFetchResult | null>(null)
  const [importResult, setImportResult] = useState<AniListImportResult | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [username, setUsername] = useState('')

  const summary = useMemo(() => {
    const byType = candidates.reduce(
      (accumulator, candidate) => {
        accumulator[candidate.type] += 1
        return accumulator
      },
      { anime: 0, manga: 0, manhua: 0, manhwa: 0 }
    )
    const byStatus = candidates.reduce<Record<string, number>>((accumulator, candidate) => {
      const status = candidate.status || 'Unknown'
      accumulator[status] = (accumulator[status] ?? 0) + 1
      return accumulator
    }, {})

    return {
      byStatus: Object.entries(byStatus).sort(([left], [right]) => left.localeCompare(right)),
      byType,
      total: candidates.length,
    }
  }, [candidates])

  const selectedCount = candidates.reduce(
    (count, candidate, index) =>
      selectedKeys.has(getCandidateKey(candidate, index)) ? count + 1 : count,
    0
  )
  const visibleCandidates = candidates.slice(0, PREVIEW_LIMIT)
  const hasCandidates = candidates.length > 0
  const isFetchDisabled = !canImport || isFetching || !username.trim()
  const isImportDisabled = !canImport || !hasCandidates || selectedCount === 0 || isImporting

  async function handleFetchAniListLibrary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isFetchDisabled) {
      return
    }

    setCandidates([])
    setErrorMessage('')
    setFetchResult(null)
    setImportResult(null)
    setIsFetching(true)
    setSelectedKeys(new Set())

    try {
      const result = await fetchAniListLibraryByUsername(username)
      setFetchResult(result)

      if (result.error) {
        setErrorMessage(result.error)
        return
      }

      setCandidates(result.candidates)
      setSelectedKeys(new Set(result.candidates.map(getCandidateKey)))
    } catch {
      setErrorMessage('Could not fetch this AniList library. Please try again.')
    } finally {
      setIsFetching(false)
    }
  }

  async function handleImportSelected() {
    const selectedCandidates = candidates.filter((candidate, index) =>
      selectedKeys.has(getCandidateKey(candidate, index))
    )

    if (selectedCandidates.length === 0 || isImporting) {
      return
    }

    setErrorMessage('')
    setImportResult(null)
    setIsImporting(true)

    try {
      const result = await importAniListItems(selectedCandidates)
      setImportResult(result)

      if (!result.error && result.imported > 0) {
        router.refresh()
      }
    } catch {
      setImportResult({
        error: 'Import failed. Please try again.',
        failed: selectedCandidates.length,
        imported: 0,
        skipped: 0,
        usedExternalIdColumns: false,
      })
    } finally {
      setIsImporting(false)
    }
  }

  function selectAllCandidates() {
    setSelectedKeys(new Set(candidates.map(getCandidateKey)))
  }

  function deselectAllCandidates() {
    setSelectedKeys(new Set())
  }

  function toggleCandidate(candidate: AniListImportCandidate, index: number) {
    const key = getCandidateKey(candidate, index)

    setSelectedKeys((current) => {
      const next = new Set(current)

      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }

      return next
    })
  }

  return (
    <div className="space-y-5">
      {!canImport ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Sign in to fetch and import AniList libraries.
        </div>
      ) : null}

      <form
        onSubmit={(event) => void handleFetchAniListLibrary(event)}
        className="rounded-xl border border-slate-800 bg-slate-950 p-4"
      >
        <label htmlFor="anilist-username" className="block text-sm font-semibold text-slate-100">
          AniList username
        </label>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Enter a public AniList username. The app fetches anime and manga lists for preview before
          anything is saved.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            id="anilist-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="e.g. anilist_user"
            disabled={!canImport || isFetching}
            className="min-h-12 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={isFetchDisabled}
            className="min-h-12 rounded-xl border border-blue-400/20 bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-500"
          >
            {isFetching ? 'Fetching...' : 'Fetch AniList Library'}
          </button>
        </div>
      </form>

      {errorMessage ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      {fetchResult?.warning ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          {fetchResult.warning}
        </div>
      ) : null}

      {isFetching ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
          Fetching public AniList lists...
        </div>
      ) : null}

      {!hasCandidates && !isFetching && !errorMessage ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
          Fetch a public AniList username to preview importable anime and manga entries.
        </div>
      ) : null}

      {hasCandidates ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryCard label="Parsed items" value={summary.total.toString()} />
            <SummaryCard label="Anime" value={summary.byType.anime.toString()} />
            <SummaryCard
              label="Manga family"
              value={(summary.byType.manga + summary.byType.manhwa + summary.byType.manhua).toString()}
            />
            <SummaryCard label="Selected" value={`${selectedCount}`} />
          </div>

          {summary.byStatus.length > 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <h3 className="text-sm font-semibold text-slate-100">Status breakdown</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.byStatus.map(([status, count]) => (
                  <span
                    key={status}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300"
                  >
                    {status}: {count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">AniList preview</h3>
                <p className="text-sm text-slate-400">
                  Select entries to save. The import skips existing AniList IDs and existing
                  title/type duplicates.
                </p>
                <p className="mt-2 text-sm font-medium text-slate-200">
                  Selected {selectedCount} of {candidates.length} items
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllCandidates}
                  className="min-h-11 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={deselectAllCandidates}
                  className="min-h-11 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
                >
                  Deselect all
                </button>
              </div>
            </div>

            {candidates.length > PREVIEW_LIMIT ? (
              <p className="mt-3 text-xs text-slate-400">
                Showing first {PREVIEW_LIMIT} of {candidates.length} items. Selection still applies
                to the full list.
              </p>
            ) : null}

            <div className="mt-4 max-h-[38rem] space-y-3 overflow-y-auto pr-1">
              {visibleCandidates.map((candidate, index) => (
                <article
                  key={`${candidate.external_id ?? candidate.title}-${candidate.type}-${index}`}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(getCandidateKey(candidate, index))}
                      onChange={() => toggleCandidate(candidate, index)}
                      className="mt-1 h-5 w-5 rounded-xl border-slate-700 bg-slate-950 text-blue-500"
                      aria-label={`Select ${candidate.title}`}
                    />
                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                      {candidate.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={candidate.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-2 text-center text-[0.65rem] text-slate-500">
                          No cover
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="line-clamp-2 font-semibold text-slate-100">
                            {candidate.title}
                          </h4>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            AniList
                            {candidate.external_id ? ` #${candidate.external_id}` : ''}
                          </p>
                        </div>
                        <span className="w-fit rounded-xl border border-blue-400/30 bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-100">
                          {formatTypeLabel(candidate.type)}
                        </span>
                      </div>

                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                        <PreviewField label="Status" value={candidate.status ?? 'Unknown'} />
                        <PreviewField
                          label="My rating"
                          value={candidate.rating == null ? 'Unrated' : `${candidate.rating} / 10`}
                        />
                        <PreviewField
                          label="Progress"
                          value={candidate.progress == null ? 'Not started' : candidate.progress}
                        />
                        <PreviewField
                          label="Official"
                          value={formatExternalScore(candidate.external_score)}
                        />
                      </dl>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {importResult ? (
            <div
              className={`rounded-xl border p-4 text-sm ${
                importResult.error
                  ? 'border-red-500/30 bg-red-500/10 text-red-100'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              }`}
            >
              <p className="font-semibold">{formatImportResult(importResult)}</p>
              {!importResult.error && importResult.imported > 0 ? (
                <Link
                  href="/"
                  className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-emerald-300/20 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/25"
                >
                  Go to Library
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <button
              type="button"
              disabled={isImportDisabled}
              onClick={() => void handleImportSelected()}
              className="min-h-12 w-full rounded-xl border border-blue-400/20 bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-500"
            >
              {isImporting ? 'Importing...' : 'Import selected AniList items'}
            </button>
            <p className="mt-3 text-center text-sm text-slate-400">
              Imported entries keep your AniList progress and score, while using AniList covers,
              genres, and official rating when available.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-100">{value}</p>
    </div>
  )
}

function PreviewField({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-200">{value}</dd>
    </div>
  )
}
