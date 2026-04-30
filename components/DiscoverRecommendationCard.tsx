'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, ListPlus, Plus, X } from 'lucide-react'
import { useState } from 'react'

import { createItemAction } from '../app/actions/items'
import { addItemToListsAction } from '../app/actions/lists'
import { dispatchOpenAddModal } from '../lib/add-modal-events'
import type { CatalogSearchCandidate } from '../lib/catalog-types'
import type { DiscoverRecommendation } from '../lib/home-signals'
import type { MediaItem, MediaItemInput } from '../lib/media'
import AddToListButton, { type AddToListOption } from './lists/AddToListButton'
import { useToast } from './ToastProvider'

type DiscoverRecommendationCardProps = {
  listOptions: AddToListOption[]
  onDismiss: (recommendation: DiscoverRecommendation) => void
  ownedItem: MediaItem | null
  recommendation: DiscoverRecommendation
}

function toCatalogCandidate(recommendation: DiscoverRecommendation): CatalogSearchCandidate {
  return {
    description: recommendation.description,
    externalRatingLabel: recommendation.externalRatingLabel,
    externalRatingValue: recommendation.externalRatingValue,
    genres: recommendation.genres.join(', '),
    id: recommendation.id,
    imageUrl: recommendation.imageUrl,
    provider: recommendation.provider,
    score: 100,
    status: recommendation.status,
    subtitle: recommendation.subtitle,
    title: recommendation.title,
    totalProgress: recommendation.totalProgress,
    type: recommendation.type,
    year: recommendation.year,
  }
}

function toMediaInput(recommendation: DiscoverRecommendation): MediaItemInput {
  return {
    completedAt: '',
    externalRatingLabel: recommendation.externalRatingLabel ?? '',
    externalRatingValue:
      typeof recommendation.externalRatingValue === 'number'
        ? String(recommendation.externalRatingValue)
        : '',
    favorite: false,
    genres: recommendation.genres.join(', '),
    imageUrl: recommendation.imageUrl,
    notes: recommendation.description,
    progress: '',
    rating: '',
    startedAt: '',
    status: recommendation.status,
    title: recommendation.title,
    totalProgress: recommendation.totalProgress,
    type: recommendation.type,
  }
}

function formatRating(recommendation: DiscoverRecommendation) {
  if (!recommendation.externalRatingLabel || typeof recommendation.externalRatingValue !== 'number') {
    return null
  }

  return `${recommendation.externalRatingLabel}: ${Math.round(recommendation.externalRatingValue * 10)}%`
}

export default function DiscoverRecommendationCard({
  listOptions,
  onDismiss,
  ownedItem,
  recommendation,
}: DiscoverRecommendationCardProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isSavingToLists, setIsSavingToLists] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedItemId, setSavedItemId] = useState<string | null>(null)
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(() => new Set())

  const currentItemId = savedItemId ?? ownedItem?.id ?? null
  const isAlreadyInVault = Boolean(currentItemId)
  const rating = formatRating(recommendation)

  function closePreview() {
    if (isSavingToLists) {
      return
    }

    setIsOpen(false)
    setMessage(null)
    setError(null)
    setSelectedListIds(new Set())
  }

  function openAddModal() {
    closePreview()
    dispatchOpenAddModal({ candidate: toCatalogCandidate(recommendation) })
  }

  function toggleList(listId: string) {
    setSelectedListIds((current) => {
      const next = new Set(current)

      if (next.has(listId)) {
        next.delete(listId)
      } else {
        next.add(listId)
      }

      return next
    })
  }

  async function addToSelectedLists() {
    if (selectedListIds.size === 0 || isSavingToLists) {
      return
    }

    setIsSavingToLists(true)
    setMessage(null)
    setError(null)

    let targetItemId = currentItemId
    let createdItem = false

    if (!targetItemId) {
      const createResult = await createItemAction(toMediaInput(recommendation))

      if (!createResult.success || !createResult.itemId) {
        const nextError = createResult.error ?? 'Could not add this recommendation to your vault.'
        setError(nextError)
        showToast(nextError, 'error')
        setIsSavingToLists(false)
        return
      }

      targetItemId = createResult.itemId
      createdItem = true
      setSavedItemId(createResult.itemId)
    }

    const listResult = await addItemToListsAction(targetItemId, [...selectedListIds])

    setIsSavingToLists(false)

    if (!listResult.success) {
      const nextError = listResult.error ?? 'Could not add this recommendation to your lists.'
      setError(
        createdItem
          ? `Added to your vault, but list update failed: ${nextError}`
          : nextError
      )
      showToast(nextError, 'error')
      router.refresh()
      return
    }

    const nextMessage =
      listResult.added > 0
        ? `Added ${createdItem ? 'to your vault and ' : ''}to ${listResult.added} list${
            listResult.added === 1 ? '' : 's'
          }.${listResult.skipped > 0 ? ` ${listResult.skipped} duplicate skipped.` : ''}`
        : createdItem
          ? 'Added to your vault. It was already in the selected lists.'
          : 'This item was already in the selected lists.'

    setSelectedListIds(new Set())
    setMessage(nextMessage)
    showToast(nextMessage)
    router.refresh()
  }

  function dismissRecommendation() {
    onDismiss(recommendation)
    closePreview()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true)
          setMessage(null)
          setError(null)
        }}
        className="group min-w-[44vw] max-w-[44vw] text-left outline-none sm:min-w-[188px] sm:max-w-[188px]"
        aria-label={`Preview recommendation ${recommendation.title}`}
      >
        <span className="glass-panel-soft relative block aspect-[2/3] overflow-hidden rounded-xl border border-white/10 transition group-hover:border-violet-300/40 group-focus-visible:border-violet-300/70 group-focus-visible:ring-2 group-focus-visible:ring-violet-400/40">
          {recommendation.imageUrl ? (
            <Image
              src={recommendation.imageUrl}
              alt={recommendation.title}
              fill
              sizes="188px"
              className="object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-slate-500">No Cover</span>
          )}
          <span className="absolute left-3 top-3 rounded-xl border border-violet-300/30 bg-violet-500/20 px-2.5 py-1 text-[11px] font-semibold text-violet-100">
            Preview
          </span>
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-3">
            <span className="line-clamp-2 text-sm font-semibold text-white">{recommendation.title}</span>
            <span className="mt-1 block text-xs text-slate-300">{recommendation.subtitle}</span>
          </span>
        </span>
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/88 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discover-preview-title"
        >
          <div className="max-h-[calc(100dvh-3rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200/75">
                  AI Discover
                </p>
                <h2 id="discover-preview-title" className="mt-2 text-2xl font-bold text-slate-100">
                  {recommendation.title}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {recommendation.type} from {recommendation.provider}
                  {recommendation.year ? ` / ${recommendation.year}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={closePreview}
                disabled={isSavingToLists}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-200 transition hover:border-blue-400/40 disabled:opacity-60"
                aria-label="Close recommendation preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="min-w-0">
                <div className="relative mx-auto aspect-[2/3] w-full max-w-[180px] overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                  {recommendation.imageUrl ? (
                    <Image
                      src={recommendation.imageUrl}
                      alt={recommendation.title}
                      fill
                      sizes="180px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      No cover
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0 space-y-5">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-xl border border-blue-400/25 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-100">
                    {recommendation.type}
                  </span>
                  <span className="rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-100">
                    {recommendation.provider}
                  </span>
                  {rating ? (
                    <span className="rounded-xl border border-yellow-400/25 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-100">
                      {rating}
                    </span>
                  ) : null}
                  {isAlreadyInVault ? (
                    <span className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                      Already in vault
                    </span>
                  ) : null}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Why this pick?</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {recommendation.description ||
                      'This recommendation is based on your highest-rated anime and manga.'}
                  </p>
                </div>

                {recommendation.genres.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Genres</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {recommendation.genres.slice(0, 8).map((genre) => (
                        <span
                          key={genre}
                          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={openAddModal}
                    disabled={isAlreadyInVault || isSavingToLists}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    {isAlreadyInVault ? 'Already in vault' : 'Add to vault'}
                  </button>

                  {recommendation.sourceUrl ? (
                    <Link
                      href={recommendation.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open source
                    </Link>
                  ) : null}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">Add to list</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        {currentItemId
                          ? 'Use your existing custom-list picker for this saved vault item.'
                          : 'Choose custom lists. Media Vault will add this title to your vault first, then attach it to the selected lists.'}
                      </p>
                    </div>
                    {currentItemId ? (
                      <AddToListButton
                        itemId={currentItemId}
                        itemTitle={recommendation.title}
                        lists={listOptions}
                      />
                    ) : null}
                  </div>

                  {!currentItemId ? (
                    <>
                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-2">
                        {listOptions.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950 p-4 text-center">
                            <p className="text-sm font-semibold text-slate-100">
                              You do not have any custom lists yet.
                            </p>
                            <Link
                              href="/lists"
                              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400"
                              onClick={closePreview}
                            >
                              Create a list
                            </Link>
                          </div>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {listOptions.map((list) => {
                              const selected = selectedListIds.has(list.id)

                              return (
                                <button
                                  key={list.id}
                                  type="button"
                                  onClick={() => toggleList(list.id)}
                                  disabled={isSavingToLists}
                                  className={`grid min-h-16 grid-cols-[auto_1fr] gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60 ${
                                    selected
                                      ? 'border-blue-400/60 bg-blue-500/15'
                                      : 'border-slate-800 bg-slate-950 hover:border-blue-400/30'
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

                      <button
                        type="button"
                        onClick={addToSelectedLists}
                        disabled={listOptions.length === 0 || selectedListIds.size === 0 || isSavingToLists}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ListPlus className="h-4 w-4" />
                        {isSavingToLists
                          ? 'Saving...'
                          : selectedListIds.size > 0
                            ? `Add to ${selectedListIds.size} list${selectedListIds.size === 1 ? '' : 's'}`
                            : 'Add to selected lists'}
                      </button>
                    </>
                  ) : null}

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
                </div>

                <button
                  type="button"
                  onClick={dismissRecommendation}
                  disabled={isSavingToLists}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-red-400/40 hover:text-white disabled:opacity-60"
                >
                  Dismiss / Not interested
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
