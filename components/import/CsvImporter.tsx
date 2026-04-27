'use client'

import {
  importCsvItems,
  type CsvImportCandidate,
  type CsvImportResult,
} from '@/app/actions/import'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ChangeEvent, useMemo, useState } from 'react'

const PREVIEW_LIMIT = 250

type CsvRow = Record<string, string>
type CsvParseResult = {
  headers: string[]
  rows: CsvRow[]
}
type CsvMappingField =
  | 'external_id'
  | 'external_source'
  | 'image_url'
  | 'notes'
  | 'progress'
  | 'rating'
  | 'status'
  | 'title'
  | 'type'
type CsvColumnMapping = Record<CsvMappingField, string>
type PreviewCandidate = CsvImportCandidate & {
  rowIndex: number
}

const emptyMapping: CsvColumnMapping = {
  external_id: '',
  external_source: '',
  image_url: '',
  notes: '',
  progress: '',
  rating: '',
  status: '',
  title: '',
  type: '',
}

const mappingFields: Array<{
  field: CsvMappingField
  helper: string
  label: string
  required?: boolean
}> = [
  {
    field: 'title',
    helper: 'Required. Item title or name.',
    label: 'Title',
    required: true,
  },
  {
    field: 'type',
    helper: 'Required. Anime, manga, movie, series, or book.',
    label: 'Type',
    required: true,
  },
  {
    field: 'status',
    helper: 'Optional. Planning, Watching, Reading, Completed, Dropped.',
    label: 'Status',
  },
  {
    field: 'rating',
    helper: 'Optional. Personal rating from 1 to 10.',
    label: 'Rating',
  },
  {
    field: 'progress',
    helper: 'Optional. Episodes watched, chapters read, or pages read.',
    label: 'Progress',
  },
  {
    field: 'notes',
    helper: 'Optional. Preserves Markdown/plain notes.',
    label: 'Notes',
  },
  {
    field: 'image_url',
    helper: 'Optional. Cover/poster URL.',
    label: 'Image URL',
  },
  {
    field: 'external_source',
    helper: 'Optional. Example: myanimelist, anilist, tmdb.',
    label: 'External Source',
  },
  {
    field: 'external_id',
    helper: 'Optional. Used with source for duplicate protection.',
    label: 'External ID',
  },
]

const autoDetectHeaders: Record<CsvMappingField, string[]> = {
  external_id: ['external_id', 'id', 'mal_id', 'anilist_id', 'tmdb_id'],
  external_source: ['external_source', 'source'],
  image_url: ['image_url', 'image', 'cover', 'cover_url', 'poster'],
  notes: ['notes', 'note', 'comments'],
  progress: [
    'progress',
    'episodes',
    'chapters',
    'watched',
    'read',
    'my_watched_episodes',
    'my_read_chapters',
  ],
  rating: ['rating', 'score', 'my_score'],
  status: ['status', 'my_status'],
  title: ['title', 'name', 'series_title', 'media_title'],
  type: ['type', 'media_type', 'category'],
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function makeUniqueHeaders(headers: string[]) {
  const seen = new Map<string, number>()

  return headers.map((header, index) => {
    const fallback = `Column ${index + 1}`
    const baseHeader = header.trim() || fallback
    const count = seen.get(baseHeader) ?? 0
    seen.set(baseHeader, count + 1)

    return count === 0 ? baseHeader : `${baseHeader} (${count + 1})`
  })
}

function parseCsv(text: string): CsvParseResult {
  const normalizedText = text.replace(/^\uFEFF/, '')
  const parsedRows: string[][] = []
  let currentField = ''
  let currentRow: string[] = []
  let inQuotes = false

  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index]
    const nextChar = normalizedText[index + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentField += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      currentRow.push(currentField)
      currentField = ''
      continue
    }

    if (char === '\n' || char === '\r') {
      currentRow.push(currentField)
      parsedRows.push(currentRow)
      currentField = ''
      currentRow = []

      if (char === '\r' && nextChar === '\n') {
        index += 1
      }
      continue
    }

    currentField += char
  }

  if (inQuotes) {
    throw new Error('Unclosed quoted field.')
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    parsedRows.push(currentRow)
  }

  const [rawHeaders, ...rawRows] = parsedRows.filter((row) =>
    row.some((cell) => cell.trim().length > 0)
  )

  if (!rawHeaders || rawHeaders.length === 0) {
    throw new Error('CSV file has no header row.')
  }

  const headers = makeUniqueHeaders(rawHeaders)
  const rows = rawRows
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) =>
      headers.reduce<CsvRow>((record, header, index) => {
        record[header] = row[index] ?? ''
        return record
      }, {})
    )

  return { headers, rows }
}

function detectMapping(headers: string[]): CsvColumnMapping {
  const normalizedHeaders = headers.map((header) => ({
    header,
    normalized: normalizeHeader(header),
  }))

  return mappingFields.reduce<CsvColumnMapping>((mapping, { field }) => {
    const aliases = autoDetectHeaders[field].map(normalizeHeader)
    const match = normalizedHeaders.find(({ normalized }) => aliases.includes(normalized))

    return {
      ...mapping,
      [field]: match?.header ?? '',
    }
  }, emptyMapping)
}

function normalizeCandidateType(value: string): CsvImportCandidate['type'] | null {
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ')

  switch (normalized) {
    case 'anime':
      return 'anime'
    case 'manga':
      return 'manga'
    case 'manhwa':
      return 'manhwa'
    case 'manhua':
      return 'manhua'
    case 'film':
    case 'movie':
      return 'movie'
    case 'series':
    case 'show':
    case 'tv':
    case 'tv series':
    case 'tv show':
      return 'series'
    case 'book':
    case 'books':
      return 'book'
    default:
      return null
  }
}

function normalizeOptionalNumber(value: string, options: { max?: number; min: number }) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)

  if (!Number.isFinite(parsed) || parsed < options.min) {
    return null
  }

  if (typeof options.max === 'number' && parsed > options.max) {
    return null
  }

  return Math.round(parsed)
}

function getMappedValue(row: CsvRow, column: string) {
  return column ? row[column] ?? '' : ''
}

function toPreviewCandidate(
  row: CsvRow,
  rowIndex: number,
  mapping: CsvColumnMapping
): PreviewCandidate | null {
  const title = getMappedValue(row, mapping.title).trim()
  const type = normalizeCandidateType(getMappedValue(row, mapping.type))

  if (!title || !type) {
    return null
  }

  return {
    external_id: getMappedValue(row, mapping.external_id).trim() || null,
    external_source: getMappedValue(row, mapping.external_source).trim() || null,
    image_url: getMappedValue(row, mapping.image_url).trim() || null,
    notes: getMappedValue(row, mapping.notes),
    progress: normalizeOptionalNumber(getMappedValue(row, mapping.progress), { min: 0 }),
    rating: normalizeOptionalNumber(getMappedValue(row, mapping.rating), { max: 10, min: 1 }),
    rowIndex,
    status: getMappedValue(row, mapping.status).trim() || undefined,
    title,
    type,
  }
}

function formatTypeLabel(type: CsvImportCandidate['type']) {
  switch (type) {
    case 'anime':
      return 'Anime'
    case 'manga':
      return 'Manga'
    case 'manhwa':
      return 'Manhwa'
    case 'manhua':
      return 'Manhua'
    case 'movie':
      return 'Movie'
    case 'series':
      return 'TV Series'
    case 'book':
      return 'Book'
  }
}

function formatImportResult(result: CsvImportResult) {
  if (result.error) {
    return result.error
  }

  if (result.imported > 0) {
    return `Imported ${result.imported} CSV items. Skipped ${result.skipped} duplicates or invalid rows. Failed ${result.failed}.`
  }

  return `No CSV items imported. Skipped ${result.skipped} duplicates or invalid rows. Failed ${result.failed}.`
}

export default function CsvImporter({ canImport = false }: { canImport?: boolean }) {
  const router = useRouter()
  const [csvData, setCsvData] = useState<CsvParseResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [fileName, setFileName] = useState('')
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [mapping, setMapping] = useState<CsvColumnMapping>(emptyMapping)
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())

  const candidates = useMemo(() => {
    if (!csvData) {
      return [] as PreviewCandidate[]
    }

    return csvData.rows
      .map((row, index) => toPreviewCandidate(row, index, mapping))
      .filter((candidate): candidate is PreviewCandidate => candidate !== null)
  }, [csvData, mapping])
  const visibleCandidates = candidates.slice(0, PREVIEW_LIMIT)
  const typeBreakdown = useMemo(() => {
    return candidates.reduce<Record<string, number>>((accumulator, candidate) => {
      const label = formatTypeLabel(candidate.type)
      accumulator[label] = (accumulator[label] ?? 0) + 1
      return accumulator
    }, {})
  }, [candidates])
  const selectedCount = candidates.reduce(
    (count, candidate) => (selectedIndexes.has(candidate.rowIndex) ? count + 1 : count),
    0
  )
  const invalidRowsCount = csvData ? Math.max(csvData.rows.length - candidates.length, 0) : 0
  const hasCandidates = candidates.length > 0
  const isMappingReady = Boolean(mapping.title && mapping.type)
  const isImportDisabled =
    !canImport || !hasCandidates || selectedCount === 0 || isImporting || !isMappingReady

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.item(0)

    setCsvData(null)
    setErrorMessage('')
    setFileName('')
    setImportResult(null)
    setMapping(emptyMapping)
    setSelectedIndexes(new Set())

    if (!file) {
      return
    }

    setFileName(file.name)

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMessage('Please upload a .csv file.')
      return
    }

    setIsParsing(true)

    try {
      const text = await file.text()
      const parsed = parseCsv(text)
      const detectedMapping = detectMapping(parsed.headers)
      const detectedCandidates = parsed.rows
        .map((row, index) => toPreviewCandidate(row, index, detectedMapping))
        .filter((candidate): candidate is PreviewCandidate => candidate !== null)

      setCsvData(parsed)
      setMapping(detectedMapping)
      setSelectedIndexes(new Set(detectedCandidates.map((candidate) => candidate.rowIndex)))
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message
          ? `Could not parse this CSV file. ${error.message}`
          : 'Could not parse this CSV file. Please make sure it is a valid CSV export.'
      )
    } finally {
      setIsParsing(false)
    }
  }

  async function handleImportSelected() {
    const selectedCandidates = candidates
      .filter((candidate) => selectedIndexes.has(candidate.rowIndex))
      .map((candidate): CsvImportCandidate => ({
        external_id: candidate.external_id,
        external_source: candidate.external_source,
        image_url: candidate.image_url,
        notes: candidate.notes,
        progress: candidate.progress,
        rating: candidate.rating,
        status: candidate.status,
        title: candidate.title,
        type: candidate.type,
      }))

    if (selectedCandidates.length === 0 || isImporting) {
      return
    }

    setIsImporting(true)
    setErrorMessage('')
    setImportResult(null)

    try {
      const result = await importCsvItems(selectedCandidates)
      setImportResult(result)

      if (!result.error && result.imported > 0) {
        router.refresh()
      }
    } catch {
      setImportResult({
        error: 'CSV import failed. Please try again.',
        failed: selectedCandidates.length,
        imported: 0,
        invalid: 0,
        skipped: 0,
        usedExternalIdColumns: false,
      })
    } finally {
      setIsImporting(false)
    }
  }

  function updateMapping(field: CsvMappingField, value: string) {
    setMapping((current) => ({
      ...current,
      [field]: value,
    }))
    setImportResult(null)
  }

  function selectAllCandidates() {
    setSelectedIndexes(new Set(candidates.map((candidate) => candidate.rowIndex)))
  }

  function deselectAllCandidates() {
    setSelectedIndexes(new Set())
  }

  function toggleCandidate(candidate: PreviewCandidate) {
    setSelectedIndexes((current) => {
      const next = new Set(current)

      if (next.has(candidate.rowIndex)) {
        next.delete(candidate.rowIndex)
      } else {
        next.add(candidate.rowIndex)
      }

      return next
    })
  }

  return (
    <div className="space-y-5">
      {!canImport ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Sign in to import CSV rows into your vault.
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <label className="block text-sm font-semibold text-slate-100" htmlFor="csv-import-file">
          CSV file
        </label>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Upload a comma-separated file. The raw file stays in your browser until you import
          selected rows.
        </p>
        <input
          id="csv-import-file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="mt-4 block min-h-12 w-full cursor-pointer rounded-xl border border-slate-800 bg-slate-900 text-sm text-slate-300 file:mr-4 file:min-h-12 file:cursor-pointer file:rounded-xl file:border-0 file:bg-blue-500 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-white hover:border-slate-700"
        />
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      {isParsing ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
          Parsing CSV preview...
        </div>
      ) : null}

      {!fileName && !isParsing ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
          Upload a CSV file to map columns and preview rows.
        </div>
      ) : null}

      {csvData ? (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Column mapping</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Map your CSV headers to Media Vault fields. Title and Type are required.
                </p>
              </div>
              <span className="w-fit rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300">
                {csvData.rows.length} rows detected
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {mappingFields.map((fieldDefinition) => (
                <label
                  key={fieldDefinition.field}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-3"
                >
                  <span className="text-sm font-semibold text-slate-100">
                    {fieldDefinition.label}
                    {fieldDefinition.required ? (
                      <span className="ml-1 text-blue-300">*</span>
                    ) : null}
                  </span>
                  <select
                    value={mapping[fieldDefinition.field]}
                    onChange={(event) =>
                      updateMapping(fieldDefinition.field, event.target.value)
                    }
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-400"
                  >
                    <option value="">Do not import</option>
                    {csvData.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                  <span className="mt-2 block text-xs leading-5 text-slate-500">
                    {fieldDefinition.helper}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {!isMappingReady ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              Map both Title and Type before previewing importable rows.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryCard label="Valid rows" value={candidates.length.toString()} />
            <SummaryCard label="Skipped rows" value={invalidRowsCount.toString()} />
            <SummaryCard label="Selected" value={selectedCount.toString()} />
            <SummaryCard label="Headers" value={csvData.headers.length.toString()} />
          </div>

          {Object.keys(typeBreakdown).length > 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <h3 className="text-sm font-semibold text-slate-100">Type breakdown</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(typeBreakdown).map(([type, count]) => (
                  <span
                    key={type}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300"
                  >
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">CSV preview</h3>
                <p className="text-sm text-slate-400">
                  Select rows to save. Duplicate title/type pairs and matching external IDs are
                  skipped.
                </p>
                <p className="mt-2 text-sm font-medium text-slate-200">
                  Selected {selectedCount} of {candidates.length} valid rows
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
                Showing first {PREVIEW_LIMIT} of {candidates.length} valid rows. Selection still
                applies to the full valid list.
              </p>
            ) : null}

            {hasCandidates ? (
              <div className="mt-4 max-h-[38rem] space-y-3 overflow-y-auto pr-1">
                {visibleCandidates.map((candidate) => (
                  <article
                    key={`${candidate.rowIndex}-${candidate.type}-${candidate.title}`}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIndexes.has(candidate.rowIndex)}
                        onChange={() => toggleCandidate(candidate)}
                        className="mt-1 h-5 w-5 rounded-xl border-slate-700 bg-slate-950 text-blue-500"
                        aria-label={`Select ${candidate.title}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h4 className="font-semibold text-slate-100">{candidate.title}</h4>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                              CSV row {candidate.rowIndex + 2}
                              {candidate.external_source && candidate.external_id
                                ? ` | ${candidate.external_source} #${candidate.external_id}`
                                : ''}
                            </p>
                          </div>
                          <span className="w-fit rounded-xl border border-blue-400/30 bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-100">
                            {formatTypeLabel(candidate.type)}
                          </span>
                        </div>

                        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                          <PreviewField label="Status" value={candidate.status ?? 'Default'} />
                          <PreviewField
                            label="Rating"
                            value={
                              candidate.rating == null ? 'Unrated' : `${candidate.rating} / 10`
                            }
                          />
                          <PreviewField
                            label="Progress"
                            value={
                              candidate.progress == null ? 'Not started' : candidate.progress
                            }
                          />
                          <PreviewField
                            label="Notes"
                            value={candidate.notes.trim() ? 'Included' : 'None'}
                          />
                        </dl>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                No valid rows match the current mapping. Check that Title and Type point to the
                correct columns.
              </div>
            )}
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
              {isImporting ? 'Importing...' : 'Import selected CSV rows'}
            </button>
            <p className="mt-3 text-center text-sm text-slate-400">
              Selected rows are saved to your vault. The CSV file itself is not uploaded.
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

function PreviewField({ label, value }: { label: number | string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-200">{value}</dd>
    </div>
  )
}
