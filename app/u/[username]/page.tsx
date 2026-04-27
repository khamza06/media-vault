import type { Metadata } from 'next'
import Link from 'next/link'
import { Compass, ListChecks, Lock, UserRound } from 'lucide-react'

import PublicLibraryGrid from '../../../components/PublicLibraryGrid'
import { getPublicItemsByUserId } from '../../../lib/data/items'
import { getPublicListsForProfile } from '../../../lib/data/lists'
import { getProfileByUsername } from '../../../lib/data/profiles'
import { toMediaItem, type MediaItemRecord } from '../../../lib/media'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Public Profile | Media Vault',
  description: 'A public, read-only Media Vault profile.',
}

type PageProps = {
  params: Promise<{
    username: string
  }>
}

const usernamePattern = /^[a-z0-9_-]{3,30}$/

export default async function PublicUserProfilePage(props: PageProps) {
  const { username: usernameParam } = await props.params
  const username = usernameParam.trim().toLowerCase()

  if (!usernamePattern.test(username)) {
    return (
      <PublicStateCard
        icon={<UserRound className="h-5 w-5" />}
        message="Public profile not found."
        title="Unknown profile"
      />
    )
  }

  const profileResult = await getProfileByUsername(username)

  if (profileResult.error || !profileResult.data) {
    return (
      <PublicStateCard
        icon={<UserRound className="h-5 w-5" />}
        message="This public profile does not exist or is not available."
        title="Profile not found"
      />
    )
  }

  const profile = profileResult.data

  if (!profile.isPublic) {
    return (
      <PublicStateCard
        icon={<Lock className="h-5 w-5" />}
        message="This vault is private. Ask the owner to enable public sharing."
        title="Private vault"
      />
    )
  }

  const [itemsResult, publicListsResult] = await Promise.all([
    getPublicItemsByUserId(profile.id),
    getPublicListsForProfile(profile.id),
  ])

  if (itemsResult.error) {
    return (
      <PublicStateCard
        icon={<Lock className="h-5 w-5" />}
        message="This public vault is not available right now. Try again later."
        title="Vault unavailable"
      />
    )
  }

  const items = ((itemsResult.data ?? []) as MediaItemRecord[]).map(toMediaItem)
  const typeCounts = getTopCounts(items.map((item) => item.type))
  const statusCounts = getTopCounts(items.map((item) => item.status))
  const displayName = profile.displayName || profile.username

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 pb-32 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl min-w-0">
        <header className="mb-8 max-w-4xl min-w-0">
          <div className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">
            <Compass className="h-4 w-4" />
            Public Vault
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {displayName}
          </h1>
          <p className="mt-3 text-sm font-medium text-blue-200">@{profile.username}</p>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
            Browse this Media Vault in read-only mode. Editing, deleting, importing,
            backups, list management, and private account controls are hidden from visitors.
          </p>
        </header>

        <section className="mb-6 grid min-w-0 gap-4 md:grid-cols-3">
          <SummaryCard label="Public items" value={String(items.length)} />
          <SummaryCard
            label="Completed"
            value={String(
              items.filter((item) => item.status.trim().toLowerCase() === 'completed')
                .length
            )}
          />
          <SummaryCard
            label="Rated"
            value={String(items.filter((item) => typeof item.rating === 'number').length)}
          />
        </section>

        <section className="mb-8 grid min-w-0 gap-4 lg:grid-cols-2">
          <BreakdownCard emptyLabel="No media types yet." items={typeCounts} title="By Type" />
          <BreakdownCard emptyLabel="No statuses yet." items={statusCounts} title="By Status" />
        </section>

        <PublicListsSection lists={publicListsResult.lists} username={profile.username} />

        <PublicLibraryGrid items={items} />
      </div>
    </main>
  )
}

function getTopCounts(values: string[]) {
  const counts = new Map<string, number>()

  for (const value of values) {
    const key = value.trim() || 'Unknown'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, 6)
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  )
}

function BreakdownCard({
  emptyLabel,
  items,
  title,
}: {
  emptyLabel: string
  items: Array<{ label: string; value: number }>
  title: string
}) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {items.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item.label}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            >
              {item.label}: {item.value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">{emptyLabel}</p>
      )}
    </section>
  )
}

function PublicListsSection({
  lists,
  username,
}: {
  lists: Array<{
    description: string | null
    id: string
    itemCount: number
    name: string
    slug: string
  }>
  username: string
}) {
  return (
    <section className="mb-8 min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
            <ListChecks className="h-4 w-4" />
            Public Lists
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">
            Shared collections
          </h2>
        </div>
        <p className="text-sm text-slate-400">
          {lists.length} public list{lists.length === 1 ? '' : 's'}
        </p>
      </div>

      {lists.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
          No public lists yet.
        </p>
      ) : (
        <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/u/${username}/lists/${list.slug}`}
              className="min-w-0 rounded-xl border border-slate-800 bg-slate-950 p-4 transition hover:border-blue-400/40 hover:bg-slate-900"
            >
              <h3 className="line-clamp-1 text-lg font-bold text-slate-100">{list.name}</h3>
              <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-400">
                {list.description || 'No description yet.'}
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                {list.itemCount} item{list.itemCount === 1 ? '' : 's'} - /{list.slug}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function PublicStateCard({
  icon,
  message,
  title,
}: {
  icon: React.ReactNode
  message: string
  title: string
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 pb-32 text-slate-100 sm:px-6 lg:px-8">
      <section className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-200">
          {icon}
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>
      </section>
    </main>
  )
}
