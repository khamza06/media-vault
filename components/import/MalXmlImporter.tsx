'use client'

import {
  deleteMyAnimeListImports,
  enrichMissingAnimeMangaCovers,
  importMyAnimeListItems,
  type DeleteMyAnimeListImportsResult,
  type MalImportCandidate,
  type MalImportResult,
  type MissingCoverEnrichmentResult,
} from '@/app/actions/import'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ChangeEvent } from 'react'
import { useMemo, useRef, useState } from 'react'

type ImportCandidate = MalImportCandidate
type CoverFillStatus = 'cancelled' | 'error' | 'finished' | 'max-batches' | 'running' | 'stalled'
type CoverFillProgress = {
  batches: number
  checked: number
  error: string | null
  failed: number
  foundByJikan: number
  foundByMalId: number
  foundByTitle: number
  skipped: number
  status: CoverFillStatus
  updated: number
}

const COVER_FILL_BATCH_DELAY_MS = 700
const MAX_COVER_FILL_BATCHES = 20
const PREVIEW_LIMIT = 250

function getText(parent: Element, tagNames: string[]) {
  for (const tagName of tagNames) {
    const value = parent.getElementsByTagName(tagName).item(0)?.textContent?.trim()

    if (value) {
      return value
    }
  }

  return ''
}

function normalizeRating(value: string) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
    return null
  }

  return parsed
}

function normalizeProgress(value: string) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isInteger(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

function buildMyAnimeListUrl(type: ImportCandidate['type'], externalId: string | null) {
  if (!externalId || !/^\d+$/.test(externalId)) {
    return null
  }

  return `https://myanimelist.net/${type}/${externalId}`
}

function normalizeStatus(value: string, type: ImportCandidate['type']) {
  const status = value.trim().toLowerCase().replace(/[_-]+/g, ' ')

  switch (status) {
    case 'watching':
      return type === 'anime' ? 'Watching' : 'Reading'
    case 'reading':
      return 'Reading'
    case 'completed':
      return 'Completed'
    case 'dropped':
      return 'Dropped'
    case 'plan to watch':
    case 'plan to read':
    case 'on hold':
      return 'Planning'
    default:
      return type === 'anime' ? 'Planning' : 'Reading'
  }
}

function parseAnimeEntry(entry: Element): ImportCandidate | null {
  const title = getText(entry, ['series_title'])

  if (!title) {
    return null
  }

  const externalId = getText(entry, ['series_animedb_id']) || null

  return {
    title,
    type: 'anime',
    status: normalizeStatus(getText(entry, ['my_status']), 'anime'),
    rating: normalizeRating(getText(entry, ['my_score'])),
    progress: normalizeProgress(getText(entry, ['my_watched_episodes'])),
    external_source: 'myanimelist',
    external_id: externalId,
    external_url: buildMyAnimeListUrl('anime', externalId),
    notes: '',
  }
}

function parseMangaEntry(entry: Element): ImportCandidate | null {
  const title = getText(entry, ['manga_title', 'series_title'])

  if (!title) {
    return null
  }

  const externalId = getText(entry, ['manga_mangadb_id', 'series_mangadb_id']) || null

  return {
    title,
    type: 'manga',
    status: normalizeStatus(getText(entry, ['my_status']), 'manga'),
    rating: normalizeRating(getText(entry, ['my_score'])),
    progress: normalizeProgress(getText(entry, ['my_read_chapters'])),
    external_source: 'myanimelist',
    external_id: externalId,
    external_url: buildMyAnimeListUrl('manga', externalId),
    notes: '',
  }
}

function parseMalXml(xmlText: string) {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml')
  const parserError = xml.getElementsByTagName('parsererror').item(0)

  if (parserError) {
    throw new Error('invalid-xml')
  }

  const animeCandidates = Array.from(xml.getElementsByTagName('anime'))
    .map(parseAnimeEntry)
    .filter((candidate): candidate is ImportCandidate => candidate !== null)
  const mangaCandidates = Array.from(xml.getElementsByTagName('manga'))
    .map(parseMangaEntry)
    .filter((candidate): candidate is ImportCandidate => candidate !== null)

  return [...animeCandidates, ...mangaCandidates]
}

function getCandidateKey(candidate: ImportCandidate, index: number) {
  return `${candidate.external_source}:${candidate.type}:${candidate.external_id ?? 'no-id'}:${candidate.title}:${index}`
}

function formatImportResult(result: MalImportResult) {
  if (result.error) {
    return result.error
  }

  if (result.imported > 0) {
    const withoutMetadata = Math.max(result.imported - result.enriched, 0)
    const metadataCopy =
      withoutMetadata > 0
        ? `Enriched ${result.enriched} with covers. ${withoutMetadata} imported without metadata.`
        : `Enriched ${result.enriched} with covers.`

    return `Imported ${result.imported} items. ${metadataCopy} Skipped ${result.skipped} duplicates.`
  }

  return `No items imported. ${result.skipped} items were skipped as duplicates.`
}

function createEmptyCoverFillProgress(status: CoverFillStatus): CoverFillProgress {
  return {
    batches: 0,
    checked: 0,
    error: null,
    failed: 0,
    foundByJikan: 0,
    foundByMalId: 0,
    foundByTitle: 0,
    skipped: 0,
    status,
    updated: 0,
  }
}

function getFoundCount(
  result: Pick<CoverFillProgress, 'foundByJikan' | 'foundByMalId' | 'foundByTitle'>
) {
  return result.foundByMalId + result.foundByJikan + result.foundByTitle
}

function addCoverFillBatch(
  current: CoverFillProgress,
  result: MissingCoverEnrichmentResult,
  status: CoverFillStatus
): CoverFillProgress {
  return {
    batches: current.batches + 1,
    checked: current.checked + result.checked,
    error: result.error,
    failed: current.failed + result.failed,
    foundByJikan: current.foundByJikan + result.foundByJikan,
    foundByMalId: current.foundByMalId + result.foundByMalId,
    foundByTitle: current.foundByTitle + result.foundByTitle,
    skipped: current.skipped + result.skipped,
    status,
    updated: current.updated + result.updated,
  }
}

function waitForNextCoverBatch() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, COVER_FILL_BATCH_DELAY_MS)
  })
}

function formatCoverFillResult(result: CoverFillProgress) {
  const found = getFoundCount(result)
  const totals = `Checked ${result.checked}. Found ${found}. Updated ${result.updated}. Skipped ${result.skipped}. Failed ${result.failed}.`

  if (result.status === 'running') {
    return `Batch ${result.batches + 1} running... ${totals}`
  }

  if (result.status === 'cancelled') {
    return `Cancelled after batch ${result.batches}. ${totals}`
  }

  if (result.status === 'error') {
    return `Stopped after batch ${result.batches} because enrichment failed. ${totals} ${result.error ?? ''}`.trim()
  }

  if (result.status === 'max-batches') {
    return `Paused after ${MAX_COVER_FILL_BATCHES} safe batches. ${totals} Click again to continue if needed.`
  }

  if (result.status === 'stalled') {
    return `Finished because the last batches had no new matches. ${totals}`
  }

  if (result.checked === 0) {
    return 'Finished. No anime or manga items with missing covers were found.'
  }

  return `Finished. ${totals}`
}

export default function MalXmlImporter({
  canDeleteMalImports = false,
}: {
  canDeleteMalImports?: boolean
}) {
  const router = useRouter()
  const coverFillCancelRef = useRef(false)
  const coverFillRunIdRef = useRef(0)
  const [candidates, setCandidates] = useState<ImportCandidate[]>([])
  const [cleanupConfirmText, setCleanupConfirmText] = useState('')
  const [cleanupResult, setCleanupResult] = useState<DeleteMyAnimeListImportsResult | null>(null)
  const [coverFillProgress, setCoverFillProgress] = useState<CoverFillProgress | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [fileName, setFileName] = useState('')
  const [importResult, setImportResult] = useState<MalImportResult | null>(null)
  const [isCleanupDialogOpen, setIsCleanupDialogOpen] = useState(false)
  const [isDeletingMalImports, setIsDeletingMalImports] = useState(false)
  const [isFillingCovers, setIsFillingCovers] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const summary = useMemo(() => {
    const byType = candidates.reduce(
      (accumulator, candidate) => {
        accumulator[candidate.type] += 1
        return accumulator
      },
      { anime: 0, manga: 0 }
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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.item(0)

    setCandidates([])
    setErrorMessage('')
    setImportResult(null)
    setSelectedKeys(new Set())

    if (!file) {
      setFileName('')
      return
    }

    setFileName(file.name)

    if (!file.name.toLowerCase().endsWith('.xml')) {
      setErrorMessage('Please upload a .xml file exported from MyAnimeList.')
      return
    }

    setIsParsing(true)

    try {
      const xmlText = await file.text()
      const parsedCandidates = parseMalXml(xmlText)
      setCandidates(parsedCandidates)
      setSelectedKeys(new Set(parsedCandidates.map(getCandidateKey)))
    } catch {
      setErrorMessage(
        'Could not parse this XML file. Please make sure it is a valid MyAnimeList export.'
      )
    } finally {
      setIsParsing(false)
    }
  }

  async function handleImportSelected() {
    const selectedCandidates = candidates.filter((candidate, index) =>
      selectedKeys.has(getCandidateKey(candidate, index))
    )

    if (selectedCandidates.length === 0 || isImporting) {
      return
    }

    setIsImporting(true)
    setErrorMessage('')
    setImportResult(null)

    try {
      const result = await importMyAnimeListItems(selectedCandidates)
      setImportResult(result)

      if (!result.error && result.imported > 0) {
        router.refresh()
      }
    } catch {
      setImportResult({
        enriched: 0,
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

  async function handleFillMissingCovers() {
    if (isFillingCovers) {
      return
    }

    const runId = coverFillRunIdRef.current + 1
    coverFillRunIdRef.current = runId
    coverFillCancelRef.current = false

    setIsFillingCovers(true)
    setCoverFillProgress(createEmptyCoverFillProgress('running'))

    let totals = createEmptyCoverFillProgress('running')
    let noProgressBatches = 0

    try {
      for (let batch = 1; batch <= MAX_COVER_FILL_BATCHES; batch += 1) {
        if (coverFillCancelRef.current || coverFillRunIdRef.current !== runId) {
          totals = {
            ...totals,
            status: 'cancelled',
          }
          setCoverFillProgress(totals)
          break
        }

        setCoverFillProgress({
          ...totals,
          status: 'running',
        })

        const result = await enrichMissingAnimeMangaCovers()

        if (coverFillRunIdRef.current !== runId) {
          return
        }

        if (result.error) {
          totals = addCoverFillBatch(totals, result, 'error')
          setCoverFillProgress(totals)
          break
        }

        const foundThisBatch = getFoundCount(result)
        const noProgressThisBatch = result.checked > 0 && result.updated === 0 && foundThisBatch === 0

        noProgressBatches = noProgressThisBatch ? noProgressBatches + 1 : 0

        let nextStatus: CoverFillStatus = 'running'

        if (result.checked === 0) {
          nextStatus = 'finished'
        } else if (coverFillCancelRef.current) {
          nextStatus = 'cancelled'
        } else if (batch === MAX_COVER_FILL_BATCHES) {
          nextStatus = 'max-batches'
        } else if (noProgressBatches >= 2) {
          nextStatus = 'stalled'
        }

        totals = addCoverFillBatch(totals, result, nextStatus)
        setCoverFillProgress(totals)

        if (nextStatus !== 'running') {
          break
        }

        await waitForNextCoverBatch()
      }
    } catch {
      totals = {
        ...totals,
        error: 'Could not fill missing covers. Please try again.',
        status: 'error',
      }
      setCoverFillProgress(totals)
    } finally {
      setIsFillingCovers(false)
      router.refresh()
    }
  }

  function handleCancelCoverFill() {
    coverFillCancelRef.current = true
  }

  async function handleDeleteMyAnimeListImports() {
    if (cleanupConfirmText !== 'DELETE' || isDeletingMalImports) {
      return
    }

    setIsDeletingMalImports(true)
    setCleanupResult(null)

    try {
      const result = await deleteMyAnimeListImports()
      setCleanupResult(result)

      if (result.success) {
        setIsCleanupDialogOpen(false)
        setCleanupConfirmText('')
        router.refresh()
      }
    } catch {
      setCleanupResult({
        deleted: 0,
        error: 'Could not delete MyAnimeList imports. Please try again.',
        success: false,
      })
    } finally {
      setIsDeletingMalImports(false)
    }
  }

  function selectAllCandidates() {
    setSelectedKeys(new Set(candidates.map(getCandidateKey)))
  }

  function deselectAllCandidates() {
    setSelectedKeys(new Set())
  }

  function toggleCandidate(candidate: ImportCandidate, index: number) {
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

  const visibleCandidates = candidates.slice(0, PREVIEW_LIMIT)
  const hasParsedCandidates = candidates.length > 0
  const showNoEntriesMessage = Boolean(fileName) && !isParsing && !errorMessage && !hasParsedCandidates
  const selectedCount = candidates.reduce(
    (count, candidate, index) =>
      selectedKeys.has(getCandidateKey(candidate, index)) ? count + 1 : count,
    0
  )
  const isImportDisabled = !hasParsedCandidates || selectedCount === 0 || isImporting || isParsing

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <label className="block text-sm font-semibold text-slate-100" htmlFor="mal-xml-file">
          MyAnimeList XML export
        </label>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Choose your MyAnimeList XML export file to preview your library before importing.
        </p>
        <input
          id="mal-xml-file"
          type="file"
          accept=".xml,text/xml,application/xml"
          onChange={handleFileChange}
          className="mt-4 block min-h-12 w-full cursor-pointer rounded-xl border border-slate-800 bg-slate-900 text-sm text-slate-300 file:mr-4 file:min-h-12 file:cursor-pointer file:rounded-xl file:border-0 file:bg-blue-500 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-white hover:border-slate-700"
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Fill Missing Covers</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Search AniList for anime and manga items in your library that do not have cover
              images yet.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:min-w-56">
            <button
              type="button"
              onClick={() => void handleFillMissingCovers()}
              disabled={isFillingCovers}
              className="min-h-12 rounded-xl border border-blue-400/20 bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-500"
            >
              {isFillingCovers ? 'Filling covers...' : 'Fill missing covers'}
            </button>
            {isFillingCovers ? (
              <button
                type="button"
                onClick={handleCancelCoverFill}
                className="min-h-12 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-red-400/50 hover:text-red-100"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
        {coverFillProgress ? (
          <div
            className={`mt-4 rounded-xl border p-4 text-sm ${
              coverFillProgress.status === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-100'
                : coverFillProgress.status === 'running'
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-100'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
            }`}
          >
            <p className="font-semibold">{formatCoverFillResult(coverFillProgress)}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <CoverFillMetric label="Batches" value={coverFillProgress.batches} />
              <CoverFillMetric label="Checked" value={coverFillProgress.checked} />
              <CoverFillMetric label="Found" value={getFoundCount(coverFillProgress)} />
              <CoverFillMetric label="Updated" value={coverFillProgress.updated} />
              <CoverFillMetric label="Skipped" value={coverFillProgress.skipped} />
              <CoverFillMetric label="Failed" value={coverFillProgress.failed} />
            </div>
            <p className="mt-3 text-xs leading-5 opacity-80">
              MAL ID: {coverFillProgress.foundByMalId} | Jikan: {coverFillProgress.foundByJikan} |
              Title search: {coverFillProgress.foundByTitle}
            </p>
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      {isParsing ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
          Parsing XML preview...
        </div>
      ) : null}

      {!fileName && !isParsing ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
          Upload a MyAnimeList XML export file to preview your library.
        </div>
      ) : null}

      {showNoEntriesMessage ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          No valid MyAnimeList entries were found in this file.
        </div>
      ) : null}

      {hasParsedCandidates ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Parsed items" value={summary.total.toString()} />
            <SummaryCard label="Anime" value={summary.byType.anime.toString()} />
            <SummaryCard label="Manga" value={summary.byType.manga.toString()} />
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Preview</h3>
                <p className="text-sm text-slate-400">
                  Review the parsed items, choose what to import, then save them to your vault.
                </p>
                <p className="mt-2 text-sm font-medium text-slate-200">
                  Selected {selectedCount} of {candidates.length} items
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
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
                {candidates.length > PREVIEW_LIMIT ? (
                  <p className="text-xs text-slate-400">
                    Showing first {PREVIEW_LIMIT} of {candidates.length} items.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 max-h-[36rem] space-y-3 overflow-y-auto pr-1">
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
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="font-semibold text-slate-100">{candidate.title}</h4>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                            MyAnimeList
                            {candidate.external_id ? ` #${candidate.external_id}` : ''}
                          </p>
                        </div>
                        <span className="w-fit rounded-xl border border-blue-400/30 bg-blue-500/15 px-3 py-1 text-xs font-semibold capitalize text-blue-100">
                          {candidate.type}
                        </span>
                      </div>

                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                        <PreviewField label="Status" value={candidate.status ?? 'Unknown'} />
                        <PreviewField
                          label="Rating"
                          value={candidate.rating == null ? 'Unrated' : `${candidate.rating} / 10`}
                        />
                        <PreviewField
                          label="Progress"
                          value={candidate.progress == null ? 'Not started' : candidate.progress}
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
              {isImporting ? 'Importing...' : 'Import selected items'}
            </button>
            <p className="mt-3 text-center text-sm text-slate-400">
              Selected items will be added to your vault. Existing title/type duplicates are skipped.
            </p>
          </div>
        </section>
      ) : null}

      {canDeleteMalImports ? (
        <section className="rounded-xl border border-red-900/50 bg-slate-900 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-200/70">
            Danger Zone
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-100">Delete MyAnimeList imports</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Remove items imported from MyAnimeList from your vault. Manually added items will
                not be affected.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCleanupResult(null)
                setCleanupConfirmText('')
                setIsCleanupDialogOpen(true)
              }}
              disabled={isDeletingMalImports}
              className="min-h-12 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete MyAnimeList imports
            </button>
          </div>

          {cleanupResult ? (
            <div
              className={`mt-4 rounded-xl border p-4 text-sm ${
                cleanupResult.success
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-red-500/30 bg-red-500/10 text-red-100'
              }`}
            >
              {cleanupResult.success
                ? `Deleted ${cleanupResult.deleted} MyAnimeList imported item${
                    cleanupResult.deleted === 1 ? '' : 's'
                  }.`
                : cleanupResult.error}
            </div>
          ) : null}
        </section>
      ) : null}

      {isCleanupDialogOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mal-cleanup-title"
            className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
          >
            <h2 id="mal-cleanup-title" className="text-xl font-bold text-slate-100">
              Delete all MyAnimeList imports?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This will permanently remove items imported from MyAnimeList from your vault. This
              action cannot be undone.
            </p>
            <label className="mt-5 block">
              <span className="text-sm font-semibold text-slate-200">
                Type DELETE to confirm
              </span>
              <input
                type="text"
                value={cleanupConfirmText}
                onChange={(event) => setCleanupConfirmText(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-red-400"
                autoComplete="off"
              />
            </label>

            {cleanupResult && !cleanupResult.success ? (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
                {cleanupResult.error}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingMalImports) {
                    setIsCleanupDialogOpen(false)
                    setCleanupConfirmText('')
                  }
                }}
                disabled={isDeletingMalImports}
                className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteMyAnimeListImports()}
                disabled={cleanupConfirmText !== 'DELETE' || isDeletingMalImports}
                className="min-h-11 rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeletingMalImports ? 'Deleting...' : 'Delete MyAnimeList imports'}
              </button>
            </div>
          </div>
        </div>
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

function CoverFillMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 px-3 py-2">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] opacity-70">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold">{value}</p>
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
