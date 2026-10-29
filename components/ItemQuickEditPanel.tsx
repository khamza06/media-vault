'use client'
import { translateMessage } from '../lib/ui-i18n'
import { translateError } from '../lib/ui-i18n'

import { ui } from '../lib/ui-i18n'
import { useLocale } from './LocaleProvider'

import { Minus, Plus, Save, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { useRef, useState } from 'react'

import { quickUpdateItemAction } from '../app/actions/items'
import {
  formatProgressValue,
  formatExternalRatingValue,
  getAllowedStatuses,
  getCurrentProgressLabel,
  getTotalProgressLabel,
  usesPageProgress,
  type MediaItem,
} from '../lib/media'
import { useToast } from './ToastProvider'
import AppSelect from './ui/AppSelect'
import ActionFeedback from './ui/ActionFeedback'

type ItemQuickEditPanelProps = {
  item: MediaItem
}

type SavingField = 'notes' | 'progress' | 'rating' | 'status'

const metricCardClassName =
  'flex min-h-32 min-w-0 flex-col justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 sm:p-4'
const metricLabelClassName = 'text-sm text-slate-400'
const centeredMetricValueClassName =
  'mt-3 flex h-14 min-h-14 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white'
const progressInputClassName =
  'min-h-11 min-w-0 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-center text-sm font-semibold tabular-nums text-white outline-none transition [appearance:textfield] focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
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
  const { locale } = useLocale()

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
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [feedbackField, setFeedbackField] = useState<SavingField | null>(null)
  const savingRef = useRef(false)

  const allowedStatuses = getAllowedStatuses(item.type)
  const totalProgress = item.totalProgress
  const progressAtLimit = typeof totalProgress === 'number' && totalProgress > 0 && progress >= totalProgress
  const officialRating = formatOfficialRating(item.externalRatingLabel, item.externalRatingValue, locale)
  const officialRatingUnavailable = officialRating === 'Not available'

  async function saveQuickChange(
    field: SavingField,
    input: Parameters<typeof quickUpdateItemAction>[1],
    successMessage: string
  ) {
    if (savingRef.current) return false
    savingRef.current = true
    setSavingField(field)
    setFeedbackField(field)
    setInlineError(null)
    setSavedMessage(null)

    try {
      const result = await quickUpdateItemAction(item.id, input)
      if (!result.success) {
        setInlineError(result.error ?? 'Could not save this change.')
        return false
      }

      setSavedMessage(successMessage)
      router.refresh()
      return true
    } catch {
      setInlineError(ui(locale, "Could not save this change. Check your connection and try again. Your draft is still here."))
      return false
    } finally {
      savingRef.current = false
      setSavingField(null)
    }
  }

  async function handleStatusChange(nextStatus: string) {
    if (savingRef.current) return
    const previousStatus = status
    setStatus(nextStatus)

    const saved = await saveQuickChange('status', { status: nextStatus }, ui(locale, "Status updated."))

    if (!saved) {
      setStatus(previousStatus)
    }
  }

  async function handleRatingChange(value: string) {
    if (savingRef.current) return
    const previousRating = rating
    const nextRating = value ? Number(value) : null

    setRating(nextRating)

    const saved = await saveQuickChange(
      'rating',
      { rating: nextRating },
      nextRating ? ui(locale, "Rating updated.") : ui(locale, "Rating cleared.")
    )

    if (!saved) {
      setRating(previousRating)
    }
  }

  async function saveProgress(nextProgress: number) {
    if (savingRef.current) return
    const previousProgress = progress
    const previousDraft = progressDraft
    const clampedProgress = clampProgress(nextProgress, totalProgress)

    setProgress(clampedProgress)
    setProgressDraft(String(clampedProgress))

    const saved = await saveQuickChange('progress', { progress: clampedProgress }, ui(locale, "Progress updated."))

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
      const message = ui(locale, "Progress must be a whole number of 0 or more.")
      setFeedbackField('progress')
      setInlineError(message)
      showToast(message, 'error')
      return
    }

    await saveProgress(parsedProgress)
  }

  async function handleNotesSave() {
    const saved = await saveQuickChange('notes', { notes }, ui(locale, "Notes saved."))

    if (saved) {
      setSavedNotes(notes)
      setShowPreview(notes.trim().length > 0)
    }
  }

  const feedback = savingField ? (
    <ActionFeedback tone="pending">{ui(locale, 'Saving...')}</ActionFeedback>
  ) : inlineError ? (
    <ActionFeedback tone="error">{translateError(locale, inlineError)}</ActionFeedback>
  ) : savedMessage ? (
    <ActionFeedback tone="success">{translateMessage(locale, savedMessage)}</ActionFeedback>
  ) : null

  return (
    <section className="space-y-4">
      {feedbackField !== 'notes' ? feedback : null}
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex min-w-0 flex-col justify-between rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"> {ui(locale, "Status")} </p>
              <p className="mt-2 text-sm text-slate-400"> {ui(locale, "Quickly move this item through your vault.")} </p>
            </div>
            {savingField === 'status' ? (
              <span className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-100"> {ui(locale, "Saving...")} </span>
            ) : null}
          </div>
          <AppSelect
            ariaLabel={ui(locale, "Status")}
            value={status}
            onValueChange={(value) => void handleStatusChange(value)}
            disabled={savingField !== null}
            options={allowedStatuses.map((option) => ({ label: translateMessage(locale, option), value: option }))}
            size="compact"
            className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 text-sm font-semibold text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
          />
        </div>

        <div className="@container min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"> {ui(locale, "Ratings")} </p>
          <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 @min-[18rem]:grid-cols-2">
            <div className={metricCardClassName}>
              <p className={metricLabelClassName}> {ui(locale, "My Rating")} </p>
              <AppSelect
                ariaLabel={ui(locale, "My rating")}
                value={rating == null ? '' : String(rating)}
                onValueChange={(value) => void handleRatingChange(value)}
                disabled={savingField !== null}
                options={ratingOptions.map(option => ({ ...option, label: translateMessage(locale, option.label) }))}
                size="compact"
                className="mt-3 h-14 min-h-14 w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900 text-sm font-semibold text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
                contentClassName="min-w-[8rem]"
              />
            </div>
            <div className={metricCardClassName}>
              <p className={metricLabelClassName}> {ui(locale, "Official Rating")} </p>
              <p className={centeredMetricValueClassName}>
                <Star aria-hidden="true" className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
                {officialRatingUnavailable ? (
                  <span className="flex min-w-[4.75rem] max-w-full flex-col items-center justify-center text-center leading-tight">
                    <span className="whitespace-nowrap break-normal"> {ui(locale, "Not")} </span>
                    <span className="whitespace-nowrap break-normal"> {ui(locale, "available")} </span>
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

        <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"> {ui(locale, "Progress")} </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatProgressValue({ progress, totalProgress, type: item.type }, locale)}
              </p>
            </div>
            {savingField === 'progress' ? (
              <span className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-100"> {ui(locale, "Saving...")} </span>
            ) : null}
          </div>

          <div className="mt-4 grid min-w-0 grid-cols-[4rem_minmax(0,1fr)_4rem] items-center gap-3">
            <button
              type="button"
              onClick={() => void saveProgress(progress - 1)}
              disabled={savingField !== null || progress <= 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Minus className="h-4 w-4" />
              -1
            </button>
            <label className="block">
              <span className="sr-only">{getCurrentProgressLabel(item.type, locale)}</span>
              <input
                type="number"
                min={0}
                max={totalProgress ?? undefined}
                value={progressDraft}
                onChange={(event) => {
                  setProgressDraft(event.target.value)
                  setSavedMessage(null)
                }}
                disabled={savingField !== null}
                className={progressInputClassName}
              />
            </label>
            <button
              type="button"
              onClick={() => void saveProgress(progress + 1)}
              disabled={savingField !== null || progressAtLimit}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              +1
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              {totalProgress
                ? `${getTotalProgressLabel(item.type, locale)}: ${totalProgress}`
                : ui(locale, "{value0} is not set.", { value0: getTotalProgressLabel(item.type, locale) })}
            </p>
            <button
              type="button"
              onClick={() => void handleProgressDraftSave()}
              disabled={savingField !== null}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {savingField === 'progress' ? ui(locale, "Saving...") : ui(locale, "Save progress")}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"> {ui(locale, "Notes")} </p>
            <p className="mt-2 text-sm text-slate-400"> {ui(locale, "Supports Markdown for bold text, links, and lists.")} </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPreview((current) => !current)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
          >
            {showPreview ? ui(locale, "Edit notes") : ui(locale, "Preview")}
          </button>
        </div>

        {showPreview ? (
          <div className="prose prose-invert mt-4 min-h-40 max-w-none rounded-xl border border-slate-800 bg-slate-950 p-4 prose-headings:text-white prose-p:text-slate-200 prose-strong:text-white prose-a:text-blue-300 prose-li:text-slate-200">
            {notes.trim() ? (
              <ReactMarkdown>{notes}</ReactMarkdown>
            ) : (
              <p className="m-0 text-sm text-slate-400"> {ui(locale, "No notes yet.")} </p>
            )}
          </div>
        ) : (
          <textarea
            aria-label={ui(locale, "Notes")}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value)
              setSavedMessage(null)
            }}
            className="mt-4 min-h-40 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
            placeholder={ui(locale, "Write notes, theories, favorite arcs, or watch reminders...")}
          />
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            {notes === savedNotes ? ui(locale, "Notes are up to date.") : ui(locale, "You have unsaved notes.")}
          </p>
          <button
            type="button"
            onClick={() => void handleNotesSave()}
            disabled={savingField !== null || notes === savedNotes}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {savingField === 'notes' ? ui(locale, "Saving notes...") : ui(locale, "Save notes")}
          </button>
        </div>

        {feedbackField === 'notes' ? <div className="mt-4">{feedback}</div> : null}
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

function formatOfficialRating(label?: string | null, value?: number | null, locale: import('../lib/i18n').Locale = 'en') {
  if (!label || typeof value !== 'number') {
    return ui(locale, "Not available")
  }

  return formatExternalRatingValue(label, value)
}
