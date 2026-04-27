'use client'

import { useMemo, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { MediaItem } from '../../lib/media'

type StatsDashboardProps = {
  items: readonly MediaItem[]
}

type CountDatum = {
  count: number
  name: string
}

type MonthDatum = {
  count: number
  month: string
}

const chartPalette = ['#3b82f6', '#8b5cf6', '#14b8a6', '#6366f1', '#f97316', '#ec4899']
const inProgressStatuses = new Set(['Watching', 'Reading', 'Re-Watching'])

export default function StatsDashboard({ items }: StatsDashboardProps) {
  const analytics = useMemo(() => buildAnalytics(items), [items])

  return (
    <section className="mt-8 min-w-0 space-y-8 pb-8">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Total items" value={analytics.totalItems.toString()} />
        <MetricCard label="Completed" value={analytics.completedItems.toString()} />
        <MetricCard label="In progress" value={analytics.inProgressItems.toString()} />
        <MetricCard label="Planned" value={analytics.plannedItems.toString()} />
        <MetricCard label="Average rating" value={analytics.averageRatingLabel} />
        <MetricCard label="No cover" value={analytics.itemsWithoutCovers.toString()} />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ChartCard title="Rating Distribution">
          {analytics.hasRatedItems ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={analytics.ratingDistribution}
                margin={{ top: 12, right: 12, left: -18, bottom: 0 }}
              >
                <XAxis
                  dataKey="rating"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#cbd5e1', fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(59,130,246,0.12)' }}
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(value) => formatCountTooltip(value)}
                  labelFormatter={(label) => `Rating ${label}`}
                />
                <Bar dataKey="count" fill="#3b82f6" maxBarSize={34} radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="No rated items yet. Add ratings to see your distribution." />
          )}
        </ChartCard>

        <DonutChartCard
          data={analytics.mediaTypeBreakdown}
          emptyMessage="No media items yet. Add items to see your library breakdown."
          title="Media Type Breakdown"
        />

        <DonutChartCard
          data={analytics.statusBreakdown}
          emptyMessage="No status data available yet."
          title="Status Breakdown"
        />

        <ChartCard title="Top Genres">
          {analytics.topGenres.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={analytics.topGenres}
                layout="vertical"
                margin={{ top: 8, right: 18, left: 8, bottom: 8 }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={112}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#cbd5e1', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(139,92,246,0.1)' }}
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(value) => formatCountTooltip(value)}
                />
                <Bar dataKey="count" fill="#8b5cf6" maxBarSize={18} radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="No genre data available yet." />
          )}
        </ChartCard>

        <ChartCard title="Monthly Additions">
          {analytics.hasCreatedAtData ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={analytics.monthlyAdditions}
                margin={{ top: 12, right: 12, left: -18, bottom: 0 }}
              >
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#cbd5e1', fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(20,184,166,0.1)' }}
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(value) => formatCountTooltip(value)}
                  labelFormatter={(label) => `${label}`}
                />
                <Bar dataKey="count" fill="#14b8a6" maxBarSize={34} radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="No created date data available yet." />
          )}
        </ChartCard>

        <InsightsCard insights={analytics.insights} />
      </div>
    </section>
  )
}

function buildAnalytics(items: readonly MediaItem[]) {
  const totalItems = items.length
  const completedItems = items.filter((item) => item.status === 'Completed').length
  const inProgressItems = items.filter((item) => inProgressStatuses.has(item.status)).length
  const plannedItems = items.filter((item) => item.status === 'Planning').length
  const itemsWithoutCovers = items.filter((item) => !item.imageUrl?.trim()).length
  const ratings = items
    .map((item) => getValidRating(item.rating))
    .filter((rating): rating is number => rating !== null)
  const averageRating =
    ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null

  const ratingDistribution = Array.from({ length: 10 }, (_, index) => {
    const rating = index + 1

    return {
      count: ratings.filter((candidate) => candidate === rating).length,
      rating: String(rating),
    }
  })

  const mediaTypeBreakdown = toSortedCountData(
    items.reduce((counts, item) => {
      const label = getMediaTypeLabel(item.type)
      counts.set(label, (counts.get(label) ?? 0) + 1)
      return counts
    }, new Map<string, number>())
  )

  const statusBreakdown = toSortedCountData(
    items.reduce((counts, item) => {
      const label = getStatusLabel(item.status)
      counts.set(label, (counts.get(label) ?? 0) + 1)
      return counts
    }, new Map<string, number>())
  )

  const topGenres = toSortedCountData(
    items.reduce((counts, item) => {
      for (const genre of item.genres) {
        const label = genre.trim()

        if (label) {
          counts.set(label, (counts.get(label) ?? 0) + 1)
        }
      }

      return counts
    }, new Map<string, number>())
  ).slice(0, 8)

  const monthlyAdditions = getMonthlyAdditions(items)
  const hasCreatedAtData = items.some((item) => isValidDate(item.createdAt))
  const insights = buildInsights({
    averageRating,
    completedItems,
    inProgressItems,
    itemsWithoutCovers,
    mediaTypeBreakdown,
    plannedItems,
    statusBreakdown,
    totalItems,
  })

  return {
    averageRatingLabel: averageRating === null ? 'N/A' : `${averageRating.toFixed(1)} / 10`,
    completedItems,
    hasCreatedAtData,
    hasRatedItems: ratings.length > 0,
    inProgressItems,
    insights,
    itemsWithoutCovers,
    mediaTypeBreakdown,
    monthlyAdditions,
    plannedItems,
    ratingDistribution,
    statusBreakdown,
    topGenres,
    totalItems,
  }
}

function DonutChartCard({
  data,
  emptyMessage,
  title,
}: {
  data: CountDatum[]
  emptyMessage: string
  title: string
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <ChartCard title={title}>
      {data.length > 0 ? (
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-center">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Tooltip
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(value, name) => {
                  const count = toCount(value)
                  return [`${count} item${count === 1 ? '' : 's'}`, String(name)]
                }}
              />
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                innerRadius={72}
                outerRadius={112}
                paddingAngle={4}
                stroke="#0f172a"
                strokeWidth={2}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="min-w-0 space-y-2">
            {data.map((entry, index) => {
              const percentage = total > 0 ? Math.round((entry.count / total) * 100) : 0

              return (
                <div
                  key={entry.name}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-xl"
                      style={{ backgroundColor: chartPalette[index % chartPalette.length] }}
                    />
                    <span className="min-w-0 truncate text-sm text-slate-200">{entry.name}</span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-white">
                    {entry.count} ({percentage}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <EmptyChartMessage message={emptyMessage} />
      )}
    </ChartCard>
  )
}

function InsightsCard({ insights }: { insights: string[] }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-lg font-bold text-white">Personal Insights</h2>
      <div className="mt-4 space-y-3">
        {insights.length > 0 ? (
          insights.map((insight) => (
            <div
              key={insight}
              className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-200"
            >
              {insight}
            </div>
          ))
        ) : (
          <EmptyChartMessage message="Add a few items to unlock personal insights." />
        )}
      </div>
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">{value}</p>
    </article>
  )
}

function ChartCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  )
}

function EmptyChartMessage({ message }: { message: string }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950 px-6 text-center text-sm text-slate-400">
      {message}
    </div>
  )
}

function buildInsights({
  averageRating,
  completedItems,
  inProgressItems,
  itemsWithoutCovers,
  mediaTypeBreakdown,
  plannedItems,
  statusBreakdown,
  totalItems,
}: {
  averageRating: number | null
  completedItems: number
  inProgressItems: number
  itemsWithoutCovers: number
  mediaTypeBreakdown: CountDatum[]
  plannedItems: number
  statusBreakdown: CountDatum[]
  totalItems: number
}) {
  if (totalItems === 0) {
    return []
  }

  const insights: string[] = []
  const topType = mediaTypeBreakdown[0]
  const topStatus = statusBreakdown[0]

  if (topType) {
    insights.push(`Your most common media type is ${topType.name}.`)
  }

  if (plannedItems > 0) {
    insights.push(`You have ${plannedItems} planned item${plannedItems === 1 ? '' : 's'} waiting.`)
  }

  if (inProgressItems > 0) {
    insights.push(`You are actively tracking ${inProgressItems} item${inProgressItems === 1 ? '' : 's'}.`)
  }

  if (averageRating !== null) {
    insights.push(`Your average personal rating is ${averageRating.toFixed(1)}/10.`)
  }

  if (itemsWithoutCovers > 0) {
    insights.push(`You have ${itemsWithoutCovers} item${itemsWithoutCovers === 1 ? '' : 's'} without covers.`)
  }

  if (topStatus) {
    insights.push(`Your most common status is ${topStatus.name}.`)
  }

  if (completedItems > 0) {
    insights.push(`Your completed universe has ${completedItems} finished item${completedItems === 1 ? '' : 's'}.`)
  }

  return insights.slice(0, 6)
}

function getMonthlyAdditions(items: readonly MediaItem[]) {
  const now = new Date()
  const months: MonthDatum[] = []

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    months.push({
      count: 0,
      month: formatMonthLabel(date),
    })
  }

  const indexByMonth = new Map(months.map((item, index) => [item.month, index]))

  for (const item of items) {
    const createdAt = item.createdAt

    if (!isValidDate(createdAt)) {
      continue
    }

    const label = formatMonthLabel(new Date(createdAt))
    const index = indexByMonth.get(label)

    if (typeof index === 'number') {
      months[index] = {
        ...months[index],
        count: months[index].count + 1,
      }
    }
  }

  return months
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
  })
}

function getValidRating(rating: number | null | undefined) {
  if (typeof rating !== 'number' || !Number.isInteger(rating)) {
    return null
  }

  return rating >= 1 && rating <= 10 ? rating : null
}

function getMediaTypeLabel(type: string | null | undefined) {
  const normalized = type?.trim().toLowerCase().replace(/[\s-]+/g, '_')

  switch (normalized) {
    case 'anime':
      return 'Anime'
    case 'manga':
    case 'manhwa':
    case 'manhua':
      return 'Manga'
    case 'movie':
    case 'movies':
      return 'Movie'
    case 'tv':
    case 'tv_series':
    case 'series':
    case 'television':
      return 'Series'
    case 'book':
    case 'books':
      return 'Book'
    default:
      return 'Other'
  }
}

function getStatusLabel(status: string | null | undefined) {
  const normalized = status?.trim()

  switch (normalized) {
    case 'Planning':
    case 'Watching':
    case 'Reading':
    case 'Completed':
    case 'Dropped':
    case 'Re-Watching':
      return normalized
    case 'On Hold':
    case 'On-Hold':
    case 'on_hold':
      return 'On Hold'
    default:
      return normalized || 'Other'
  }
}

function toSortedCountData(counts: Map<string, number>): CountDatum[] {
  return [...counts.entries()]
    .map(([name, count]) => ({ count, name }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
}

function isValidDate(value: string | null | undefined): value is string {
  return Boolean(value) && !Number.isNaN(new Date(value as string).getTime())
}

function formatCountTooltip(value: unknown) {
  const count = toCount(value)
  return [`${count} item${count === 1 ? '' : 's'}`, 'Count']
}

function toCount(value: unknown) {
  if (Array.isArray(value)) {
    return toCount(value[0] ?? 0)
  }

  const count = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(count) ? count : 0
}

const tooltipContentStyle = {
  background: '#020617',
  border: '1px solid #1e293b',
  borderRadius: '12px',
  color: '#f8fafc',
} as const

const tooltipItemStyle = {
  color: '#f8fafc',
} as const

const tooltipLabelStyle = {
  color: '#cbd5e1',
} as const
