import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ListChecks, Lock, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'

import PublicLibraryGrid from '../../../../../components/PublicLibraryGrid'
import { getPublicListDetailBySlug } from '../../../../../lib/data/lists'
import { getProfileByUsername } from '../../../../../lib/data/profiles'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Public List | Media Vault',
  description: 'A public, read-only Media Vault custom list.',
}

type PageProps = {
  params: Promise<{
    listSlug: string
    username: string
  }>
}

const usernamePattern = /^[a-z0-9_-]{3,30}$/
const listSlugPattern = /^[a-z0-9_-]{3,60}$/

export default async function PublicListPage(props: PageProps) {
  const { listSlug: listSlugParam, username: usernameParam } = await props.params
  const username = usernameParam.trim().toLowerCase()
  const listSlug = listSlugParam.trim().toLowerCase()

  if (!usernamePattern.test(username) || !listSlugPattern.test(listSlug)) {
    return (
      <PublicStateCard
        icon={<UserRound className="h-5 w-5" />}
        message="This public list does not exist or is not available."
        title="Public list not found"
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
        message="This vault is private. Public lists are hidden until the owner enables sharing."
        title="Private vault"
      />
    )
  }

  const publicListResult = await getPublicListDetailBySlug(profile.id, listSlug)

  if (publicListResult.error) {
    return (
      <PublicStateCard
        icon={<Lock className="h-5 w-5" />}
        message={publicListResult.error}
        title="List unavailable"
      />
    )
  }

  if (publicListResult.notFound || !publicListResult.list) {
    return (
      <PublicStateCard
        icon={<ListChecks className="h-5 w-5" />}
        message="This list is private, missing, or no longer shared."
        title="Public list not found"
      />
    )
  }

  const publicList = publicListResult.list
  const displayName = profile.displayName || profile.username

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 pb-32 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl min-w-0">
        <header className="mb-8 min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
          <Link
            href={`/u/${profile.username}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to @{profile.username}
          </Link>

          <div className="mt-6 max-w-4xl min-w-0">
            <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
              <ListChecks className="h-4 w-4" />
              Public List
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {publicList.name}
            </h1>
            <p className="mt-3 text-sm font-medium text-blue-200">
              By {displayName} (@{profile.username})
            </p>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
              {publicList.description ||
                'A read-only custom list shared from this Media Vault.'}
            </p>
          </div>
        </header>

        <section className="mb-8 grid min-w-0 gap-4 md:grid-cols-3">
          <SummaryCard label="Items in list" value={String(publicList.items.length)} />
          <SummaryCard
            label="Completed"
            value={String(
              publicList.items.filter(
                (item) => item.status.trim().toLowerCase() === 'completed'
              ).length
            )}
          />
          <SummaryCard
            label="Rated"
            value={String(
              publicList.items.filter((item) => typeof item.rating === 'number').length
            )}
          />
        </section>

        <PublicLibraryGrid
          emptyMessage="This public list is empty right now."
          items={publicList.items}
        />
      </div>
    </main>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  )
}

function PublicStateCard({
  icon,
  message,
  title,
}: {
  icon: ReactNode
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
