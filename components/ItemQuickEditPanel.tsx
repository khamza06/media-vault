'use client'

import { Minus, Plus, Save, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { useState } from 'react'

import { quickUpdateItemAction } from '../app/actions/items'
import {
  formatProgressValue,
  getAllowedStatuses,
  getCurrentProgressLabel,
  getTotalProgressLabel,
  usesPageProgress,
  type MediaItem,
} from '../lib/media'
import { useToast } from './ToastProvider'
import AppSelect from './ui/AppSelect'

type ItemQuickEditPanelProps = {
  item: MediaItem
}

type SavingField = 'notes' | 'progress' | 'rating' | 'status'

const metricCardClassName =
  'flex min-h-[7rem] min-w-0 flex-col justify-between rounded-xl border border-slate-800 bg-slate-950 p-4'
const metricLabelClassName = 'text-sm text-slate-400'
const centeredMetricValueClassName =
  'mt-3 flex min-h-11 w-full min-w-0 items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white'
const progressInputClassName =
  'min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-center text-sm font-semibold tabular-nums text-white outline-none transition [appearance:textfield] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
const ratingOptions = [
  { label: 'Not rated', value: '' },
  ...Array.from({ length: 10 }, (_, index) => {
    const value = String(index + 1)

    return {
      label: `${value} / 10`,
      value,
    }
  }),
]

export default function ItemQuickEditPanel({ item }: ItemQuickEditPanelProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [status, setStatus] = useState(item.status)
  const [rating, setRating] = useState<number | null>(item.rating)
  const [progress, setProgress] = useState(item.progress)
  const [progressDraft, setProgressDraft] = useState(String(item.progress))
  const [notes, setNotes] = useState(item.notes ?? '')
  const [savedNotes, setSavedNotes] = useState(item.notes ?? '')
  const [showPreview, setShowPreview] = useState(Boolean(item.notes))
  const [savingField, setSavingField] = useState<SavingField | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)

  const allowedStatuses = getAllowedStatuses(item.type)
  const totalProgress = item.totalProgress
  const progressAtLimit = typeof totalProgress === 'number' && totalProgress > 0 && progress >= totalProgress
  const officialRating = formatOfficialRating(item.externalRatingLabel, item.externalRatingValue)
  const officialRatingUnavailable = officialRating === 'Not available'

  async function saveQuickChange(
    field: SavingField,
    input: Parameters<typeof quickUpdateItemAction>[1],
    successMessage: string
  ) {
    setSavingField(field)
    setInlineError(null)

    const result = await quickUpdateItemAction(item.id, input)

    setSavingField(null)

    if (!result.success) {
      const nextError = result.error ?? 'Could not save this change.'
      setInlineError(nextError)
      showToast(nextError, 'error')
      return false
    }

    showToast(successMessage)
    router.refresh()
    return true
  }

  async function handleStatusChange(nextStatus: string) {
    const previousStatus = status
    setStatus(nextStatus)

    const saved = await saveQuickChange('status', { status: nextStatus }, 'Status updated.')

    if (!saved) {
      setStatus(previousStatus)
    }
  }

  async function handleRatingChange(value: string) {
    const previousRating = rating
    const nextRating = value ? Number(value) : null

    setRating(nextRating)

    const saved = await saveQuickChange(
      'rating',
      { rating: nextRating },
      nextRating ? 'Rating updated.' : 'Rating cleared.'
    )

    if (!saved) {
      setRating(previousRating)
    }
  }

  async function saveProgress(nextProgress: number) {
    const previousProgress = progress
    const previousDraft = progressDraft
    const clampedProgress = clampProgress(nextProgress, totalProgress)

    setProgress(clampedProgress)
    setProgressDraft(String(clampedProgress))

    const saved = await saveQuickChange('progress', { progress: clampedProgress }, 'Progress updated.')

    if (!saved) {
      setProgress(previousProgress)
      setProgressDraft(previousDraft)
      return
    }

    if (item.type === 'Movie' && clampedProgress >= 1) {
      setStatus('Completed')
    } else if (clampedProgress > 0 && status === 'Planning') {
      setStatus(usesPageProgress(item.type) ? 'Reading' : 'Watching')
    }
  }

  async function handleProgressDraftSave() {
    const parsedProgress = progressDraft.trim() ? Number(progressDraft.trim()) : 0

    if (!Number.isInteger(parsedProgress) || parsedProgress < 0) {
      const message = 'Progress must be a whole number of 0 or more.'
      setInlineError(message)
      showToast(message, 'error')
      return
    }

    await saveProgress(parsedProgress)
  }

  async function handleNotesSave() {
    const saved = await saveQuickChange('notes', { notes }, 'Notes saved.')

    if (saved) {
      setSavedNotes(notes)
      setShowPreview(notes.trim().length > 0)
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-[minmax(0,0.95fr)_minmax(20rem,1.1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Status
              </p>
              <p className="mt-2 text-sm text-slate-400">Quickly move this item through your vault.</p>
            </div>
            {savingField === 'status' ? (
              <span className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-100">
                Saving...
              </span>
            ) : null}
          </div>
          <AppSelect
            ariaLabel="Status"
            value={status}
            onValueChange={(value) => void handleStatusChange(value)}
            disabled={savingField === 'status'}
            options={allowedStatuses.map((option) => ({ label: option, value: option }))}
            size="compact"
            className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 text-sm font-semibold text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
          />
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Ratings
          </p>
          <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className={metricCardClassName}>
              <p className={metricLabelClassName}>My Rating</p>
              <AppSelect
                ariaLabel="My rating"
                value={rating == null ? '' : String(rating)}
                onValueChange={(value) => void handleRatingChange(value)}
                disabled={savingField === 'rating'}
                options={ratingOptions}
                size="compact"
                className="mt-3 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900 text-sm font-semibold text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
                contentClassName="min-w-[8rem]"
              />
            </div>
            <div className={metricCardClassName}>
              <p className={metricLabelClassName}>Official Rating</p>
              <p className={centeredMetricValueClassName}>
                <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
                {officialRatingUnavailable ? (
                  <span className="flex min-w-0 max-w-full flex-col items-center justify-center text-center leading-tight">
                    <span className="whitespace-nowrap break-normal">Not</span>
                    <span className="whitespace-nowrap break-normal">available</span>
                  </span>
                ) : (
                  <span className="min-w-0 max-w-full whitespace-normal break-normal text-center leading-snug">
                    {officialRating}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 xl:col-span-2 2xl:col-span-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Progress
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatProgressValue({ progress, totalProgress, type: item.type })}
              </p>
            </div>
            {savingField === 'progress' ? (
              <span className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-100">
                Saving...
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_auto] xl:grid-cols-3">
            <button
              type="button"
              onClick={() => void saveProgress(progress - 1)}
              disabled={savingField === 'progress' || progress <= 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Minus className="h-4 w-4" />
              -1
            </button>
            <label className="block">
              <span className="sr-only">{getCurrentProgressLabel(item.type)}</span>
              <input
                type="number"
                min={0}
                max={totalProgress ?? undefined}
                value={progressDraft}
                onChange={(event) => setProgressDraft(event.target.value)}
                className={progressInputClassName}
              />
            </label>
            <button
              type="button"
              onClick={() => void saveProgress(progress + 1)}
              disabled={savingField === 'progress' || progressAtLimit}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              +1
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <p className="text-xs text-slate-400">
              {totalProgress
                ? `${getTotalProgressLabel(item.type)}: ${totalProgress}`
                : `${getTotalProgressLabel(item.type)} is not set.`}
            </p>
            <button
              type="button"
              onClick={() => void handleProgressDraftSave()}
              disabled={savingField === 'progress'}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              Save progress
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Notes
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Supports Markdown for bold text, links, and lists.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPreview((current) => !current)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
          >
            {showPreview ? 'Edit notes' : 'Preview'}
          </button>
        </div>

        {showPreview ? (
          <div className="prose prose-invert mt-4 min-h-40 max-w-none rounded-xl border border-slate-800 bg-slate-950 p-4 prose-headings:text-white prose-p:text-slate-200 prose-strong:text-white prose-a:text-blue-300 prose-li:text-slate-200">
            {notes.trim() ? (
              <ReactMarkdown>{notes}</ReactMarkdown>
            ) : (
              <p className="m-0 text-sm text-slate-400">No notes yet.</p>
            )}
          </div>
        ) : (
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-4 min-h-40 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
            placeholder="Write notes, theories, favorite arcs, or watch reminders..."
          />
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            {notes === savedNotes ? 'Notes are up to date.' : 'You have unsaved notes.'}
          </p>
          <button
            type="button"
            onClick={() => void handleNotesSave()}
            disabled={savingField === 'notes' || notes === savedNotes}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {savingField === 'notes' ? 'Saving notes...' : 'Save notes'}
          </button>
        </div>

        {inlineError ? (
          <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {inlineError}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function clampProgress(value: number, totalProgress: number | null) {
  const normalized = Math.max(0, Math.floor(value))

  if (typeof totalProgress === 'number' && totalProgress > 0) {
    return Math.min(normalized, totalProgress)
  }

  return normalized
}

function formatOfficialRating(label?: string | null, value?: number | null) {
  if (!label || typeof value !== 'number') {
    return 'Not available'
  }

  if (label === 'AniList') {
    return value > 10 ? `${Math.round(value)}% AniList` : `${Math.round(value * 10)}% AniList`
  }

  return `${value.toFixed(1)} ${label}`
}
