'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, FileJson2, RotateCcw } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { restoreBackupItemsAction } from '../app/actions/backup'
import { restoreBackupCollectionsAction, type CollectionRestoreResult } from '../app/actions/backup-collections'
import { extractBackupItems, getBackupTrackingError, type VaultExportItem } from '../lib/backup'
import { MAX_BACKUP_RESTORE_BYTES, parseBackupCollections, type VaultExportList } from '../lib/backup-collections'
import { mediaStatuses, mediaTypes } from '../lib/media'
import { useToast } from './ToastProvider'
import ActionFeedback from './ui/ActionFeedback'

type PreviewCandidate = {
  item: VaultExportItem
  key: string
  reason: string | null
  valid: boolean
}

type RestoreResult = Awaited<ReturnType<typeof restoreBackupItemsAction>> | CollectionRestoreResult
function isCollectionResult(value: RestoreResult): value is CollectionRestoreResult {
  return 'listsRestored' in value && typeof value.listsRestored === 'number'
}

const PREVIEW_LIMIT = 250

export default function ImportBackupForm() {
  const router = useRouter()
  const { showToast } = useToast()
  const [fileName, setFileName] = useState('')
  const [previewItems, setPreviewItems] = useState<PreviewCandidate[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [isParsing, setIsParsing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'error' | 'success' | null>(null)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)
  const [previewLists, setPreviewLists] = useState<VaultExportList[]>([])
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(() => new Set())
  const [isV2, setIsV2] = useState(false)
  const restoringRef = useRef(false)

  const validItems = useMemo(() => previewItems.filter((candidate) => candidate.valid), [previewItems])
  const selectedItems = useMemo(
    () =>
      validItems
        .filter((candidate) => selectedKeys.has(candidate.key))
        .map((candidate) => candidate.item),
    [selectedKeys, validItems]
  )
  const typeBreakdown = useMemo(() => buildBreakdown(validItems, 'type'), [validItems])
  const statusBreakdown = useMemo(() => buildBreakdown(validItems, 'status'), [validItems])
  const selectedLists = previewLists.filter((list) => selectedListIds.has(list.id))
  const selectedItemIds = new Set(selectedItems.map((item) => item.id))

  async function handleFileChange(file: File | null) {
    setFileName(file?.name ?? '')
    setPreviewItems([])
    setSelectedKeys(new Set())
    setMessage('')
    setMessageTone(null)
    setRestoreResult(null)
    setPreviewLists([])
    setSelectedListIds(new Set())
    setIsV2(false)

    if (!file) {
      return
    }

    setIsParsing(true)

    try {
      if (file.size > 20 * 1024 * 1024) {
        setMessage('Backup is too large to preview. Choose a JSON file smaller than 20 MB.')
        setMessageTone('error')
        return
      }
      const parsed = JSON.parse(await file.text()) as unknown
      const items = extractBackupItems(parsed)

      if (!items) {
        setMessage('Backup file format is not recognized.')
        setMessageTone('error')
        setIsParsing(false)
        return
      }
      const collections = parseBackupCollections(parsed)
      if (collections.error) {
        setMessage(collections.error)
        setMessageTone('error')
        return
      }
      const version2 = isRecord(parsed) && parsed.version === 2
      setIsV2(version2)
      setPreviewLists(collections.lists)

      const candidates = items.map((item, index) => normalizePreviewCandidate(item, index))
      const validKeys = candidates
        .filter((candidate) => candidate.valid)
        .map((candidate) => candidate.key)

      setPreviewItems(candidates)
      setSelectedKeys(new Set(validKeys))
      setMessage(
        validKeys.length > 0 || collections.lists.length > 0
          ? 'Backup parsed. Review the preview, choose items and optional lists, then restore your selection.'
          : 'No valid Media Vault items were found in this backup.'
      )
      setMessageTone(validKeys.length > 0 || collections.lists.length > 0 ? 'success' : 'error')
    } catch {
      setMessage('Backup file is not valid JSON.')
      setMessageTone('error')
    } finally {
      setIsParsing(false)
    }
  }

  function selectAll() {
    setSelectedKeys(new Set(validItems.map((candidate) => candidate.key)))
  }

  function deselectAll() {
    setSelectedKeys(new Set())
  }

  function toggleSelection(key: string) {
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

  async function handleRestore() {
    if (restoringRef.current) return
    if (selectedItems.length === 0 && selectedLists.length === 0) {
      setMessage('Select at least one valid backup item or list to restore.')
      setMessageTone('error')
      return
    }
    if (isV2 && new TextEncoder().encode(JSON.stringify({ items: selectedItems, lists: selectedLists })).byteLength > MAX_BACKUP_RESTORE_BYTES) {
      setMessage('Selection is too large. Choose fewer items/lists and restore in smaller groups.')
      setMessageTone('error')
      return
    }

    restoringRef.current = true
    setIsRestoring(true)
    setMessage('')
    setMessageTone(null)
    setRestoreResult(null)

    try {
      const result: RestoreResult = isV2
        ? await restoreBackupCollectionsAction({ items: selectedItems, lists: selectedLists })
        : await restoreBackupItemsAction(selectedItems)
      setRestoreResult(result)
      if (result.restored > 0 || (isCollectionResult(result) && result.listsRestored > 0)) router.refresh()

      if (!result.success) {
        const error = result.error ?? 'Restore failed. Please try again.'
        setMessage(error)
        setMessageTone('error')
        showToast(error, 'error')
        return
      }

      const summary = `Restored ${result.restored} items. Skipped ${result.skipped} duplicates. Failed ${result.failed}.`
      setMessage(summary)
      setMessageTone('success')
      showToast(summary)
      router.refresh()
    } catch {
      setMessage('Could not finish restoring. Some changes may have saved. Refresh and review your vault and lists before retrying; matching items and list names are skipped, not overwritten.')
      setMessageTone('error')
    } finally {
      restoringRef.current = false
      setIsRestoring(false)
    }
  }

  return (
    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-slate-950/30 sm:p-7">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-100">
          <RotateCcw className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-white">Restore Preview</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Upload a Media Vault JSON backup, preview the contents, then restore selected
            items and optional lists. Existing matching items and list names are skipped, not overwritten.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            JSON is recommended for restoring your vault. CSV is best for spreadsheets and
            may not preserve every field.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <input
          aria-label="Media Vault backup file"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm text-slate-200 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-500 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-400"
          disabled={isParsing || isRestoring}
        />

        {fileName ? (
          <p className="text-sm text-slate-300">Selected: {fileName}</p>
        ) : (
          <p className="text-sm text-slate-400">
            Choose a Media Vault JSON export to preview before restoring.
          </p>
        )}

        {isRestoring || isParsing ? (
          <ActionFeedback tone="pending">{isRestoring ? 'Restoring selected items...' : 'Reading backup...'}</ActionFeedback>
        ) : message ? <ActionFeedback tone={messageTone ?? 'success'}>{message}</ActionFeedback> : null}

        {previewItems.length > 0 || previewLists.length > 0 ? (
          <div className="min-w-0 space-y-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PreviewStat label="Total in backup" value={String(previewItems.length)} />
              <PreviewStat label="Valid items" value={String(validItems.length)} />
              <PreviewStat
                label="Invalid/skipped"
                value={String(previewItems.length - validItems.length)}
              />
              <PreviewStat label="Selected" value={String(selectedItems.length)} />
            </div>

            <Breakdown title="Type breakdown" items={typeBreakdown} />
            <Breakdown title="Status breakdown" items={statusBreakdown} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">
                Showing first {Math.min(PREVIEW_LIMIT, previewItems.length)} of{' '}
                {previewItems.length} rows. Selection applies to all valid parsed items.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={isRestoring || validItems.length === 0}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:opacity-60"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  disabled={isRestoring || selectedKeys.size === 0}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:opacity-60"
                >
                  Deselect all
                </button>
              </div>
            </div>

            <div className="max-h-[520px] min-w-0 space-y-3 overflow-y-auto pr-1">
              {previewItems.slice(0, PREVIEW_LIMIT).map((candidate) => (
                <PreviewRow
                  key={candidate.key}
                  candidate={candidate}
                  checked={selectedKeys.has(candidate.key)}
                  disabled={isRestoring || !candidate.valid}
                  onToggle={() => toggleSelection(candidate.key)}
                />
              ))}
            </div>

            {isV2 ? (
              <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="font-semibold text-slate-100">Lists in backup: {previewLists.length}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">List restore is optional. New lists are private. Existing list names are skipped, not merged. Only selected items with an unambiguous vault match can be linked; omitted items will not be restored automatically.</p>
                <p className="mt-2 text-xs text-slate-400">Selected lists: {selectedLists.length}. Restore up to 100 lists and 2,000 items in one group.</p>
                <div className="my-3 flex flex-wrap gap-2">
                  <button type="button" disabled={isRestoring || !previewLists.length} onClick={() => setSelectedListIds(new Set(previewLists.map((list) => list.id)))} className="min-h-11 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-100 disabled:opacity-50">Select all lists</button>
                  <button type="button" disabled={isRestoring || !selectedListIds.size} onClick={() => setSelectedListIds(new Set())} className="min-h-11 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-100 disabled:opacity-50">Deselect lists</button>
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {previewLists.slice(0, PREVIEW_LIMIT).map((list) => (
                    <label key={list.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 focus-within:ring-2 focus-within:ring-blue-400">
                      <input aria-label={`Restore list ${list.name}`} type="checkbox" checked={selectedListIds.has(list.id)} disabled={isRestoring} className="mt-1 h-5 w-5 shrink-0 accent-blue-500" onChange={() => setSelectedListIds((current) => {
                        const next = new Set(current)
                        if (next.has(list.id)) next.delete(list.id)
                        else next.add(list.id)
                        return next
                      })} />
                      <span className="min-w-0 text-sm"><span className="block break-words font-semibold text-slate-100">{list.name}</span>
                        {list.description ? <span className="mt-1 block whitespace-pre-wrap break-words text-slate-400">{list.description}</span> : null}
                        <span className="mt-1 block text-xs text-slate-400">{list.item_ids.length} links; {list.item_ids.filter((id) => selectedItemIds.has(id)).length} reference selected items</span>
                      </span>
                    </label>
                  ))}
                </div>
                {previewLists.length > PREVIEW_LIMIT ? <p className="mt-2 text-xs text-slate-400">Showing first {PREVIEW_LIMIT} lists. Select all applies to every parsed list; restore in smaller groups if needed.</p> : null}
              </section>
            ) : <p className="text-xs text-slate-400">This legacy backup contains items only. Export JSON v2 to include lists.</p>}
          </div>
        ) : null}

        {restoreResult ? (
          <div className={`rounded-xl border px-4 py-3 text-sm ${restoreResult.success ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
            <p className="font-semibold">
              Restored {restoreResult.restored} items. Skipped {restoreResult.skipped}{' '}
              duplicates. Invalid {restoreResult.invalid}. Failed {restoreResult.failed}.
            </p>
            {isCollectionResult(restoreResult) ? <div className="mt-2 space-y-2">
              <p>Lists: restored {restoreResult.listsRestored}, skipped {restoreResult.listsSkipped}, failed {restoreResult.listsFailed}.</p>
              <p>Memberships: restored {restoreResult.membershipsRestored}, skipped {restoreResult.membershipsSkipped}, failed {restoreResult.membershipsFailed}.</p>
              {restoreResult.warnings.map((warning) => <p key={warning} className="text-xs leading-5">{warning}</p>)}
              {restoreResult.listsRestored > 0 ? <Link href="/lists" className="inline-flex min-h-11 items-center rounded-xl border border-slate-600 px-3 py-2 text-sm text-white">Review restored lists</Link> : null}
            </div> : null}
            {!restoreResult.usedExternalIdColumns ? (
              <p className="mt-2 text-emerald-100/80">
                External source/id columns were not available, so duplicates were checked by
                title and type.
              </p>
            ) : null}
            {restoreResult.restored > 0 ? (
              <Link
                href="/"
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-400/25"
              >
                Go to Library
              </Link>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleRestore()}
          disabled={isParsing || isRestoring || (selectedItems.length === 0 && selectedLists.length === 0)}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(59,130,246,0.32)] transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          <FileJson2 className="h-4 w-4" />
          {isRestoring ? 'Restoring...' : selectedLists.length ? 'Restore selected items and lists' : 'Restore selected items'}
        </button>
      </div>
    </section>
  )
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

function Breakdown({ items, title }: { items: Array<{ label: string; value: number }>; title: string }) {
  if (items.length === 0) {
    return null
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.label}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200"
          >
            {item.label}: {item.value}
          </span>
        ))}
      </div>
    </div>
  )
}

function PreviewRow({
  candidate,
  checked,
  disabled,
  onToggle,
}: {
  candidate: PreviewCandidate
  checked: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const item = candidate.item

  return (
    <label
      className={`grid min-w-0 cursor-pointer gap-3 rounded-xl border p-4 transition sm:grid-cols-[auto_1fr] ${
        checked
          ? 'border-blue-400/60 bg-blue-500/10'
          : 'border-slate-800 bg-slate-900 hover:border-blue-400/30'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span
        className={`inline-flex h-7 w-7 items-center justify-center rounded-xl border ${
          checked ? 'border-blue-300 bg-blue-500 text-white' : 'border-slate-600 text-transparent'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          className="sr-only"
        />
        <Check className="h-4 w-4" />
      </span>

      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-white">{item.title}</span>
        <span className="mt-1 block text-xs text-slate-400">
          {item.type || 'Unknown type'} · {item.status || 'Unknown status'} · Progress{' '}
          {item.progress ?? 0}
          {typeof item.rating === 'number' ? ` · Rating ${item.rating}/10` : ' · Unrated'}
        </span>
        <span className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
          <span className="rounded-xl border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300">
            {item.notes ? 'Has notes' : 'No notes'}
          </span>
          <span className="rounded-xl border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300">
            {item.image_url ? 'Has cover' : 'No cover'}
          </span>
          {item.external_source && item.external_id ? (
            <span className="rounded-xl border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300">
              {item.external_source} #{item.external_id}
            </span>
          ) : null}
        </span>
        {!candidate.valid && candidate.reason ? (
          <span className="mt-2 block text-xs text-red-200">{candidate.reason}</span>
        ) : null}
      </span>
    </label>
  )
}

function normalizePreviewCandidate(value: unknown, index: number): PreviewCandidate {
  const record = isRecord(value) ? value : {}
  const item = toPreviewItem(record, index)
  const reason = getBackupTrackingError(value) ?? validatePreviewItem(item)

  return {
    item,
    key: `${index}-${item.id || item.title || 'backup-item'}`,
    reason,
    valid: reason === null,
  }
}

function toPreviewItem(record: Record<string, unknown>, index: number): VaultExportItem {
  return {
    completed_at: getNullableString(record.completed_at),
    created_at: getNullableString(record.created_at),
    external_id: getNullableString(record.external_id),
    external_rating_label: getNullableString(record.external_rating_label),
    external_rating_value: getNullableNumber(record.external_rating_value),
    external_source: getNullableString(record.external_source),
    favorite: record.favorite === true,
    genres: Array.isArray(record.genres)
      ? record.genres.filter((genre): genre is string => typeof genre === 'string')
      : [],
    id: getString(record.id) || `backup-row-${index + 1}`,
    image_url: getNullableString(record.image_url),
    last_progress_at: getNullableString(record.last_progress_at),
    notes: getString(record.notes),
    progress: getNumberOrZero(record.progress),
    rating: getNullableNumber(record.rating),
    started_at: getNullableString(record.started_at),
    status: getString(record.status),
    title: getString(record.title),
    total_progress: getNullableNumber(record.total_progress),
    type: getString(record.type),
  }
}

function validatePreviewItem(item: VaultExportItem) {
  if (!item.title.trim()) {
    return 'Missing title.'
  }

  if (!mediaTypes.includes(item.type as (typeof mediaTypes)[number])) {
    return 'Unsupported media type.'
  }

  if (!mediaStatuses.includes(item.status as (typeof mediaStatuses)[number])) {
    return 'Unsupported status.'
  }

  if (typeof item.rating === 'number' && (!Number.isInteger(item.rating) || item.rating < 1 || item.rating > 10)) {
    return 'Rating must be 1-10.'
  }

  if (!Number.isInteger(item.progress) || item.progress < 0) {
    return 'Progress must be 0 or more.'
  }

  return null
}

function buildBreakdown(items: PreviewCandidate[], field: 'status' | 'type') {
  const counts = new Map<string, number>()

  for (const candidate of items) {
    const value = candidate.item[field] || 'Unknown'
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function getNullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function getNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getNumberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
