'use client'
import { translateError } from '../lib/ui-i18n'

import { ui, countNoun } from '../lib/ui-i18n'
import { useLocale } from './LocaleProvider'

import { useEffect, useId, useRef } from 'react'

type BulkSelectionToolbarProps = {
  isDeleting: boolean
  isSelectionMode: boolean
  onCancelSelection: () => void
  onClearSelection: () => void
  onRequestDelete: () => void
  onSelectAllVisible: () => void
  onStartSelection: () => void
  selectedCount: number
  visibleCount: number
}

type BulkDeleteConfirmDialogProps = {
  count: number
  errorMessage: string | null
  isDeleting: boolean
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function BulkSelectionToolbar({
  isDeleting,
  isSelectionMode,
  onCancelSelection,
  onClearSelection,
  onRequestDelete,
  onSelectAllVisible,
  onStartSelection,
  selectedCount,
  visibleCount,
}: BulkSelectionToolbarProps) {
  const { locale } = useLocale()

  if (!isSelectionMode) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={onStartSelection}
          disabled={visibleCount === 0 || isDeleting}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        > {ui(locale, "Select")} </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm font-semibold text-slate-100"> {ui(locale, "Selected")} {selectedCount} {countNoun(locale, selectedCount, "item")}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSelectAllVisible}
            disabled={visibleCount === 0 || isDeleting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          > {ui(locale, "Select all visible")} </button>
          <button
            type="button"
            onClick={onClearSelection}
            disabled={selectedCount === 0 || isDeleting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          > {ui(locale, "Clear selection")} </button>
          <button
            type="button"
            onClick={onCancelSelection}
            disabled={isDeleting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          > {ui(locale, "Cancel")} </button>
          <button
            type="button"
            onClick={onRequestDelete}
            disabled={selectedCount === 0 || isDeleting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          > {ui(locale, "Delete selected")} </button>
        </div>
      </div>
    </div>
  )
}

export function BulkDeleteConfirmDialog({
  count,
  errorMessage,
  isDeleting,
  isOpen,
  onCancel,
  onConfirm,
}: BulkDeleteConfirmDialogProps) {
  const { locale } = useLocale()

  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!isOpen) return
    const dialog = ref.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (dialog && !dialog.open) dialog.showModal()
    cancelRef.current?.focus()
    return () => {
      dialog?.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [isOpen])
  if (!isOpen) {
    return null
  }

  return (
      <dialog
        ref={ref}
        onCancel={(event) => { if (isDeleting) event.preventDefault() }}
        onClose={() => { if (!ref.current?.open && !isDeleting) onCancel() }}
        aria-labelledby={titleId}
        aria-busy={isDeleting}
        className="fixed inset-0 m-auto max-h-[calc(100dvh_-_3rem_-_env(safe-area-inset-bottom))] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-5 text-slate-100 shadow-2xl backdrop:bg-slate-950/80"
      >
        <h2 id={titleId} className="text-xl font-bold text-slate-100"> {ui(locale, "Delete selected items?")} </h2>
        <p className="mt-3 text-sm leading-6 text-slate-400"> {ui(locale, "This will permanently remove")} {count} {countNoun(locale, count, "item")} {ui(locale, "from your vault. This action cannot be undone.")} </p>

        {errorMessage ? (
          <div role="alert" className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
            {translateError(locale, errorMessage)}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:cursor-not-allowed disabled:opacity-50"
          > {ui(locale, "Cancel")} </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting || count === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting
              ? ui(locale, "Deleting...")
              : ui(locale, "Delete {value0} item{value1}", { value0: count, value1: count === 1 ? '' : 's' })}
          </button>
        </div>
      </dialog>
  )
}
