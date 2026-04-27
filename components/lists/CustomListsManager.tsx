'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, ExternalLink, Globe2, Lock, Pencil, Plus, Share2, Trash2 } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'

import {
  createListAction,
  deleteListAction,
  updateListAction,
  updateListSharingAction,
} from '../../app/actions/lists'
import { useToast } from '../ToastProvider'

type ListSummary = {
  createdAt: string | null
  description: string | null
  id: string
  isPublic: boolean
  itemCount: number
  name: string
  slug: string | null
  updatedAt: string | null
}

type EditingState = {
  description: string
  id: string
  name: string
} | null

type SharingState = {
  id: string
  isPublic: boolean
  name: string
  slug: string
} | null

type ProfileSharingContext = {
  isPublic: boolean
  username: string | null
} | null

export default function CustomListsManager({
  lists,
  profile,
  sharingReady,
}: {
  lists: ListSummary[]
  profile: ProfileSharingContext
  sharingReady: boolean
}) {
  const router = useRouter()
  const { showToast } = useToast()
  const [liveLists, setLiveLists] = useState(lists)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editing, setEditing] = useState<EditingState>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [sharing, setSharing] = useState<SharingState>(null)
  const [isSavingSharing, setIsSavingSharing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ListSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const profileUsername = profile?.username ?? null
  const isProfilePublic = Boolean(profile?.isPublic)
  const sortedLists = useMemo(
    () =>
      [...liveLists].sort((left, right) => {
        const rightDate = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime()
        const leftDate = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime()
        return rightDate - leftDate
      }),
    [liveLists]
  )

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isCreating) {
      return
    }

    setIsCreating(true)
    const result = await createListAction({ description, name })
    setIsCreating(false)

    const newListId = result.listId

    if (!result.success || !newListId) {
      showToast(result.error ?? 'Could not create list.', 'error')
      return
    }

    const now = new Date().toISOString()
    setLiveLists((current) => [
      {
        createdAt: now,
        description: description.trim() || null,
        id: newListId,
        isPublic: false,
        itemCount: 0,
        name: name.trim(),
        slug: null,
        updatedAt: now,
      },
      ...current,
    ])
    setName('')
    setDescription('')
    showToast('List created.')
    router.refresh()
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editing || isSavingEdit) {
      return
    }

    setIsSavingEdit(true)
    const result = await updateListAction(editing.id, {
      description: editing.description,
      name: editing.name,
    })
    setIsSavingEdit(false)

    if (!result.success) {
      showToast(result.error ?? 'Could not update list.', 'error')
      return
    }

    const now = new Date().toISOString()
    setLiveLists((current) =>
      current.map((list) =>
        list.id === editing.id
          ? {
              ...list,
              description: editing.description.trim() || null,
              name: editing.name.trim(),
              updatedAt: now,
            }
          : list
      )
    )
    setEditing(null)
    showToast('List updated.')
    router.refresh()
  }

  async function handleSaveSharing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!sharing || isSavingSharing) {
      return
    }

    setIsSavingSharing(true)
    const result = await updateListSharingAction(sharing.id, {
      isPublic: sharing.isPublic,
      slug: sharing.slug,
    })
    setIsSavingSharing(false)

    if (!result.success || !result.list) {
      showToast(result.error ?? 'Could not update list sharing.', 'error')
      return
    }

    const savedList = result.list
    const now = new Date().toISOString()
    setLiveLists((current) =>
      current.map((list) =>
        list.id === savedList.id
          ? {
              ...list,
              isPublic: savedList.isPublic,
              slug: savedList.slug,
              updatedAt: now,
            }
          : list
      )
    )
    setSharing(null)
    showToast(savedList.isPublic ? 'List is ready for public sharing.' : 'List is private.')
    router.refresh()
  }

  async function handleCopyPublicUrl(slug: string) {
    if (!profileUsername) {
      showToast('Choose a username in Settings before copying a public list link.', 'error')
      return
    }

    const url = `${window.location.origin}/u/${profileUsername}/lists/${slug}`

    try {
      await navigator.clipboard.writeText(url)
      showToast('Public list link copied.')
    } catch {
      showToast('Could not copy the link. You can open it and copy from the address bar.', 'error')
    }
  }

  async function handleDelete() {
    if (!deleteTarget || isDeleting) {
      return
    }

    setIsDeleting(true)
    const result = await deleteListAction(deleteTarget.id)
    setIsDeleting(false)

    if (!result.success) {
      showToast(result.error ?? 'Could not delete list.', 'error')
      return
    }

    setLiveLists((current) => current.filter((list) => list.id !== deleteTarget.id))
    setDeleteTarget(null)
    showToast('List deleted. Vault items were not deleted.')
    router.refresh()
  }

  return (
    <div className="min-w-0 space-y-8">
      <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <div className="max-w-2xl min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-slate-100">Create a custom list</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Build collections from items already in your Media Vault. Lists stay private until you
            choose to share them.
          </p>
        </div>

        <form onSubmit={handleCreate} className="mt-5 grid min-w-0 gap-3 lg:grid-cols-[1fr_1.3fr_auto]">
          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-slate-200">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="Favorites, Study queue, Summer watchlist..."
              className="min-h-12 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400"
            />
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-slate-200">Description</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              placeholder="Optional note about this collection"
              className="min-h-12 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isCreating || name.trim().length === 0}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
            >
              <Plus className="h-4 w-4" />
              {isCreating ? 'Creating...' : 'Create list'}
            </button>
          </div>
        </form>
      </section>

      {!sharingReady ? (
        <section className="min-w-0 rounded-xl border border-amber-400/30 bg-amber-500/10 p-5 text-amber-100">
          <h2 className="text-lg font-bold">One SQL setup step enables public list sharing</h2>
          <p className="mt-2 text-sm leading-6 text-amber-50/85">
            Your private lists still work. To add public list links, run this migration in Supabase
            SQL Editor, then refresh:
          </p>
          <p className="mt-3 overflow-x-auto rounded-xl border border-amber-400/20 bg-slate-950 px-4 py-3 text-sm text-amber-100">
            supabase/migrations/20260427_public_profiles_lists.sql
          </p>
        </section>
      ) : null}

      <section className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75">
              Custom Collections
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Your lists</h2>
          </div>
          <p className="text-sm text-slate-400">
            {liveLists.length} list{liveLists.length === 1 ? '' : 's'}
          </p>
        </div>

        {sortedLists.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900 p-8 text-center">
            <h3 className="text-lg font-semibold text-slate-100">No custom lists yet.</h3>
            <p className="mt-2 text-sm text-slate-400">
              Your Library items are not shown here automatically. Create a list, then add existing
              vault items to it.
            </p>
          </div>
        ) : (
          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedLists.map((list) => (
              <article
                key={list.id}
                className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-xl shadow-slate-950/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-slate-100">{list.name}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-300">
                        {list.itemCount} item{list.itemCount === 1 ? '' : 's'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold ${
                          list.isPublic
                            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                            : 'border-slate-700 bg-slate-950 text-slate-300'
                        }`}
                      >
                        {list.isPublic ? (
                          <Globe2 className="h-3.5 w-3.5" />
                        ) : (
                          <Lock className="h-3.5 w-3.5" />
                        )}
                        {list.isPublic ? 'Public' : 'Private'}
                      </span>
                      {list.slug ? (
                        <span className="rounded-xl border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-100">
                          /{list.slug}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          description: list.description ?? '',
                          id: list.id,
                          name: list.name,
                        })
                      }
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-200 transition hover:border-blue-400/40"
                      aria-label={`Edit ${list.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSharing({
                          id: list.id,
                          isPublic: list.isPublic,
                          name: list.name,
                          slug: list.slug ?? '',
                        })
                      }
                      disabled={!sharingReady}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-200 transition hover:border-blue-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Sharing settings for ${list.name}`}
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(list)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10 text-red-100 transition hover:bg-red-500/20"
                      aria-label={`Delete ${list.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="mt-4 line-clamp-3 min-h-[3rem] text-sm leading-6 text-slate-400">
                  {list.description || 'No description yet.'}
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    Updated {formatDate(list.updatedAt ?? list.createdAt)}
                  </p>
                  <Link
                    href={`/lists/${list.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20"
                  >
                    Open list
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {sharing ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/85 px-4 py-8 backdrop-blur-sm">
          <form
            onSubmit={handleSaveSharing}
            className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75">
                  Sharing
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-100">{sharing.name}</h2>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                  sharing.isPublic
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                    : 'border-slate-700 bg-slate-950 text-slate-300'
                }`}
              >
                {sharing.isPublic ? <Globe2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {sharing.isPublic ? 'Public' : 'Private'}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <input
                  type="checkbox"
                  checked={sharing.isPublic}
                  onChange={(event) =>
                    setSharing((current) =>
                      current ? { ...current, isPublic: event.target.checked } : current
                    )
                  }
                  className="mt-1 h-4 w-4 rounded-xl border-slate-700 bg-slate-900 text-blue-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-100">
                    Make this list public
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-400">
                    Public lists are visible only when your Public Vault is enabled in Settings.
                  </span>
                </span>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-200">Public slug</span>
                <input
                  value={sharing.slug}
                  onChange={(event) =>
                    setSharing((current) =>
                      current
                        ? {
                            ...current,
                            slug: event.target.value.toLowerCase().replace(/\s+/g, '-'),
                          }
                        : current
                    )
                  }
                  maxLength={60}
                  placeholder="favorites-or-watchlist"
                  className="min-h-12 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400"
                />
                <span className="text-xs leading-5 text-slate-500">
                  Use 3-60 lowercase letters, numbers, underscores, or hyphens.
                </span>
              </label>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Public URL
                </p>
                <p className="mt-2 break-all text-sm text-slate-200">
                  /u/{profileUsername || 'your-username'}/lists/{sharing.slug || 'list-slug'}
                </p>

                {!profileUsername ? (
                  <p className="mt-3 text-sm leading-6 text-amber-100">
                    Choose a username in Settings before this list can be shared.
                  </p>
                ) : !isProfilePublic ? (
                  <p className="mt-3 text-sm leading-6 text-amber-100">
                    Enable Public Vault in Settings before public visitors can open this list.
                  </p>
                ) : sharing.isPublic && sharing.slug ? (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleCopyPublicUrl(sharing.slug)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
                    >
                      <Copy className="h-4 w-4" />
                      Copy link
                    </button>
                    <Link
                      href={`/u/${profileUsername}/lists/${sharing.slug}`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open public list
                    </Link>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    Save a slug and make the list public to activate this URL.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSharing(null)}
                disabled={isSavingSharing}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isSavingSharing ||
                  (sharing.isPublic && sharing.slug.trim().length === 0)
                }
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:opacity-60"
              >
                {isSavingSharing ? 'Saving...' : 'Save sharing'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/85 px-4 py-8 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
          >
            <h2 className="text-xl font-bold text-slate-100">Edit list</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-200">Name</span>
                <input
                  value={editing.name}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, name: event.target.value } : current
                    )
                  }
                  maxLength={80}
                  className="min-h-12 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-blue-400"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-200">Description</span>
                <textarea
                  value={editing.description}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, description: event.target.value } : current
                    )
                  }
                  maxLength={500}
                  rows={4}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-blue-400"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={isSavingEdit}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit || editing.name.trim().length === 0}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:opacity-60"
              >
                {isSavingEdit ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/85 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-100">Delete this list?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This removes the list named &quot;{deleteTarget.name}&quot;. Items will remain in your vault.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/30 disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Delete list'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) {
    return 'recently'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'recently'
  }

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}
