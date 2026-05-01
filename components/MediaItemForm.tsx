'use client'

import Image from 'next/image'
import { Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { CatalogSearchCandidate } from '../lib/catalog-types'
import {
  getAllowedStatuses,
  getCurrentProgressLabel,
  getDefaultStatus,
  formatExternalRatingValue,
  getTotalProgressLabel,
  mediaTypes,
  type MediaItemInput,
} from '../lib/media'
import { useLocale } from './LocaleProvider'
import AppSelect from './ui/AppSelect'

type MediaItemFormProps = {
  coverFileName?: string
  errorMessage: string
  form: MediaItemInput
  isSubmitting: boolean
  onClearCoverFile?: () => void
  onChange: <K extends keyof MediaItemInput>(field: K, value: MediaItemInput[K]) => void
  onCoverFileChange?: (file: File | null) => void
  onSelectTitleSuggestion?: (candidate: CatalogSearchCandidate) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onTitleInputChange?: (value: string) => void
  submitLabel: string
  titleSuggestions?: CatalogSearchCandidate[]
  titleSuggestionsError?: string
  titleSuggestionsLoading?: boolean
}

export default function MediaItemForm({
  coverFileName,
  errorMessage,
  form,
  isSubmitting,
  onClearCoverFile,
  onChange,
  onCoverFileChange,
  onSelectTitleSuggestion,
  onSubmit,
  onTitleInputChange,
  submitLabel,
  titleSuggestions = [],
  titleSuggestionsError = '',
  titleSuggestionsLoading = false,
}: MediaItemFormProps) {
  const { t } = useLocale()
  const hasSelectedType = mediaTypes.includes(form.type as (typeof mediaTypes)[number])
  const showSuggestions =
    hasSelectedType && (titleSuggestionsLoading || titleSuggestions.length > 0 || Boolean(titleSuggestionsError))
  const statusOptions = hasSelectedType ? getAllowedStatuses(form.type) : []
  const typeSelectOptions = [
    { label: 'Select a type first', value: '' },
    ...mediaTypes.map((type) => ({ label: type, value: type })),
  ]
  const statusSelectOptions = hasSelectedType
    ? statusOptions.map((status) => ({ label: status, value: status }))
    : [{ label: 'Select a type first', value: '' }]
  const currentProgressLabel = hasSelectedType ? getCurrentProgressLabel(form.type) : 'Current Progress'
  const totalProgressLabel = hasSelectedType ? getTotalProgressLabel(form.type) : 'Total Count'

  function getCandidateRatingCopy(candidate: CatalogSearchCandidate) {
    if (!candidate.externalRatingLabel || typeof candidate.externalRatingValue !== 'number') {
      return null
    }

    return formatExternalRatingValue(candidate.externalRatingLabel, candidate.externalRatingValue)
  }

  function getOfficialScoreCopy() {
    if (!form.externalRatingLabel || !form.externalRatingValue) {
      return null
    }

    const parsed = Number(form.externalRatingValue)
    if (!Number.isFinite(parsed)) {
      return `${form.externalRatingLabel}: ${form.externalRatingValue}`
    }

    return formatExternalRatingValue(form.externalRatingLabel, parsed)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 px-5 py-5 sm:px-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">Type</span>
          <AppSelect
            ariaLabel="Media type"
            value={form.type}
            onValueChange={(value) => {
              const nextType = value
              onChange('type', nextType)

              if (!nextType) {
                onChange('status', '')
                return
              }

              if (!getAllowedStatuses(nextType).some((status) => status === form.status)) {
                onChange('status', getDefaultStatus(nextType))
              }
            }}
            options={typeSelectOptions}
            className="glass-panel-soft min-h-12 w-full rounded-2xl px-4 py-3 text-base text-white outline-none transition focus:border-blue-400/40"
            disabled={isSubmitting}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">Status</span>
          <AppSelect
            ariaLabel="Status"
            value={form.status}
            onValueChange={(value) => onChange('status', value)}
            options={statusSelectOptions}
            className="glass-panel-soft min-h-12 w-full rounded-2xl px-4 py-3 text-base text-white outline-none transition focus:border-blue-400/40"
            disabled={isSubmitting || !hasSelectedType}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-200">Title</span>
        <input
          type="search"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={form.title}
          onChange={(event) => {
            onChange('title', event.target.value)
            onTitleInputChange?.(event.target.value)
          }}
          onInput={(event) => {
            onChange('title', event.currentTarget.value)
            onTitleInputChange?.(event.currentTarget.value)
          }}
          className="glass-panel-soft min-h-12 w-full rounded-2xl px-4 py-3 text-base text-white outline-none transition focus:border-blue-400/40"
          placeholder={hasSelectedType ? 'Frieren, Dune, Interstellar...' : 'Select type first...'}
          disabled={isSubmitting || !hasSelectedType}
        />
      </label>

      {showSuggestions ? (
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Database Matches
          </p>
          {titleSuggestionsLoading ? (
            <p className="text-sm text-slate-400">Searching for matches...</p>
          ) : titleSuggestionsError ? (
            <p className="text-sm text-amber-200">{titleSuggestionsError}</p>
          ) : (
            <div className="grid gap-2">
              {titleSuggestions.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => onSelectTitleSuggestion?.(candidate)}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:border-blue-400/30 hover:bg-white/10"
                >
                  <div className="relative h-14 w-10 overflow-hidden rounded-xl border border-white/10 bg-slate-900">
                    {candidate.imageUrl ? (
                      <Image
                        src={candidate.imageUrl}
                        alt={candidate.title}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-slate-500">
                        N/A
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white">{candidate.title}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {candidate.year || 'Unknown year'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {getCandidateRatingCopy(candidate) ? (
                        <p className="inline-flex items-center gap-1 text-sm text-slate-300">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          {getCandidateRatingCopy(candidate)}
                        </p>
                      ) : null}
                      <p className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-100">
                        {candidate.type}
                      </p>
                      <p className="text-[11px] text-slate-500">{candidate.provider}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-200">Genres</span>
        <input
          type="text"
          value={form.genres}
          onChange={(event) => onChange('genres', event.target.value)}
          className="glass-panel-soft min-h-12 w-full rounded-2xl px-4 py-3 text-base text-white outline-none transition focus:border-blue-400/40"
          placeholder="Action, Drama, Sci-Fi"
          disabled={isSubmitting}
        />
        <span className="mt-2 block text-xs text-slate-500">Separate genres with commas.</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">{currentProgressLabel}</span>
          <input
            type="number"
            min="0"
            step="1"
            value={form.progress}
            onChange={(event) => onChange('progress', event.target.value)}
            className="glass-panel-soft min-h-12 w-full rounded-2xl px-4 py-3 text-base text-white outline-none transition focus:border-blue-400/40"
            placeholder="12"
            disabled={isSubmitting}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">{totalProgressLabel}</span>
          <input
            type="number"
            min="1"
            step="1"
            value={form.totalProgress}
            onChange={(event) => onChange('totalProgress', event.target.value)}
            className="glass-panel-soft min-h-12 w-full rounded-2xl px-4 py-3 text-base text-white outline-none transition focus:border-blue-400/40"
            placeholder={form.type === 'Movie' ? '1' : '24'}
            disabled={isSubmitting || form.type === 'Movie'}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-200">My Rating</span>
          <input
            type="number"
            min="1"
            max="10"
            step="1"
            value={form.rating}
            onChange={(event) => onChange('rating', event.target.value)}
            className="glass-panel-soft min-h-12 w-full rounded-2xl px-4 py-3 text-base text-white outline-none transition focus:border-blue-400/40"
            placeholder="8"
            disabled={isSubmitting}
          />
        </label>
      </div>

      {getOfficialScoreCopy() ? (
        <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          <span className="font-medium">Official Score:</span> {getOfficialScoreCopy()}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <DateField
          disabled={isSubmitting}
          label="Started"
          onChange={(value) => onChange('startedAt', value)}
          value={form.startedAt}
        />

        <DateField
          disabled={isSubmitting}
          label="Completed"
          onChange={(value) => onChange('completedAt', value)}
          value={form.completedAt}
        />
      </div>

      <label className="glass-panel-soft flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3">
        <input
          type="checkbox"
          checked={form.favorite}
          onChange={(event) => onChange('favorite', event.target.checked)}
          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
          disabled={isSubmitting}
        />
        <span className="text-sm font-medium text-slate-200">Mark as favorite</span>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-200">Cover Image URL</span>
        <input
          type="url"
          value={form.imageUrl}
          onChange={(event) => onChange('imageUrl', event.target.value)}
          className="glass-panel-soft min-h-12 w-full rounded-2xl px-4 py-3 text-base text-white outline-none transition focus:border-blue-400/40"
          placeholder="https://..."
          disabled={isSubmitting}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-200">Notes</span>
        <textarea
          value={form.notes}
          onChange={(event) => onChange('notes', event.target.value)}
          className="glass-panel-soft min-h-32 w-full rounded-2xl px-4 py-3 text-base text-white outline-none transition focus:border-blue-400/40"
          placeholder="Quick thoughts, arc notes, favorite moments..."
          disabled={isSubmitting}
        />
        <span className="mt-2 block text-xs text-slate-500">
          Supports Markdown (e.g., **bold**, *italic*, - lists)
        </span>
      </label>

      <CustomFileField coverFileName={coverFileName} disabled={isSubmitting} onChange={onCoverFileChange} />

      {coverFileName ? (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate">Selected file: {coverFileName}</p>
            {onClearCoverFile ? (
              <button
                type="button"
                onClick={onClearCoverFile}
                className="shrink-0 rounded-full border border-blue-400/30 px-3 py-1 text-xs transition hover:bg-blue-500/10"
              >
                {t('common.clear')}
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-blue-100/75">
            Uploaded file will override the URL field when you save.
          </p>
        </div>
      ) : null}

      {errorMessage ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}

      <div className="safe-bottom sticky bottom-0 -mx-5 flex justify-end gap-3 border-t border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0),rgba(15,23,42,0.92)_28%,rgba(15,23,42,0.98)_100%)] px-5 pt-4 pb-1 backdrop-blur sm:-mx-6 sm:px-6">
        <button
          type="submit"
          className="min-h-14 w-full rounded-2xl bg-blue-500 px-5 py-3 text-base font-semibold text-white shadow-[0_18px_40px_rgba(59,130,246,0.32)] transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          disabled={isSubmitting}
        >
          {isSubmitting ? t('common.saving') : submitLabel}
        </button>
      </div>
    </form>
  )
}

function CustomFileField({
  coverFileName,
  disabled,
  onChange,
}: {
  coverFileName?: string
  disabled: boolean
  onChange?: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">Or Upload Cover</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => onChange?.(event.target.files?.[0] ?? null)}
        className="sr-only"
        disabled={disabled}
      />
      <div className="glass-panel-soft flex min-h-12 items-center gap-4 rounded-2xl px-4 py-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex min-h-12 items-center rounded-2xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Choose file
        </button>
        <span className="truncate text-sm text-slate-300">{coverFileName || 'No file selected'}</span>
      </div>
    </div>
  )
}

function DateField({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean
  label: string
  onChange: (value: string) => void
  value: string
}) {
  const hiddenInputRef = useRef<HTMLInputElement | null>(null)
  const [displayValue, setDisplayValue] = useState(formatDateDisplay(value))

  useEffect(() => {
    setDisplayValue(formatDateDisplay(value))
  }, [value])

  function commit(rawValue: string) {
    const normalized = parseDateDisplay(rawValue)

    if (!normalized) {
      setDisplayValue(formatDateDisplay(value))
      return
    }

    onChange(normalized)
    setDisplayValue(formatDateDisplay(normalized))
  }

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      <div className="glass-panel-soft flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3">
        <input
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={(event) => setDisplayValue(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          placeholder="YYYY-MM-DD"
          className="w-full bg-transparent text-base text-white outline-none placeholder:text-slate-400"
          disabled={disabled}
        />
        <input
          ref={hiddenInputRef}
          type="date"
          lang="en-CA"
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            setDisplayValue(formatDateDisplay(event.target.value))
          }}
          className="sr-only"
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => {
            const input = hiddenInputRef.current as
              | (HTMLInputElement & {
                  showPicker?: () => void
                })
              | null

            input?.showPicker?.()
          }}
          disabled={disabled}
          aria-label="Open calendar"
          className="flex min-h-12 min-w-12 shrink-0 items-center justify-center text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>
    </label>
  )
}

function formatDateDisplay(value: string) {
  if (!value) {
    return ''
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return value
  }

  const [, year, month, day] = match
  return `${year}-${month}-${day}`
}

function parseDateDisplay(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

