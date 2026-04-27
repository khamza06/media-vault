'use client'

import { CalendarClock, Tv2 } from 'lucide-react'

import type { UpcomingEpisode } from '../lib/home-signals'

export default function NextEpisodesRail({
  episodes,
}: {
  episodes: UpcomingEpisode[]
}) {
  const title = 'Next Episodes'
  const description = 'Upcoming airings for the anime you are currently watching.'
  const emptyMessage = 'Mark anime as Watching and upcoming episodes will appear here.'
  const episodeLabel = 'Ep.'

  return (
    <section className="glass-panel surface-highlight rounded-[28px] p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-200">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight text-white">{title}</p>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
      </div>

      {episodes.length > 0 ? (
        <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-1">
          {episodes.map((episode) => (
            <article
              key={`${episode.title}-${episode.episode}`}
              className="glass-panel-soft min-w-[240px] rounded-[24px] border border-white/10 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-slate-300">
                  <Tv2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{episode.title}</p>
                  <p className="text-sm text-slate-400">
                    {episodeLabel} {episode.episode}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-cyan-200">{episode.countdownLabel}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="glass-panel-soft flex min-h-[152px] flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-white/10 px-4 text-center">
          <CalendarClock className="h-7 w-7 text-slate-500" />
          <p className="max-w-md text-sm text-slate-400">{emptyMessage}</p>
        </div>
      )}
    </section>
  )
}
