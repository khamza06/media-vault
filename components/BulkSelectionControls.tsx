'use client'

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
  if (!isSelectionMode) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={onStartSelection}
          disabled={visibleCount === 0}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Select
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm font-semibold text-slate-100">
          Selected {selectedCount} item{selectedCount === 1 ? '' : 's'}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSelectAllVisible}
            disabled={visibleCount === 0 || isDeleting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Select all visible
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            disabled={selectedCount === 0 || isDeleting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear selection
          </button>
          <button
            type="button"
            onClick={onCancelSelection}
            disabled={isDeleting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            disabled={selectedCount === 0 || isDeleting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete selected
          </button>
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
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-delete-title"
        className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
      >
        <h2 id="bulk-delete-title" className="text-xl font-bold text-slate-100">
          Delete selected items?
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          This will permanently remove {count} item{count === 1 ? '' : 's'} from your vault. This
          action cannot be undone.
        </p>

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting || count === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting
              ? 'Deleting...'
              : `Delete ${count} item${count === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
