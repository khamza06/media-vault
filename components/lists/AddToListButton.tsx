'use client'
import { translateError } from '../../lib/ui-i18n'
import { translateMessage } from '../../lib/ui-i18n'

import { ui, countNoun } from '../../lib/ui-i18n'
import { useLocale } from '../LocaleProvider'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ListPlus, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

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
  buttonLabel?: string
  buttonAriaLabel?: string
  compact?: boolean
}

export default function AddToListButton({
  itemId,
  itemTitle,
  lists,
  variant = 'card',
  buttonLabel,
  buttonAriaLabel,
  compact = false,
}: AddToListButtonProps) {
  const { locale } = useLocale()

  const router = useRouter()
  const { showToast } = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pendingRef = useRef(false)
  const titleId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [isAdding, setIsAdding] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [isOpen])

  function closeDialog() {
    if (pendingRef.current) {
      return
    }

    dialogRef.current?.close()
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
    if (selectedIds.size === 0 || pendingRef.current) {
      return
    }

    pendingRef.current = true
    setIsAdding(true)
    setMessage(null)
    setError(null)

    try {
      const result = await addItemToListsAction(itemId, [...selectedIds])
      if (!result.success || result.failed > 0) {
        const nextError = result.error ?? 'Could not add this item to all selected lists.'
        setError(nextError)
        if (result.added > 0) {
          setMessage(ui(locale, "Added to {value0} list{value1}. Skipped {value2}. Failed {value3}. Review your lists before retrying.", { value0: result.added, value1: result.added === 1 ? '' : 's', value2: result.skipped, value3: result.failed }))
          router.refresh()
        }
        showToast(nextError, 'error')
        return
      }

      const nextMessage =
        result.added > 0
          ? result.skipped > 0
            ? ui(locale, "Added to {value0} list{value1}. {value2} skipped.", { value0: result.added, value1: result.added === 1 ? '' : 's', value2: result.skipped })
            : ui(locale, "Added to {value0} list{value1}.", { value0: result.added, value1: result.added === 1 ? '' : 's' })
          : ui(locale, "This item was already in the selected lists.")

      setMessage(nextMessage)
      setSelectedIds(new Set())
      showToast(nextMessage)
      router.refresh()
    } catch {
      const nextError = ui(locale, "Connection interrupted. Some list additions may have saved. Refresh and review your lists before retrying. Your selection is still here.")
      setError(nextError)
      showToast(nextError, 'error')
    } finally {
      pendingRef.current = false
      setIsAdding(false)
    }
  }

  const buttonClassName =
    variant === 'detail'
      ? 'glass-panel-soft inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400/40 hover:text-white'
      : `inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/90 py-2 text-xs font-medium text-slate-200 transition hover:border-blue-500 hover:text-white ${compact ? 'gap-1 px-2' : 'gap-2 px-3'}`

  return (
    <>
      <button
        type="button"
        disabled={isAdding}
        onClick={() => {
          setIsOpen(true)
          setMessage(null)
          setError(null)
        }}
        className={buttonClassName}
        aria-label={buttonAriaLabel ?? ui(locale, "Add {value0} to a custom list", { value0: itemTitle })}
      >
        {compact && variant === 'card' ? null : <ListPlus className="h-4 w-4" />}
        <span>{buttonLabel ?? (variant === 'detail' ? ui(locale, "Add to list") : 'List')}</span>
      </button>

      {isOpen ? (
        <dialog
          ref={dialogRef}
          onCancel={(event) => { if (pendingRef.current) event.preventDefault() }}
          onClose={() => { if (!dialogRef.current?.open) closeDialog() }}
          aria-labelledby={titleId}
          aria-busy={isAdding}
          className="fixed inset-0 m-auto max-h-[calc(100dvh_-_3rem_-_env(safe-area-inset-bottom))] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/85"
        >
          <div className="min-w-0 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/75"> {ui(locale, "Custom lists")} </p>
                <h2 id={titleId} className="mt-2 text-xl font-bold text-slate-100"> {ui(locale, "Add to list")} </h2>
                <p className="mt-2 break-words text-sm leading-6 text-slate-400 [overflow-wrap:anywhere]"> {ui(locale, "Choose one or more custom lists for")} {itemTitle}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                disabled={isAdding}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-200 transition hover:border-blue-400/40 disabled:opacity-60"
                aria-label={ui(locale, "Close add to list dialog")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 max-h-[min(360px,40dvh)] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2">
              {lists.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900 p-5 text-center">
                  <h3 className="text-base font-semibold text-slate-100"> {ui(locale, "You do not have any custom lists yet.")} </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400"> {ui(locale, "Create a list first, then come back and add this item.")} </p>
                  <Link
                    href="/lists"
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400"
                    onClick={closeDialog}
                  > {ui(locale, "Create a list")} </Link>
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
                        aria-label={`${list.name} ${list.itemCount} item${list.itemCount === 1 ? '' : 's'}`}
                        aria-pressed={selected}
                        disabled={isAdding}
                        className={`grid min-h-16 min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60 ${
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
                            {list.itemCount} {countNoun(locale, list.itemCount, "item")}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {message ? (
              <p role="status" className={`mt-4 rounded-xl border px-4 py-3 text-sm ${error ? 'border-amber-400/30 bg-amber-500/10 text-amber-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'}`}>
                {translateMessage(locale, message)}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {translateError(locale, error)}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDialog}
                disabled={isAdding}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:opacity-60"
              > {ui(locale, "Cancel")} </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={lists.length === 0 || selectedIds.size === 0 || isAdding}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAdding
                  ? ui(locale, "Adding...")
                  : selectedIds.size > 0
                    ? ui(locale, "Add to {value0} list{value1}", { value0: selectedIds.size, value1: selectedIds.size === 1 ? '' : 's' })
                    : ui(locale, "Add to selected lists")}
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  )
}
