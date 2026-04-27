import Link from 'next/link'
import type { Metadata } from 'next'

import CopyShareLinkButton from '../../components/CopyShareLinkButton'
import SetupNotice from '../../components/SetupNotice'
import StatsDashboard from '../../components/stats/StatsDashboard'
import { getCurrentUser } from '../../lib/auth/dal'
import { getItems } from '../../lib/data/items'
import { getOwnershipMode } from '../../lib/data/ownership'
import { formatDateForLocale, t, translateStatus, translateType } from '../../lib/i18n'
import { getRequestLocale } from '../../lib/i18n-server'
import { toMediaItem, type MediaItem, type MediaItemRecord } from '../../lib/media'
import {
  getRecentItems,
  getTopRatedItems,
  groupGenres,
  groupItems,
} from '../../lib/stats'

export const revalidate = 0
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Stats | Media Vault',
  description: 'Analytics and trends for your media collection.',
}

export default async function StatsPage() {
  const locale = await getRequestLocale()
  const [itemsResult, ownershipMode, currentUser] = await Promise.all([
    getItems(),
    getOwnershipMode(),
    getCurrentUser(),
  ])
  const { data, error } = itemsResult

  if (error) {
    throw new Error(error.message)
  }

  const items: MediaItem[] = ((data ?? []) as MediaItemRecord[]).map(toMediaItem)
  const statusGroups = Object.entries(groupItems(items, (item) => item.status)).sort(
    (left, right) => right[1] - left[1]
  )
  const typeGroups = Object.entries(groupItems(items, (item) => item.type)).sort(
    (left, right) => right[1] - left[1]
  )
  const genreGroups = Object.entries(groupGenres(items))
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
  const topRated = getTopRatedItems(items).slice(0, 5)
  const recentItems = getRecentItems(items).slice(0, 5)

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-5 pb-24 sm:px-6 md:py-6 md:pb-6 lg:px-8">
      <header className="mb-8 mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mt-6">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.25em] text-slate-500">{t(locale, 'common.overview')}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-4xl">
            {t(locale, 'stats.title')}
          </h1>
        </div>
        {currentUser?.id ? (
          <div className="flex flex-wrap items-center gap-3">
            <CopyShareLinkButton userId={currentUser.id} />
            <CopyShareLinkButton
              userId={currentUser.id}
              pathPrefix="/public/"
              label="Copy My Public Link"
              copiedLabel="Public link copied"
            />
          </div>
        ) : null}
      </header>

      {ownershipMode === 'legacy' ? <SetupNotice /> : null}
      <StatsDashboard items={items} />

      <section className="mt-8 grid min-w-0 gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:gap-8">
        <div className="min-w-0 space-y-8">
          <Panel title={t(locale, 'stats.byStatus')}>
            <div className="space-y-4">
              {statusGroups.length > 0 ? (
                statusGroups.map(([label, count]) => (
                  <BarRow
                    key={label}
                    label={translateStatus(locale, label)}
                    count={count}
                    total={items.length}
                    colorClassName="bg-emerald-500"
                  />
                ))
              ) : (
                <EmptyPanel message={t(locale, 'stats.emptyStatus')} />
              )}
            </div>
          </Panel>

          <Panel title={t(locale, 'stats.byType')}>
            <div className="space-y-4">
              {typeGroups.length > 0 ? (
                typeGroups.map(([label, count]) => (
                  <BarRow
                    key={label}
                    label={translateType(locale, label)}
                    count={count}
                    total={items.length}
                    colorClassName="bg-blue-500"
                  />
                ))
              ) : (
                <EmptyPanel message={t(locale, 'stats.emptyType')} />
              )}
            </div>
          </Panel>

          <Panel title={t(locale, 'stats.topGenres')}>
            <div className="space-y-4">
              {genreGroups.length > 0 ? (
                genreGroups.map(([label, count]) => (
                  <BarRow
                    key={label}
                    label={label}
                    count={count}
                    total={items.length}
                    colorClassName="bg-fuchsia-500"
                  />
                ))
              ) : (
                <EmptyPanel message={t(locale, 'stats.emptyGenres')} />
              )}
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-8">
          <Panel title={t(locale, 'overview.topRated')}>
            {topRated.length > 0 ? (
              <div className="space-y-3">
                {topRated.map((item, index) => (
                  <RankedItem
                    key={item.id}
                    index={index + 1}
                    title={item.title}
                    subtitle={`${translateType(locale, item.type)} - ${translateStatus(locale, item.status)}`}
                    value={`${item.rating} / 10`}
                    href={`/items/${item.id}`}
                  />
                ))}
              </div>
            ) : (
              <EmptyPanel message={t(locale, 'stats.emptyTopRated')} />
            )}
          </Panel>

          <Panel title={t(locale, 'stats.recentlyAdded')}>
            {recentItems.length > 0 ? (
              <div className="space-y-3">
                {recentItems.map((item) => (
                  <RankedItem
                    key={item.id}
                    title={item.title}
                    subtitle={`${translateType(locale, item.type)} - ${translateStatus(locale, item.status)}`}
                    value={formatDateForLocale(locale, item.createdAt)}
                    href={`/items/${item.id}`}
                  />
                ))}
              </div>
            ) : (
              <EmptyPanel message={t(locale, 'stats.emptyRecent')} />
            )}
          </Panel>
        </div>
      </section>
    </main>
  )
}

function Panel({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <section className="glass-panel surface-highlight min-w-0 w-full overflow-hidden rounded-xl p-4 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">{title}</h2>
      <div className="mt-4 sm:mt-5">{children}</div>
    </section>
  )
}

function BarRow({
  colorClassName,
  count,
  label,
  total,
}: {
  colorClassName: string
  count: number
  label: string
  total: number
}) {
  const width = total > 0 ? `${Math.max((count / total) * 100, 6)}%` : '0%'

  return (
    <div className="w-full max-w-full space-y-2 overflow-hidden">
      <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-slate-200">{label}</span>
        <span className="shrink-0 text-slate-400">{count}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-xl bg-slate-950/80">
        <div className={`h-full rounded-xl ${colorClassName}`} style={{ width }} />
      </div>
    </div>
  )
}

function RankedItem({
  href,
  index,
  subtitle,
  title,
  value,
}: {
  href: string
  index?: number
  subtitle: string
  title: string
  value: string
}) {
  return (
    <Link
      href={href}
      className="glass-panel-soft flex items-center justify-between gap-4 rounded-xl px-4 py-3 transition hover:border-blue-400/30 hover:bg-white/10"
    >
      <div className="flex min-w-0 items-center gap-3">
        {index ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-sm font-semibold text-white">
            {index}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{title}</p>
          <p className="truncate text-sm text-slate-400">{subtitle}</p>
        </div>
      </div>
      <span className="shrink-0 text-sm text-slate-300">{value}</span>
    </Link>
  )
}

function EmptyPanel({ message }: { message: string }) {
  return <p className="text-sm text-slate-400">{message}</p>
}
