import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import DeleteItemButton from '../../../components/DeleteItemButton'
import FavoriteToggleButton from '../../../components/FavoriteToggleButton'
import ItemQuickEditPanel from '../../../components/ItemQuickEditPanel'
import AddToListButton from '../../../components/lists/AddToListButton'
import { getItemById } from '../../../lib/data/items'
import { getCustomLists } from '../../../lib/data/lists'
import { toMediaItem, type MediaItemRecord } from '../../../lib/media'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export async function generateMetadata(
  props: PageProps<'/items/[id]'>
): Promise<Metadata> {
  const { id } = await props.params
  const { data: item } = await getItemById(id)

  if (!item) {
    return {
      title: 'Item Not Found | Media Vault',
    }
  }

  return {
    title: `${item.title} | Media Vault`,
    description: `${item.type} entry currently marked as ${item.status}.`,
  }
}

export default async function ItemDetailsPage(props: PageProps<'/items/[id]'>) {
  const { id } = await props.params
  const searchParams = await props.searchParams
  const [{ data: item, error }, listsResult] = await Promise.all([getItemById(id), getCustomLists()])

  if (error || !item) {
    notFound()
  }

  const createdAt = item.created_at
    ? new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
      }).format(new Date(item.created_at))
    : 'Unknown'
  const mediaItem = toMediaItem(item as MediaItemRecord)
  const backQuery =
    typeof searchParams.back === 'string' && searchParams.back.length > 0
      ? `/?${searchParams.back}`
      : '/'
  const editReturnTo =
    typeof searchParams.back === 'string' && searchParams.back.length > 0
      ? `/items/${item.id}?back=${searchParams.back}`
      : `/items/${item.id}`
  const listOptions = listsResult.schemaReady ? listsResult.lists : []

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 pb-32 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={backQuery}
          className="glass-panel-soft inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400/40 hover:text-white"
        >
          Back to vault
        </Link>
      </div>

      <section className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <div className="glass-panel surface-highlight relative aspect-[2/3] overflow-hidden rounded-xl">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-white/5" />
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt={item.title}
              fill
              sizes="(max-width: 1024px) 100vw, 320px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              No Cover
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-panel space-y-4 rounded-xl p-6 sm:p-7">
            <div className="flex flex-wrap gap-2">
              {mediaItem.favorite ? <Badge tone="favorite">Favorite</Badge> : null}
              <Badge>{item.status}</Badge>
              <Badge tone="muted">{item.type}</Badge>
            </div>

            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white">{item.title}</h1>
              <p className="mt-3 max-w-2xl text-slate-400">
                A focused view for this entry with its current status, progress, and saved
                metadata.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <FavoriteToggleButton
                favorite={mediaItem.favorite}
                id={item.id}
                title={item.title}
              />
              <Link
                href={{
                  pathname: `/items/${item.id}/edit`,
                  query: {
                    returnTo: editReturnTo,
                  },
                }}
                className="glass-panel-soft rounded-xl px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400/40 hover:text-white"
              >
                Edit
              </Link>
              <AddToListButton
                itemId={item.id}
                itemTitle={item.title}
                lists={listOptions}
                variant="detail"
              />
              <DeleteItemButton
                id={item.id}
                imageUrl={mediaItem.imageUrl}
                title={item.title}
                redirectTo={backQuery}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="Type" value={item.type} />
            <InfoCard
              label="Total"
              value={mediaItem.totalProgress ? String(mediaItem.totalProgress) : 'Not set'}
            />
            <InfoCard label="Added" value={createdAt} />
            <InfoCard label="Started" value={formatShortDate(mediaItem.startedAt)} />
            <InfoCard label="Completed" value={formatShortDate(mediaItem.completedAt)} />
          </div>

          <ItemQuickEditPanel item={mediaItem} />

          {mediaItem.genres.length > 0 ? (
            <section className="rounded-xl border border-slate-800 bg-slate-900/80 px-5 py-5">
              <p className="text-sm text-slate-400">Genres</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {mediaItem.genres.map((genre) => (
                  <Badge key={genre} tone="muted">
                    {genre}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  )
}

function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'default' | 'muted' | 'rating' | 'favorite'
}) {
  const toneClassName =
    tone === 'rating'
      ? 'border-blue-400/30 bg-blue-500/18 text-blue-100 shadow-[0_0_18px_rgba(59,130,246,0.16)]'
      : tone === 'favorite'
        ? 'border-amber-400/30 bg-amber-400/18 text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.16)]'
      : tone === 'muted'
        ? 'border-white/10 bg-white/6 text-slate-200'
        : 'border-emerald-400/30 bg-emerald-500/18 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.16)]'

  return (
    <span className={`rounded-xl border px-3 py-1 text-sm font-medium ${toneClassName}`}>
      {children}
    </span>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel-soft rounded-xl px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-white">{value}</p>
    </div>
  )
}

function formatShortDate(value?: string | null) {
  if (!value) {
    return 'Not set'
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(new Date(value))
}
