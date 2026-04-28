import Image from 'next/image'
import { Star } from 'lucide-react'

import EmptyVaultState from './EmptyVaultState'
import { getGenreBadgeClass, translateGenre } from '../lib/genres'
import { formatProgressValue, type MediaItem } from '../lib/media'
import { mediaCardGridClassName } from '../lib/media-card-grid'

type PublicLibraryGridProps = {
  emptyMessage?: string
  items: MediaItem[]
}

export default function PublicLibraryGrid({
  emptyMessage = 'This public vault is empty right now.',
  items,
}: PublicLibraryGridProps) {
  if (items.length === 0) {
    return <EmptyVaultState message={emptyMessage} />
  }

  return (
    <div className={mediaCardGridClassName}>
      {items.map((item) => (
        <article key={item.id} className="group min-w-0">
          <div className="glass-panel-soft relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 transition-all duration-300 group-hover:border-blue-400/30 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.title}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 16vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
                No Cover
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-xl border border-white/10 bg-slate-900/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-100">
                  {item.status}
                </span>
                <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">
                  {item.type}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <h2 className="line-clamp-2 text-sm font-semibold text-white" title={item.title}>
              {item.title}
            </h2>
            <p className="text-xs text-slate-400">{formatProgressValue(item)}</p>

            <div className="flex flex-wrap items-center gap-2">
              {item.rating ? (
                <span className="rounded-xl border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-100">
                  My {item.rating}/10
                </span>
              ) : null}

              {item.externalRatingLabel && typeof item.externalRatingValue === 'number' ? (
                <span className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-200">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  {formatExternalRating(item.externalRatingLabel, item.externalRatingValue)}
                </span>
              ) : null}
            </div>

            {item.genres.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {item.genres.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className={`rounded-xl border px-2 py-1 text-[10px] ${getGenreBadgeClass(genre)}`}
                  >
                    {translateGenre(genre, 'en')}
                  </span>
                ))}
                {item.genres.length > 3 ? (
                  <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300">
                    +{item.genres.length - 3}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  )
}

function formatExternalRating(label: string, value: number) {
  if (label === 'AniList') {
    return `${label}: ${Math.round(value * 10)}%`
  }

  return `${label}: ${value.toFixed(1)}`
}
