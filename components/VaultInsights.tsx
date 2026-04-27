import type { Locale } from '../lib/i18n'
import type { MediaItem } from '../lib/media'

type VaultInsightsProps = {
  items: MediaItem[]
  locale: Locale
}

const mangaLikeTypes = new Set(['Manga', 'Manhwa', 'Manhua'])
const animeLikeTypes = new Set(['Anime'])

export default function VaultInsights({ items, locale }: VaultInsightsProps) {
  void locale
  const copy = getCopy()
  const totalItems = items.length
  const inProgressCount = items.filter(
    (item) => item.status === 'Watching' || item.status === 'Reading'
  ).length
  const completedCount = items.filter((item) => item.status === 'Completed').length
  const totalProgress = items.reduce((sum, item) => sum + item.progress, 0)
  const mangaCount = items.filter((item) => mangaLikeTypes.has(item.type)).length
  const animeCount = items.filter((item) => animeLikeTypes.has(item.type)).length
  const otherCount = Math.max(0, totalItems - mangaCount - animeCount)
  const mangaShare = totalItems > 0 ? Math.round((mangaCount / totalItems) * 100) : 0
  const animeShare = totalItems > 0 ? Math.round((animeCount / totalItems) * 100) : 0
  const otherShare = Math.max(0, 100 - mangaShare - animeShare)

  return (
    <section className="min-w-0 space-y-5">
      <div className="flex min-w-0 items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75">
            {copy.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{copy.title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">{copy.description}</p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard label={copy.totalCount} value={String(totalItems)} tone="blue" />
        <InsightCard label={copy.inProgress} value={String(inProgressCount)} tone="cyan" />
        <InsightCard label={copy.completed} value={String(completedCount)} tone="emerald" />
        <InsightCard label={copy.totalProgress} value={String(totalProgress)} tone="violet" />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
        <section className="glass-panel surface-highlight min-w-0 rounded-xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-white">{copy.mediaMix}</h3>
              <p className="mt-1 text-sm text-slate-400">{copy.mediaMixDescription}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {copy.ofLibrary.replace('{count}', String(totalItems))}
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
            <div className="flex h-4 w-full">
              <div
                className="bg-gradient-to-r from-blue-500 to-cyan-400"
                style={{ width: `${mangaShare}%` }}
              />
              <div
                className="bg-gradient-to-r from-cyan-500 to-violet-400"
                style={{ width: `${animeShare}%` }}
              />
              <div
                className="bg-gradient-to-r from-slate-700 to-slate-600"
                style={{ width: `${otherShare}%` }}
              />
            </div>
          </div>

          <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-3">
            <MixPill label={copy.mangaFamily} percentage={mangaShare} count={mangaCount} tone="blue" />
            <MixPill label={copy.anime} percentage={animeShare} count={animeCount} tone="cyan" />
            <MixPill label={copy.otherMedia} percentage={otherShare} count={otherCount} tone="slate" />
          </div>
        </section>

        <section className="glass-panel surface-highlight min-w-0 rounded-xl p-5">
          <h3 className="text-lg font-semibold tracking-tight text-white">{copy.progressOverview}</h3>
          <div className="mt-4 space-y-3">
            <ProgressMetric label={copy.totalProgress} value={String(totalProgress)} />
            <ProgressMetric
              label={copy.averagePerTitle}
              value={totalItems > 0 ? (totalProgress / totalItems).toFixed(1) : '0'}
            />
            <ProgressMetric
              label={copy.completionRatio}
              value={totalItems > 0 ? `${Math.round((completedCount / totalItems) * 100)}%` : '0%'}
            />
          </div>
        </section>
      </div>
    </section>
  )
}

function InsightCard({
  label,
  tone,
  value,
}: {
  label: string
  tone: 'blue' | 'cyan' | 'emerald' | 'violet'
  value: string
}) {
  const toneClasses = {
    blue: 'from-blue-400/18 to-transparent',
    cyan: 'from-cyan-400/18 to-transparent',
    emerald: 'from-emerald-400/18 to-transparent',
    violet: 'from-violet-400/18 to-transparent',
  }[tone]

  return (
    <article className={`glass-panel surface-highlight min-w-0 rounded-xl bg-gradient-to-br ${toneClasses} px-5 py-5`}>
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
    </article>
  )
}

function MixPill({
  count,
  label,
  percentage,
  tone,
}: {
  count: number
  label: string
  percentage: number
  tone: 'blue' | 'cyan' | 'slate'
}) {
  const toneClasses = {
    blue: 'border-blue-400/20 bg-blue-500/10 text-blue-100',
    cyan: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100',
    slate: 'border-white/10 bg-white/5 text-slate-200',
  }[tone]

  return (
    <div className={`min-w-0 rounded-xl border px-4 py-4 ${toneClasses}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-current/75">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-bold tracking-tight text-white">{percentage}%</p>
        <p className="text-sm text-current/80">{count}</p>
      </div>
    </div>
  )
}

function ProgressMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/45 px-4 py-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  )
}

function getCopy() {
  return {
    eyebrow: 'Summary',
    title: 'Vault Summary',
    description:
      'A focused BI layer for your library: core counts, current momentum, media mix, and total tracked progress.',
    totalCount: 'Total Count',
    inProgress: 'In Progress',
    completed: 'Completed',
    totalProgress: 'Total Progress',
    mediaMix: 'Media Mix',
    mediaMixDescription: 'A quick split of the dominant media families in your database.',
    ofLibrary: '{count} in library',
    mangaFamily: 'Manga Family',
    anime: 'Anime',
    otherMedia: 'Other Media',
    progressOverview: 'Progress Overview',
    averagePerTitle: 'Average progress per title',
    completionRatio: 'Completion ratio',
  }
}
