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

const chartPalette = ['#3b82f6', '#8b5cf6', '#14b8a6', '#6366f1', '#f97316']
const mediaTypeOrder = ['Anime', 'Manga', 'Manhwa', 'Manhua', 'Movie', 'TV Series', 'Book', 'Other']

type ChartsDashboardProps = {
  items: readonly ChartsDashboardItem[]
}

type ChartsDashboardItem = {
  media_type?: string | null
  rating?: number | null
  type?: string | null
}

type RatingDistributionDatum = {
  count: number
  rating: string
}

type MediaTypeDatum = {
  name: string
  value: number
}

export default function ChartsDashboard({ items }: ChartsDashboardProps) {
  const ratingDistribution = useMemo<RatingDistributionDatum[]>(() => {
    const counts = new Map<number, number>()

    for (const item of items) {
      const rating = getValidRating(item.rating)

      if (rating !== null) {
        counts.set(rating, (counts.get(rating) ?? 0) + 1)
      }
    }

    return Array.from({ length: 10 }, (_, index) => {
      const rating = index + 1

      return {
        count: counts.get(rating) ?? 0,
        rating: String(rating),
      }
    })
  }, [items])

  const mediaTypeBreakdown = useMemo<MediaTypeDatum[]>(() => {
    const counts = new Map<string, number>()

    for (const item of items) {
      const label = getMediaTypeLabel(item.type ?? item.media_type)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }

    return mediaTypeOrder
      .map((name) => ({ name, value: counts.get(name) ?? 0 }))
      .filter((item) => item.value > 0)
  }, [items])

  const totalTypeItems = mediaTypeBreakdown.reduce((sum, item) => sum + item.value, 0)
  const hasRatedItems = ratingDistribution.some((item) => item.count > 0)
  const hasMediaTypes = mediaTypeBreakdown.length > 0

  return (
    <section className="mt-8 pb-8">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Visual Analytics</p>
        <h2 className="mt-2 text-xl font-bold text-white">Charts Dashboard</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Rating Distribution">
          {hasRatedItems ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ratingDistribution} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
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
                  cursor={{ fill: 'rgba(59,130,246,0.1)' }}
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(value) => {
                    const count = toCount(value)
                    return [`${count} item${count === 1 ? '' : 's'}`, 'Count']
                  }}
                  labelFormatter={(label) => `Rating ${label}`}
                />
                <Bar dataKey="count" fill="#3b82f6" maxBarSize={34} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="No rated items yet. Add ratings to see your distribution." />
          )}
        </ChartCard>

        <ChartCard title="Media Type Breakdown">
          {hasMediaTypes ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-center">
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
                    data={mediaTypeBreakdown}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={72}
                    outerRadius={112}
                    paddingAngle={4}
                    stroke="#0f172a"
                    strokeWidth={2}
                  >
                    {mediaTypeBreakdown.map((entry, index) => (
                      <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-2">
                {mediaTypeBreakdown.map((entry, index) => {
                  const percentage =
                    totalTypeItems > 0 ? Math.round((entry.value / totalTypeItems) * 100) : 0

                  return (
                    <div
                      key={entry.name}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: chartPalette[index % chartPalette.length] }}
                        />
                        <span className="min-w-0 truncate text-sm text-slate-200">{entry.name}</span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-white">
                        {entry.value} ({percentage}%)
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <EmptyChartMessage message="No media items yet. Add items to see your library breakdown." />
          )}
        </ChartCard>
      </div>
    </section>
  )
}

function ChartCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
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
      return 'Manga'
    case 'manhwa':
      return 'Manhwa'
    case 'manhua':
      return 'Manhua'
    case 'movie':
    case 'movies':
      return 'Movie'
    case 'tv':
    case 'tv_series':
    case 'series':
    case 'television':
      return 'TV Series'
    case 'book':
    case 'books':
      return 'Book'
    default:
      return 'Other'
  }
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
