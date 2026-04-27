'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { addItemsToListAction, removeItemFromListAction } from '../../app/actions/lists'
import { formatProgressValue, type MediaItem } from '../../lib/media'
import { useToast } from '../ToastProvider'

type ListDetail = {
  createdAt: string | null
  description: string | null
  id: string
  itemCount: number
  items: MediaItem[]
  name: string
  updatedAt: string | null
}

export default function ListDetailManager({
  availableItems,
  list,
}: {
  availableItems: MediaItem[]
  list: ListDetail
}) {
  const router = useRouter()
  const { showToast } = useToast()
  const [liveItems, setLiveItems] = useState(list.items)
  const [liveAvailableItems, setLiveAvailableItems] = useState(availableItems)
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [isAdding, setIsAdding] = useState(false)
  const [busyRemoveIds, setBusyRemoveIds] = useState<Set<string>>(() => new Set())

  const filteredAvailableItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return liveAvailableItems
    }

    return liveAvailableItems.filter((item) => {
      const haystack = [
        item.title,
        item.type,
        item.status,
        ...item.genres,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [liveAvailableItems, query])

  const previewAvailableItems = filteredAvailableItems.slice(0, 80)
  const selectedItems = useMemo(
    () => liveAvailableItems.filter((item) => selectedIds.has(item.id)),
    [liveAvailableItems, selectedIds]
  )

  function toggleSelection(itemId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)

      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }

      return next
    })
  }

  async function handleAddSelected() {
    const ids = [...selectedIds]

    if (ids.length === 0 || isAdding) {
      return
    }

    setIsAdding(true)
    const result = await addItemsToListAction(list.id, ids)
    setIsAdding(false)

    if (!result.success) {
      showToast(result.error ?? 'Could not add selected items.', 'error')
      return
    }

    if (result.added > 0) {
      const selectedIdSet = new Set(ids)
      setLiveItems((current) => [...selectedItems, ...current])
      setLiveAvailableItems((current) => current.filter((item) => !selectedIdSet.has(item.id)))
      setSelectedIds(new Set())
      showToast(
        result.skipped > 0
          ? `Added ${result.added} items. ${result.skipped} were already in the list.`
          : `Added ${result.added} items.`
      )
      router.refresh()
      return
    }

    setSelectedIds(new Set())
    showToast('Those items were already in the list.')
    router.refresh()
  }

  async function handleRemove(item: MediaItem) {
    if (busyRemoveIds.has(item.id)) {
      return
    }

    setBusyRemoveIds((current) => new Set(current).add(item.id))
    const result = await removeItemFromListAction(list.id, item.id)
    setBusyRemoveIds((current) => {
      const next = new Set(current)
      next.delete(item.id)
      return next
    })

    if (!result.success) {
      showToast(result.error ?? 'Could not remove item from list.', 'error')
      return
    }

    setLiveItems((current) => current.filter((candidate) => candidate.id !== item.id))
    setLiveAvailableItems((current) => [item, ...current])
    showToast('Item removed from list. It is still in your vault.')
    router.refresh()
  }

  return (
    <div className="min-w-0 space-y-8">
      <header className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
        <Link
          href="/lists"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to lists
        </Link>

        <div className="mt-6 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75">
              Custom List
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-5xl">
              {list.name}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {list.description || 'No description yet.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddPanelOpen((current) => !current)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-400"
          >
            <Plus className="h-4 w-4" />
            Add items
          </button>
        </div>
      </header>

      {isAddPanelOpen ? (
        <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-slate-100">Add vault items</h2>
              <p className="mt-2 text-sm text-slate-400">
                Search your existing vault and add selected items to this list.
              </p>
            </div>
            <p className="text-sm text-slate-400">
              Selected {selectedIds.size} of {liveAvailableItems.length} available
            </p>
          </div>

          <div className="mt-5 flex min-w-0 flex-col gap-3 lg:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, type, status, genres..."
                className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  setSelectedIds((current) => {
                    const next = new Set(current)
                    for (const item of filteredAvailableItems) {
                      next.add(item.id)
                    }
                    return next
                  })
                }
                disabled={filteredAvailableItems.length === 0 || isAdding}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:opacity-60"
              >
                Select filtered
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={selectedIds.size === 0 || isAdding}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:opacity-60"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleAddSelected}
                disabled={selectedIds.size === 0 || isAdding}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:opacity-60"
              >
                {isAdding ? 'Adding...' : `Add ${selectedIds.size || ''}`.trim()}
              </button>
            </div>
          </div>

          <div className="mt-5 max-h-[520px] min-w-0 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2">
            {previewAvailableItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400">
                {liveAvailableItems.length === 0
                  ? 'All vault items are already in this list.'
                  : 'No available items match this search.'}
              </div>
            ) : (
              <div className="grid gap-2">
                {previewAvailableItems.map((item) => {
                  const selected = selectedIds.has(item.id)

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleSelection(item.id)}
                      className={`grid min-h-16 grid-cols-[auto_1fr] gap-3 rounded-xl border p-3 text-left transition ${
                        selected
                          ? 'border-blue-400/60 bg-blue-500/15'
                          : 'border-slate-800 bg-slate-900 hover:border-blue-400/30'
                      }`}
                    >
                      <span
                        className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-xl border ${
                          selected ? 'border-blue-300 bg-blue-500 text-white' : 'border-slate-600'
                        }`}
                      >
                        {selected ? <Check className="h-4 w-4" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-100">
                          {item.title}
                        </span>
                        <span className="mt-1 block truncate text-xs text-slate-400">
                          {item.type} · {item.status} · {formatProgressValue(item)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {filteredAvailableItems.length > previewAvailableItems.length ? (
            <p className="mt-3 text-xs text-slate-500">
              Showing the first {previewAvailableItems.length} matches. Use search to narrow a large
              vault.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75">
              List Items
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              {liveItems.length} item{liveItems.length === 1 ? '' : 's'}
            </h2>
          </div>
        </div>

        {liveItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900 p-8 text-center">
            <h3 className="text-lg font-semibold text-slate-100">This list is empty.</h3>
            <p className="mt-2 text-sm text-slate-400">
              Add existing vault items to turn it into a useful collection.
            </p>
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {liveItems.map((item) => (
              <ListItemCard
                key={item.id}
                isRemoving={busyRemoveIds.has(item.id)}
                item={item}
                onRemove={() => handleRemove(item)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ListItemCard({
  isRemoving,
  item,
  onRemove,
}: {
  isRemoving: boolean
  item: MediaItem
  onRemove: () => void
}) {
  return (
    <article className="group">
      <Link href={`/items/${item.id}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition group-hover:border-blue-400/30">
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              sizes="(max-width: 768px) 50vw, 188px"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center text-slate-500">
              <span>No Cover</span>
              <span className="mt-2 text-xs">Add an image URL</span>
            </div>
          )}
          <span className="absolute bottom-2 left-2 z-20 rounded-xl bg-slate-800/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            {item.status}
          </span>
        </div>
        <h3 className="mt-3 line-clamp-2 text-sm font-bold text-slate-100 group-hover:text-blue-300">
          {item.title}
        </h3>
        <p className="mt-1 text-xs text-slate-400">{item.type}</p>
      </Link>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onRemove}
          disabled={isRemoving}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 disabled:opacity-60"
        >
          <X className="h-4 w-4" />
          {isRemoving ? 'Removing...' : 'Remove'}
        </button>
      </div>
    </article>
  )
}
