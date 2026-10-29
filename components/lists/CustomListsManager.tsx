'use client'

import { ui, countNoun } from '../../lib/ui-i18n'
import { useLocale } from '../LocaleProvider'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Copy, ExternalLink, Globe2, Lock, Pencil, Plus, Share2, Trash2 } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'

import {
  createListAction,
  deleteListAction,
  updateListAction,
  updateListSharingAction,
} from '../../app/actions/lists'
import { useToast } from '../ToastProvider'
import ListCoverCollage from './ListCoverCollage'
import { useListActionRequest } from './useListActionRequest'

type ListSummary = {
  coverUrls?: string[]
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
  const { locale } = useLocale()

  const router = useRouter()
  const { showToast } = useToast()
  const runRequest = useListActionRequest()
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
  useEffect(() => { setLiveLists(lists) }, [lists])
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
    const result = await runRequest('create', () => createListAction({ description, name }), () => setIsCreating(false))
    if (!result) return

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
    showToast(ui(locale, "List created."))
    router.refresh()
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editing || isSavingEdit) {
      return
    }

    setIsSavingEdit(true)
    const result = await runRequest('edit', () => updateListAction(editing.id, {
      description: editing.description,
      name: editing.name,
    }), () => setIsSavingEdit(false))
    if (!result) return

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
    showToast(ui(locale, "List updated."))
    router.refresh()
  }

  async function handleSaveSharing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!sharing || isSavingSharing) {
      return
    }

    setIsSavingSharing(true)
    const result = await runRequest('sharing', () => updateListSharingAction(sharing.id, {
      isPublic: sharing.isPublic,
      slug: sharing.slug,
    }), () => setIsSavingSharing(false))
    if (!result) return

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
    showToast(savedList.isPublic ? ui(locale, "List is ready for public sharing.") : ui(locale, "List is private."))
    router.refresh()
  }

  async function handleCopyPublicUrl(slug: string) {
    if (!profileUsername) {
      showToast(ui(locale, "Choose a username in Settings before copying a public list link."), 'error')
      return
    }

    const url = `${window.location.origin}/u/${profileUsername}/lists/${slug}`

    try {
      await navigator.clipboard.writeText(url)
      showToast(ui(locale, "Public list link copied."))
    } catch {
      showToast(ui(locale, "Could not copy the link. You can open it and copy from the address bar."), 'error')
    }
  }

  async function handleDelete() {
    if (!deleteTarget || isDeleting) {
      return
    }

    setIsDeleting(true)
    const result = await runRequest('delete', () => deleteListAction(deleteTarget.id), () => setIsDeleting(false))
    if (!result) return

    if (!result.success) {
      showToast(result.error ?? 'Could not delete list.', 'error')
      return
    }

    setLiveLists((current) => current.filter((list) => list.id !== deleteTarget.id))
    setDeleteTarget(null)
    showToast(ui(locale, "List deleted. Vault items were not deleted."))
    router.refresh()
  }

  return (
    <div className="min-w-0 space-y-8">
      <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <div className="max-w-2xl min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-slate-100"> {ui(locale, "Create a custom list")} </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400"> {ui(locale, "Build collections from items already in your Media Vault. Lists stay private until you choose to share them.")} </p>
        </div>

        <form onSubmit={handleCreate} className="mt-5 grid min-w-0 gap-3 lg:grid-cols-[1fr_1.3fr_auto]">
          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-slate-200"> {ui(locale, "Name")} </span>
            <input
              value={name}
              disabled={isCreating}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder={ui(locale, "Favorites, Study queue, Summer watchlist...")}
              className="min-h-12 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400"
            />
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-slate-200"> {ui(locale, "Description")} </span>
            <input
              value={description}
              disabled={isCreating}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              placeholder={ui(locale, "Optional note about this collection")}
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
              {isCreating ? ui(locale, "Creating...") : ui(locale, "Create list")}
            </button>
          </div>
        </form>
      </section>

      {!sharingReady ? (
        <section className="min-w-0 rounded-xl border border-amber-400/30 bg-amber-500/10 p-5 text-amber-100">
          <h2 className="text-lg font-bold"> {ui(locale, "One SQL setup step enables public list sharing")} </h2>
          <p className="mt-2 text-sm leading-6 text-amber-50/85"> {ui(locale, "Your private lists still work. To add public list links, run this migration in Supabase SQL Editor, then refresh:")} </p>
          <p className="mt-3 overflow-x-auto rounded-xl border border-amber-400/20 bg-slate-950 px-4 py-3 text-sm text-amber-100">
            supabase/migrations/20260427_public_profiles_lists.sql
          </p>
        </section>
      ) : null}

      <section className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75"> {ui(locale, "Custom Collections")} </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white"> {ui(locale, "Your lists")} </h2>
          </div>
          <p className="text-sm text-slate-400">
            {liveLists.length} {countNoun(locale, liveLists.length, "list")}
          </p>
        </div>

        {sortedLists.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900 p-8 text-center">
            <h3 className="text-lg font-semibold text-slate-100"> {ui(locale, "No custom lists yet.")} </h3>
            <p className="mt-2 text-sm text-slate-400"> {ui(locale, "Your Library items are not shown here automatically. Create a list, then add existing vault items to it.")} </p>
          </div>
        ) : (
          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedLists.map((list) => (
              <article
                key={list.id}
                className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-xl shadow-slate-950/20"
              >
                <Link href={`/lists/${list.id}`} aria-label={ui(locale, "Preview {value0}", { value0: list.name })} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">
                  <ListCoverCollage covers={list.coverUrls ?? []} />
                </Link>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-slate-100">{list.name}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-300">
                        {list.itemCount} {countNoun(locale, list.itemCount, "item")}
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
                        {list.isPublic ? ui(locale, 'Public') : ui(locale, 'Private')}
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
                      aria-label={ui(locale, "Edit {value0}", { value0: list.name })}
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
                      aria-label={ui(locale, "Sharing settings for {value0}", { value0: list.name })}
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(list)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10 text-red-100 transition hover:bg-red-500/20"
                      aria-label={ui(locale, "Delete {value0}", { value0: list.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="mt-4 line-clamp-3 min-h-[3rem] text-sm leading-6 text-slate-400">
                  {list.description || 'No description yet.'}
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500"> {ui(locale, "Updated")} {formatDate(list.updatedAt ?? list.createdAt, locale)}
                  </p>
                  <Link
                    href={`/lists/${list.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20"
                  > {ui(locale, "Open list")} </Link>
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
            role="dialog" aria-modal="true" aria-label={ui(locale, "List sharing settings")}
            className="max-h-[calc(100dvh-4rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75"> {ui(locale, "Sharing")} </p>
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
                {sharing.isPublic ? ui(locale, 'Public') : ui(locale, 'Private')}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <input
                  type="checkbox"
                  checked={sharing.isPublic}
                  disabled={isSavingSharing}
                  onChange={(event) =>
                    setSharing((current) =>
                      current ? { ...current, isPublic: event.target.checked } : current
                    )
                  }
                  className="mt-1 h-4 w-4 rounded-xl border-slate-700 bg-slate-900 text-blue-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-100"> {ui(locale, "Make this list public")} </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-400"> {ui(locale, "Public lists are visible only when your Public Vault is enabled in Settings.")} </span>
                </span>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-200"> {ui(locale, "Public slug")} </span>
                <input
                  value={sharing.slug}
                  disabled={isSavingSharing}
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
                <span className="text-xs leading-5 text-slate-500"> {ui(locale, "Use 3-60 lowercase letters, numbers, underscores, or hyphens.")} </span>
              </label>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"> {ui(locale, "Public URL")} </p>
                <p className="mt-2 break-all text-sm text-slate-200">
                  /u/{profileUsername || 'your-username'}/lists/{sharing.slug || 'list-slug'}
                </p>

                {!profileUsername ? (
                  <p className="mt-3 text-sm leading-6 text-amber-100"> {ui(locale, "Choose a username in Settings before this list can be shared.")} </p>
                ) : !isProfilePublic ? (
                  <p className="mt-3 text-sm leading-6 text-amber-100"> {ui(locale, "Enable Public Vault in Settings before public visitors can open this list.")} </p>
                ) : sharing.isPublic && sharing.slug ? (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => handleCopyPublicUrl(sharing.slug)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
                    >
                      <Copy className="h-4 w-4" /> {ui(locale, "Copy link")} </button>
                    <Link
                      href={`/u/${profileUsername}/lists/${sharing.slug}`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20"
                    >
                      <ExternalLink className="h-4 w-4" /> {ui(locale, "Open public list")} </Link>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-slate-400"> {ui(locale, "Save a slug and make the list public to activate this URL.")} </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSharing(null)}
                disabled={isSavingSharing}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:opacity-60"
              > {ui(locale, "Cancel")} </button>
              <button
                type="submit"
                disabled={
                  isSavingSharing ||
                  (sharing.isPublic && sharing.slug.trim().length === 0)
                }
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:opacity-60"
              >
                {isSavingSharing ? ui(locale, "Saving...") : ui(locale, "Save sharing")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/85 px-4 py-8 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            role="dialog" aria-modal="true" aria-label={ui(locale, "Edit list")}
            className="max-h-[calc(100dvh-4rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl"
          >
            <h2 className="text-xl font-bold text-slate-100"> {ui(locale, "Edit list")} </h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-200"> {ui(locale, "Name")} </span>
                <input
                  value={editing.name}
                  disabled={isSavingEdit}
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
                <span className="text-sm font-semibold text-slate-200"> {ui(locale, "Description")} </span>
                <textarea
                  value={editing.description}
                  disabled={isSavingEdit}
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
              > {ui(locale, "Cancel")} </button>
              <button
                type="submit"
                disabled={isSavingEdit || editing.name.trim().length === 0}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:opacity-60"
              >
                {isSavingEdit ? ui(locale, "Saving...") : ui(locale, "Save changes")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/85 px-4 py-8 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label={ui(locale, "Delete list")} className="max-h-[calc(100dvh-4rem)] w-full max-w-md overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-100"> {ui(locale, "Delete this list?")} </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"> {ui(locale, "This removes the list named &quot;")} {deleteTarget.name} {ui(locale, "&quot;. Items will remain in your vault.")} </p>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 disabled:opacity-60"
              > {ui(locale, "Cancel")} </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/30 disabled:opacity-60"
              >
                {isDeleting ? ui(locale, "Deleting...") : ui(locale, "Delete list")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatDate(value: string | null, locale: import('../../lib/i18n').Locale = 'en') {
  if (!value) {
    return ui(locale, 'recently')
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return ui(locale, 'recently')
  }

  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}
