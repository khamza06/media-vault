'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ListPlus, X } from 'lucide-react'
import { useState } from 'react'

import { addItemToListsAction } from '../../app/actions/lists'
import { useToast } from '../ToastProvider'

export type AddToListOption = {
  description?: string | null
  id: string
  itemCount: number
  name: string
}

type AddToListButtonProps = {
  itemId: string
  itemTitle: string
  lists: AddToListOption[]
  variant?: 'card' | 'detail'
}

export default function AddToListButton({
  itemId,
  itemTitle,
  lists,
  variant = 'card',
}: AddToListButtonProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [isAdding, setIsAdding] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function closeDialog() {
    if (isAdding) {
      return
    }

    setIsOpen(false)
    setSelectedIds(new Set())
    setMessage(null)
    setError(null)
  }

  function toggleList(listId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)

      if (next.has(listId)) {
        next.delete(listId)
      } else {
        next.add(listId)
      }

      return next
    })
  }

  async function handleAdd() {
    if (selectedIds.size === 0 || isAdding) {
      return
    }

    setIsAdding(true)
    setMessage(null)
    setError(null)

    const result = await addItemToListsAction(itemId, [...selectedIds])

    setIsAdding(false)

    if (!result.success) {
      const nextError = result.error ?? 'Could not add this item to your lists.'
      setError(nextError)
      showToast(nextError, 'error')
      return
    }

    const nextMessage =
      result.added > 0
        ? result.skipped > 0
          ? `Added to ${result.added} list${result.added === 1 ? '' : 's'}. ${result.skipped} skipped.`
          : `Added to ${result.added} list${result.added === 1 ? '' : 's'}.`
        : 'This item was already in the selected lists.'

    setMessage(nextMessage)
    setSelectedIds(new Set())
    showToast(nextMessage)
    router.refresh()
  }

  const buttonClassName =
    variant === 'detail'
      ? 'glass-panel-soft inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400/40 hover:text-white'
      : 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-blue-500 hover:text-white'

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
          setMessage(null)
          setError(null)
        }}
        className={buttonClassName}
        aria-label={`Add ${itemTitle} to a custom list`}
      >
        <ListPlus className="h-4 w-4" />
        <span>{variant === 'detail' ? 'Add to list' : 'List'}</span>
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/85 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-list-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/75">
                  Custom lists
                </p>
                <h2 id="add-to-list-title" className="mt-2 text-xl font-bold text-slate-100">
                  Add to list
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Choose one or more custom lists for {itemTitle}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                disabled={isAdding}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-200 transition hover:border-blue-400/40 disabled:opacity-60"
                aria-label="Close add to list dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 max-h-[360px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2">
              {lists.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900 p-5 text-center">
                  <h3 className="text-base font-semibold text-slate-100">
                    You do not have any custom lists yet.
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Create a list first, then come back and add this item.
                  </p>
                  <Link
                    href="/lists"
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400"
                    onClick={closeDialog}
                  >
                    Create a list
                  </Link>
                </div>
              ) : (
                <div className="grid gap-2">
                  {lists.map((list) => {
                    const selected = selectedIds.has(list.id)

                    return (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => toggleList(list.id)}
                        disabled={isAdding}
                        className={`grid min-h-16 grid-cols-[auto_1fr] gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60 ${
                          selected
                            ? 'border-blue-400/60 bg-blue-500/15'
                            : 'border-slate-800 bg-slate-900 hover:border-blue-400/30'
                        }`}
                      >
                        <span
                          className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-xl border ${
                            selected
                              ? 'border-blue-300 bg-blue-500 text-white'
                              : 'border-slate-600 text-transparent'
                          }`}
                          aria-hidden="true"
                        >
                          <Check className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-100">
                            {list.name}
                          </span>
                          <span className="mt-1 block text-xs text-slate-400">
                            {list.itemCount} item{list.itemCount === 1 ? '' : 's'}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {message ? (
              <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDialog}
                disabled={isAdding}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={lists.length === 0 || selectedIds.size === 0 || isAdding}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAdding
                  ? 'Adding...'
                  : selectedIds.size > 0
                    ? `Add to ${selectedIds.size} list${selectedIds.size === 1 ? '' : 's'}`
                    : 'Add to selected lists'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
