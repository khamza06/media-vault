'use client'

import Image from 'next/image'
import { Compass, Sparkles } from 'lucide-react'

import type { DiscoverRecommendation } from '../lib/home-signals'

export default function DiscoverRail({
  recommendations,
}: {
  recommendations: DiscoverRecommendation[]
}) {
  const title = 'Discover'
  const description = 'Recommendations powered by the titles you rated highest.'
  const emptyMessage =
    'Rate a few titles 9-10 and this rail will start suggesting what to watch or read next.'

  return (
    <section className="glass-panel surface-highlight rounded-[28px] p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200">
          <Compass className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight text-white">{title}</p>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
      </div>

      {recommendations.length > 0 ? (
        <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-1">
          {recommendations.map((recommendation) => (
            <article
              key={`${recommendation.provider}-${recommendation.title}`}
              className="group min-w-[180px]"
            >
              <div className="glass-panel-soft relative aspect-[2/3] overflow-hidden rounded-[24px] border border-white/10">
                {recommendation.imageUrl ? (
                  <Image
                    src={recommendation.imageUrl}
                    alt={recommendation.title}
                    fill
                    sizes="180px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-slate-950/60 text-slate-500">
                    <Sparkles className="h-6 w-6" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-3">
                  <p className="truncate text-sm font-semibold text-white">{recommendation.title}</p>
                  <p className="text-xs text-slate-300">{recommendation.subtitle}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="glass-panel-soft flex min-h-[152px] flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-white/10 px-4 text-center">
          <Compass className="h-7 w-7 text-slate-500" />
          <p className="max-w-md text-sm text-slate-400">{emptyMessage}</p>
        </div>
      )}
    </section>
  )
}
