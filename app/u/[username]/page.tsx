import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Compass, ListChecks, Lock, UserRound } from 'lucide-react'

import CopyPublicLinkButton from '../../../components/public/CopyPublicLinkButton'
import PublicVaultExplorer from '../../../components/public/PublicVaultExplorer'
import { getCurrentUser } from '../../../lib/auth/dal'
import { getPublicItemsByUserId } from '../../../lib/data/items'
import { getPublicListsForProfile } from '../../../lib/data/lists'
import { getProfileByUsername } from '../../../lib/data/profiles'
import { toMediaItem, type MediaItemRecord } from '../../../lib/media'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  params: Promise<{
    username: string
  }>
}

const usernamePattern = /^[a-z0-9_-]{3,30}$/

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { username: usernameParam } = await props.params
  const username = usernameParam.trim().toLowerCase()

  if (!usernamePattern.test(username)) {
    return {
      title: 'Profile Not Found',
      description: 'This Media Vault public profile is not available.',
    }
  }

  const profileResult = await getProfileByUsername(username)

  if (profileResult.error || !profileResult.data) {
    return {
      title: 'Profile Not Found',
      description: 'This Media Vault public profile is not available.',
    }
  }

  const profile = profileResult.data

  if (!profile.isPublic) {
    return {
      title: 'Private Vault',
      description: 'This Media Vault profile is private.',
    }
  }

  const displayName = profile.displayName || profile.username
  const description = `Browse ${displayName}'s public Media Vault in read-only mode.`
  const path = `/u/${profile.username}`

  return {
    title: `${displayName} | Media Vault`,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: `${displayName} | Media Vault`,
      description,
      url: path,
      siteName: 'Media Vault',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayName} | Media Vault`,
      description,
    },
  }
}

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

  const [itemsResult, publicListsResult, currentUser] = await Promise.all([
    getPublicItemsByUserId(profile.id),
    getPublicListsForProfile(profile.id),
    getCurrentUser(),
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
  const publicListsSupported = !publicListsResult.error
  const publicLists = publicListsSupported ? publicListsResult.lists : []
  const completedCount = items.filter(
    (item) => item.status.trim().toLowerCase() === 'completed'
  ).length
  const ratedCount = items.filter((item) => typeof item.rating === 'number').length

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 pb-32 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl min-w-0">
        <header className="mb-8 min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-slate-950/30 sm:p-7">
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">
                <Compass className="h-4 w-4" />
                Public Vault
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                {displayName}
              </h1>
              <p className="mt-3 text-sm font-medium text-blue-200">@{profile.username}</p>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-400">
                Browse this Media Vault in read-only mode. Public visitors can explore visible
                titles and shared lists, while editing, deleting, importing, backups, and account
                controls stay private.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <CopyPublicLinkButton path={`/u/${profile.username}`} />
                {currentUser ? (
                  <Link
                    href="/"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-slate-800"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to vault
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <SummaryCard label="Public items" value={String(items.length)} />
              <SummaryCard label="Completed" value={String(completedCount)} />
              <SummaryCard label="Rated" value={String(ratedCount)} />
              {publicListsSupported ? (
                <SummaryCard label="Public lists" value={String(publicLists.length)} />
              ) : null}
            </div>
          </div>
        </header>

        <section className="mb-8 grid min-w-0 gap-4 lg:grid-cols-2">
          <BreakdownCard emptyLabel="No media types yet." items={typeCounts} title="By Type" />
          <BreakdownCard emptyLabel="No statuses yet." items={statusCounts} title="By Status" />
        </section>

        {publicListsSupported ? (
          <PublicListsSection lists={publicLists} username={profile.username} />
        ) : null}

        <PublicVaultExplorer items={items} />
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
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950 p-4">
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
        <div className="mt-5 rounded-xl border border-dashed border-slate-800 bg-slate-950 p-5">
          <h3 className="text-base font-semibold text-slate-100">No public lists yet.</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            This vault is public, but the owner has not shared any custom lists.
          </p>
        </div>
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
              <span className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-100">
                Open list
              </span>
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
