'use client'
import { translateError } from '../lib/ui-i18n'

import { ui } from '../lib/ui-i18n'
import { useLocale } from './LocaleProvider'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { bulkUpdateItemsAction } from '../app/actions/bulk-items'
import { addItemsToListAction } from '../app/actions/lists'
import { needsBulkItemChange, type BulkItemChange } from '../lib/bulk-item-changes'
import { mediaStatuses, type MediaItem } from '../lib/media'
import type { AddToListOption } from './lists/AddToListButton'
import { useToast } from './ToastProvider'
import AppSelect from './ui/AppSelect'

type ActionKind = 'status' | 'favorite' | 'list'
type Props = {
  items: MediaItem[]
  lists: AddToListOption[]
  onUpdated: (change: BulkItemChange, ids: string[]) => void
  onDone: () => void
}
const buttonClass = 'min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-400/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:opacity-50'

export default function BulkItemActions(props: Props) {
  const { locale } = useLocale()

  const [review, setReview] = useState<{ action: ActionKind; items: MediaItem[] } | null>(null)
  if (props.items.length === 0 && !review) return null
  const currentItems = new Map(props.items.map((item) => [item.id, item]))
  const reviewedItems = review?.items.map((item) => currentItems.get(item.id) ?? item) ?? []
  const startReview = (action: ActionKind) => setReview({ action, items: [...props.items] })
  return (
    <div className="flex min-w-0 flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3" role="group" aria-label={ui(locale, "Selected item actions")}>
      <button type="button" className={buttonClass} disabled={props.items.length === 0} onClick={() => startReview('status')}> {ui(locale, "Change status")} </button>
      <button type="button" className={buttonClass} disabled={props.items.length === 0} onClick={() => startReview('favorite')}> {ui(locale, "Favorite settings")} </button>
      <button type="button" className={buttonClass} disabled={props.items.length === 0} onClick={() => startReview('list')}> {ui(locale, "Add to list")} </button>
      {review ? <BulkActionDialog {...props} items={reviewedItems} action={review.action} onClose={() => setReview(null)} /> : null}
    </div>
  )
}

function BulkActionDialog({ items, lists, action, onClose, onUpdated, onDone }: Props & { action: ActionKind; onClose: () => void }) {
  const { locale } = useLocale()

  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null)
  const [status, setStatus] = useState('Completed')
  const [favorite, setFavorite] = useState(true)
  const [listId, setListId] = useState(lists[0]?.id ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const pendingRef = useRef(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const { showToast } = useToast()
  const change: BulkItemChange = action === 'favorite' ? { kind: 'favorite', favorite } : { kind: 'status', status }
  const eligibleCount = items.filter((item) => needsBulkItemChange(item, change)).length
  const title = action === 'list' ? ui(locale, "Add selected items to a list") : action === 'status' ? ui(locale, "Change selected statuses") : ui(locale, "Update selected favorites")

  useEffect(() => {
    if (!dialog) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!dialog.open) dialog.showModal()
    cancelRef.current?.focus()
    return () => {
      dialog.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [dialog])

  async function apply() {
    if (pendingRef.current) return
    if (items.length === 0 || items.length > 500) { setError(ui(locale, "Select between 1 and 500 items for one action.")); return }
    if (action === 'list' && !lists.some((list) => list.id === listId)) { setError(ui(locale, "Choose an available list before applying.")); return }
    pendingRef.current = true; setPending(true); setError('')
    try {
      const ids = items.map((item) => item.id)
      if (action === 'list') {
        const result = await addItemsToListAction(listId, ids)
        if (!result.success) { setError(result.error ?? 'Could not add selected items.'); return }
        showToast(ui(locale, "Added {value0} items. Skipped {value1} existing or unavailable items.", { value0: result.added, value1: result.skipped }))
      } else {
        const result = await bulkUpdateItemsAction(ids, change)
        if (result.updatedIds.length > 0) {
          onUpdated(change, result.updatedIds.filter((id) => ids.includes(id)))
          if (!result.success) router.refresh()
        }
        if (!result.success) { setError(ui(locale, "{value0} Updated {value1}. Skipped {value2}. Failed {value3}.", { value0: result.error ?? 'Could not save changes.', value1: result.updated, value2: result.skipped, value3: result.failed })); return }
        showToast(ui(locale, "Updated {value0} items. Skipped {value1} unchanged, incompatible or unavailable items.", { value0: result.updated, value1: result.skipped }))
      }
      router.refresh()
      onClose()
      onDone()
    } catch {
      setError(ui(locale, "Connection interrupted. Refresh to check the saved state before retrying. Your selection is still here."))
    } finally {
      pendingRef.current = false; setPending(false)
    }
  }

  return (
    <dialog ref={setDialog} onCancel={(event) => { if (pendingRef.current) event.preventDefault() }}
      onClose={() => { if (!dialog?.open) onClose() }} aria-labelledby="bulk-action-title"
      className="fixed inset-0 m-auto max-h-[calc(100dvh_-_3rem_-_env(safe-area-inset-bottom))] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-5 text-slate-100 shadow-2xl backdrop:bg-slate-950/80 sm:p-6">
      <h2 id="bulk-action-title" className="text-xl font-bold">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400"> {ui(locale, "Review this change for")} {items.length} {ui(locale, "selected items. Notes, progress and ratings will not be changed.")} </p>
      {items.length > 500 ? <p role="alert" className="mt-3 text-sm text-amber-200"> {ui(locale, "Select no more than 500 items for one action.")} </p> : null}
      <div className="mt-5 space-y-3">
        {action === 'status' ? <AppSelect ariaLabel={ui(locale, "New status")} value={status} onValueChange={setStatus} disabled={pending} portalContainer={dialog} options={mediaStatuses.map((value) => ({ value, label: value }))} /> : null}
        {action === 'favorite' ? <AppSelect ariaLabel={ui(locale, "Favorite change")} value={String(favorite)} onValueChange={(value) => setFavorite(value === 'true')} disabled={pending} portalContainer={dialog} options={[{ value: 'true', label: ui(locale, "Add to favorites") }, { value: 'false', label: ui(locale, "Remove from favorites") }]} /> : null}
        {action === 'list' ? lists.length > 0 ? <AppSelect ariaLabel={ui(locale, "Target list")} value={listId} onValueChange={setListId} disabled={pending} portalContainer={dialog} options={lists.map((list) => ({ value: list.id, label: `${list.name} (${list.itemCount})` }))} />
          : <p className="text-sm text-slate-400"> {ui(locale, "No custom lists yet.")} <Link href="/lists" className="text-blue-200 underline"> {ui(locale, "Create a list")} </Link> {ui(locale, "first.")} </p> : null}
        {action !== 'list' ? <p className="text-xs leading-5 text-slate-400">{eligibleCount} {ui(locale, "can be updated.")} {action === 'status' ? ui(locale, "Unchanged or incompatible statuses are skipped.") : ui(locale, "Already matching favorites are skipped.")}</p> : null}
        {error ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{translateError(locale, error)}</p> : null}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button ref={cancelRef} type="button" disabled={pending} onClick={onClose} className={buttonClass}> {ui(locale, "Cancel")} </button>
        <button type="button" disabled={pending || items.length > 500 || (action === 'list' && !lists.some((list) => list.id === listId))} onClick={() => void apply()} className="min-h-11 rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:opacity-50">{pending ? ui(locale, "Applying...") : ui(locale, "Apply changes")}</button>
      </div>
    </dialog>
  )
}
