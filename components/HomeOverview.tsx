import Link from 'next/link'

import type { Locale } from '../lib/i18n'
import { formatDateForLocale, t, translateStatus, translateType } from '../lib/i18n'
import { formatProgressValue, type MediaItem } from '../lib/media'
import {
  formatAverageRating,
  getCompletionRate,
  getFavoriteItems,
  getInProgressItems,
  getRecentItems,
  getTopRatedItems,
} from '../lib/stats'

type HomeOverviewProps = {
  items: MediaItem[]
  locale: Locale
}

export default function HomeOverview({ items, locale }: HomeOverviewProps) {
  const allInProgressItems = getInProgressItems(items)
  const inProgressItems = allInProgressItems.slice(0, 4)
  const favoriteItems = getFavoriteItems(items).slice(0, 4)
  const recentItems = getRecentItems(items).slice(0, 4)
  const topRatedItems = getTopRatedItems(items).slice(0, 4)

  return (
    <section className="mb-10 space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <OverviewCard label={t(locale, 'overview.total')} value={String(items.length)} tone="blue" />
        <OverviewCard
          label={t(locale, 'overview.inProgress')}
          value={String(allInProgressItems.length)}
          tone="cyan"
        />
        <OverviewCard
          label={t(locale, 'overview.favorites')}
          value={String(items.filter((item) => item.favorite).length)}
          tone="amber"
        />
        <OverviewCard label={t(locale, 'overview.averageRating')} value={formatAverageRating(items)} tone="violet" />
        <OverviewCard label={t(locale, 'overview.completionRate')} value={`${getCompletionRate(items)}%`} tone="emerald" />
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        <Panel title={t(locale, 'overview.continue')} tone="cyan">
          {inProgressItems.length > 0 ? (
            inProgressItems.map((item) => (
              <ListRow
                key={item.id}
                href={`/items/${item.id}`}
                title={item.title}
                subtitle={`${translateType(locale, item.type)} - ${translateStatus(locale, item.status)}`}
                meta={formatProgressValue(item)}
              />
            ))
          ) : (
            <EmptyState message={t(locale, 'overview.emptyContinue')} />
          )}
        </Panel>

        <Panel title={t(locale, 'overview.topRated')} tone="violet">
          {topRatedItems.length > 0 ? (
            topRatedItems.map((item) => (
              <ListRow
                key={item.id}
                href={`/items/${item.id}`}
                title={item.title}
                subtitle={`${translateType(locale, item.type)} - ${translateStatus(locale, item.status)}`}
                meta={`${item.rating} / 10`}
              />
            ))
          ) : (
            <EmptyState message={t(locale, 'overview.emptyTopRated')} />
          )}
        </Panel>

        <Panel title={t(locale, 'overview.favorites')} tone="amber">
          {favoriteItems.length > 0 ? (
            favoriteItems.map((item) => (
              <ListRow
                key={item.id}
                href={`/items/${item.id}`}
                title={item.title}
                subtitle={`${translateType(locale, item.type)} - ${translateStatus(locale, item.status)}`}
                meta={item.rating ? `${item.rating} / 10` : t(locale, 'overview.saved')}
              />
            ))
          ) : (
            <EmptyState message={t(locale, 'overview.emptyFavorites')} />
          )}
        </Panel>

        <Panel title={t(locale, 'overview.recentlyAdded')} tone="blue">
          {recentItems.length > 0 ? (
            recentItems.map((item) => (
              <ListRow
                key={item.id}
                href={`/items/${item.id}`}
                title={item.title}
                subtitle={`${translateType(locale, item.type)} - ${translateStatus(locale, item.status)}`}
                meta={formatDateForLocale(locale, item.createdAt)}
              />
            ))
          ) : (
            <EmptyState message={t(locale, 'overview.emptyRecent')} />
          )}
        </Panel>
      </div>
    </section>
  )
}

function OverviewCard({
  label,
  tone,
  value,
}: {
  label: string
  tone: 'amber' | 'blue' | 'cyan' | 'emerald' | 'violet'
  value: string
}) {
  const toneClasses = {
    amber: 'from-amber-400/20 to-transparent text-amber-100',
    blue: 'from-blue-400/20 to-transparent text-blue-100',
    cyan: 'from-cyan-400/20 to-transparent text-cyan-100',
    emerald: 'from-emerald-400/20 to-transparent text-emerald-100',
    violet: 'from-violet-400/20 to-transparent text-violet-100',
  }[tone]

  return (
    <div className={`glass-panel surface-highlight overflow-hidden rounded-[28px] bg-gradient-to-br ${toneClasses} px-5 py-5`}>
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
    </div>
  )
}

function Panel({
  children,
  tone,
  title,
}: {
  children: React.ReactNode
  tone: 'amber' | 'blue' | 'cyan' | 'violet'
  title: string
}) {
  const toneClasses = {
    amber: 'shadow-[0_0_20px_rgba(251,191,36,0.12)]',
    blue: 'shadow-[0_0_20px_rgba(59,130,246,0.12)]',
    cyan: 'shadow-[0_0_20px_rgba(34,211,238,0.12)]',
    violet: 'shadow-[0_0_20px_rgba(139,92,246,0.12)]',
  }[tone]

  return (
    <section className={`glass-panel surface-highlight rounded-[28px] p-5 ${toneClasses}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function ListRow({
  href,
  meta,
  subtitle,
  title,
}: {
  href: string
  meta: string
  subtitle: string
  title: string
}) {
  return (
    <Link
      href={href}
      className="glass-panel-soft flex items-center justify-between gap-4 rounded-[22px] px-4 py-3 transition hover:border-blue-400/30 hover:bg-white/10"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-white">{title}</p>
        <p className="truncate text-sm text-slate-400">{subtitle}</p>
      </div>
      <span className="shrink-0 text-sm text-slate-300">{meta}</span>
    </Link>
  )
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-slate-400">{message}</p>
}
