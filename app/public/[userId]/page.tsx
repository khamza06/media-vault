import type { Metadata } from 'next'
import { Compass } from 'lucide-react'

import PublicLibraryGrid from '../../../components/PublicLibraryGrid'
import { getPublicItemsByUserId } from '../../../lib/data/items'
import { toMediaItem, type MediaItemRecord } from '../../../lib/media'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Public Vault | Media Vault',
  description: 'A public, read-only view of a Media Vault collection.',
}

type PageProps = {
  params: Promise<{
    userId: string
  }>
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function PublicVaultPage(props: PageProps) {
  const { userId } = await props.params

  if (!userId || !uuidPattern.test(userId)) {
    return <PublicStateCard message="Invalid public link. Please ask the owner for a correct one." />
  }

  const { data, error } = await getPublicItemsByUserId(userId)

  if (error) {
    return (
      <PublicStateCard
        message="This public vault is not available right now. Check the link or try again later."
      />
    )
  }

  const items = ((data ?? []) as MediaItemRecord[]).map(toMediaItem)

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 pb-32 sm:px-6 lg:px-8">
      <header className="mb-8 mt-6 max-w-4xl min-w-0">
        <div className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">
          <Compass className="h-4 w-4" />
          Public Vault
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Shared Media Library
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
          Browse this collection in read-only mode. Posters, genres, progress, and official
          ratings stay visible, while editing controls remain private to the owner.
        </p>
      </header>

      <section className="mb-6 grid min-w-0 gap-4 md:grid-cols-3">
        <SummaryCard label="Visible items" value={String(items.length)} />
        <SummaryCard
          label="Favorites"
          value={String(items.filter((item) => item.favorite).length)}
        />
        <SummaryCard
          label="Completed"
          value={String(items.filter((item) => item.status === 'Completed').length)}
        />
      </section>

      <PublicLibraryGrid items={items} />
    </main>
  )
}

function PublicStateCard({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-10 pb-32 sm:px-6 lg:px-8">
      <section className="glass-panel surface-highlight w-full rounded-xl px-6 py-10 text-center">
        <p className="text-base font-semibold text-white">{message}</p>
      </section>
    </main>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel-soft min-w-0 rounded-xl px-5 py-5">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  )
}
