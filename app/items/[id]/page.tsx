
import { ui } from '../../../lib/ui-i18n'
import { getRequestLocale } from '../../../lib/i18n-server'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import DeleteItemButton from '../../../components/DeleteItemButton'
import CoverPlaceholder from '../../../components/CoverPlaceholder'
import FavoriteToggleButton from '../../../components/FavoriteToggleButton'
import ItemQuickEditPanel from '../../../components/ItemQuickEditPanel'
import ItemProviderPanel from '../../../components/ItemProviderPanel'
import { getProviderReference } from '../../../lib/provider-details'
import AddToListButton from '../../../components/lists/AddToListButton'
import { getItemById } from '../../../lib/data/items'
import { getCustomLists } from '../../../lib/data/lists'
import { formatProgressValue, toMediaItem, type MediaItem, type MediaItemRecord } from '../../../lib/media'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export async function generateMetadata(
  props: PageProps<'/items/[id]'>
): Promise<Metadata> {
  const locale = await getRequestLocale()

  const { id } = await props.params
  const { data: item } = await getItemById(id)

  if (!item) {
    return {
      title: 'Item Not Found | Media Vault',
    }
  }

  return {
    title: ui(locale, "{value0} | Media Vault", { value0: item.title }),
    description: ui(locale, "{value0} entry currently marked as {value1}.", { value0: item.type, value1: item.status }),
  }
}

export default async function ItemDetailsPage(props: PageProps<'/items/[id]'>) {
  const locale = await getRequestLocale()

  const { id } = await props.params
  const searchParams = await props.searchParams
  const [{ data: item, error }, listsResult] = await Promise.all([getItemById(id), getCustomLists()])

  if (error || !item) {
    notFound()
  }

  const createdAt = item.created_at
    ? new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
        dateStyle: 'medium',
      }).format(new Date(item.created_at))
    : ui(locale, 'Unknown')
  const mediaItem = toMediaItem(item as MediaItemRecord)
  const safeReturnTo = getSafeReturnTo(searchParams.returnTo)
  const backParam =
    typeof searchParams.back === 'string' && searchParams.back.length > 0 ? searchParams.back : null
  const backQuery = safeReturnTo ?? (backParam ? `/?${backParam}` : '/')
  const detailParams = new URLSearchParams()

  if (safeReturnTo) {
    detailParams.set('returnTo', safeReturnTo)
  } else if (backParam) {
    detailParams.set('back', backParam)
  }

  const detailQuery = detailParams.toString()
  const editReturnTo = detailQuery ? `/items/${item.id}?${detailQuery}` : `/items/${item.id}`
  const listOptions = listsResult.schemaReady ? listsResult.lists : []

  return (
    <main className="vault-page">
      <div className="mb-5">
        <Link
          href={backQuery}
          className="glass-panel-soft inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400/40 hover:text-white"
        > {ui(locale, "Back to vault")} </Link>
      </div>

      <section className="grid min-w-0 gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start xl:grid-cols-[280px_minmax(0,1fr)] xl:gap-6">
        <aside className="order-2 grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4 lg:order-none lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-[var(--vault-header-offset)] lg:block lg:space-y-4 lg:self-start">
          <div className="glass-panel surface-highlight relative mx-auto aspect-[2/3] w-full overflow-hidden rounded-xl">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-white/5" />
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt={item.title}
                fill
                sizes="(max-width: 640px) 80px, (max-width: 1024px) 180px, 280px"
                className="object-cover"
              />
            ) : (
              <CoverPlaceholder title={item.title} type={item.type} />
            )}
          </div>

          <ItemSnapshot item={mediaItem} addedAt={createdAt} />
        </aside>

          <div className="glass-panel order-1 min-w-0 space-y-4 rounded-xl p-5 sm:p-6 lg:col-start-2 lg:row-start-1">
            <div className="flex flex-wrap gap-2">
              {mediaItem.favorite ? <Badge tone="favorite"> {ui(locale, "Favorite")} </Badge> : null}
              <Badge>{item.status}</Badge>
              <Badge tone="muted">{item.type}</Badge>
            </div>

            <div>
              <h1 className="vault-title">{item.title}</h1>
              <p className="mt-3 max-w-2xl text-slate-400"> {ui(locale, "A focused view for this entry with its current status, progress, and saved metadata.")} </p>
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
                className="glass-panel-soft inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400/40 hover:text-white"
              > {ui(locale, "Edit")} </Link>
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

        <div className="order-3 min-w-0 space-y-4 lg:col-start-2 lg:row-start-2">
          <ItemQuickEditPanel key={mediaItem.id} item={mediaItem} />
          <ItemProviderPanel key={`provider-${mediaItem.id}`} itemId={mediaItem.id} supported={Boolean(getProviderReference(mediaItem))} />

          {mediaItem.genres.length > 0 ? (
            <section className="rounded-xl border border-slate-800 bg-slate-900/80 px-5 py-5">
              <p className="text-sm text-slate-400"> {ui(locale, "Saved genres")} </p>
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

async function ItemSnapshot({ addedAt, item }: { addedAt: string; item: MediaItem }) {
  const locale = await getRequestLocale()

  const progressLabel =
    item.progress > 0 || item.totalProgress !== null ? formatProgressValue(item, locale) : ui(locale, "Not started")

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"> {ui(locale, "Quick snapshot")} </p>
      <dl className="mt-4 space-y-3">
        <SnapshotRow label={ui(locale, "Type")} value={item.type} />
        <SnapshotRow label={ui(locale, "Status")} value={item.status} />
        <SnapshotRow label={ui(locale, "My rating")} value={item.rating ? `${item.rating} / 10` : ui(locale, "Not rated")} />
        <SnapshotRow label={ui(locale, "Progress")} value={progressLabel} />
        <SnapshotRow label={ui(locale, "Added")} value={addedAt} />
      </dl>
    </section>
  )
}

function getSafeReturnTo(value: string | string[] | undefined) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return null
  }

  return value
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-800/80 pb-3 last:border-b-0 last:pb-0">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm font-semibold text-slate-100">{value}</dd>
    </div>
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
