'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Check, Plus } from 'lucide-react'

import { getGenreBadgeClass } from '../lib/genres'
import type { MediaItem } from '../lib/media'
import { formatProgressValue } from '../lib/media'
import AddToListButton, { type AddToListOption } from './lists/AddToListButton'

type ShelfItemCardProps = {
  accentHandler?: (imageUrl: string | null) => void
  isSelected?: boolean
  isSelectionMode?: boolean
  item: MediaItem
  listOptions?: AddToListOption[]
  onIncrement: (item: MediaItem) => void
  onToggleSelection?: (item: MediaItem) => void
  progressBusy: boolean
  returnTo?: string
}

export default function ShelfItemCard({
  accentHandler,
  isSelected = false,
  isSelectionMode = false,
  item,
  listOptions = [],
  onIncrement,
  onToggleSelection,
  progressBusy,
  returnTo,
}: ShelfItemCardProps) {
  const href = returnTo
    ? { pathname: `/items/${item.id}`, query: { returnTo } }
    : { pathname: `/items/${item.id}` }

  return (
    <article
      className="group min-w-[44vw] max-w-[44vw] sm:min-w-[188px] sm:max-w-[188px]"
      onMouseEnter={() => accentHandler?.(item.imageUrl)}
      onMouseLeave={() => accentHandler?.(null)}
      onTouchStart={() => accentHandler?.(item.imageUrl)}
    >
      <Link
        href={href}
        onClick={(event) => {
          if (!isSelectionMode) {
            return
          }

          event.preventDefault()
          onToggleSelection?.(item)
        }}
        role={isSelectionMode ? 'button' : undefined}
        aria-pressed={isSelectionMode ? isSelected : undefined}
        aria-label={
          isSelectionMode ? (isSelected ? `Deselect ${item.title}` : `Select ${item.title}`) : undefined
        }
        className="block"
      >
        <div
          className={`glass-panel-soft relative aspect-[2/3] overflow-hidden rounded-xl transition-all duration-300 group-hover:border-blue-400/30 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.22)] ${
            isSelected ? 'border-blue-400/70 shadow-[0_0_24px_rgba(59,130,246,0.35)]' : ''
          }`}
        >
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-90" />
          <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_28%)] opacity-0 transition duration-300 group-hover:opacity-100" />

          {isSelectionMode ? (
            <span
              className={`absolute left-2 top-2 z-30 inline-flex h-11 w-11 items-center justify-center rounded-xl border text-white shadow-lg transition ${
                isSelected ? 'border-blue-300 bg-blue-500' : 'border-slate-600 bg-slate-950/90'
              }`}
              aria-hidden="true"
            >
              {isSelected ? <Check className="h-5 w-5" /> : null}
            </span>
          ) : null}

          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 44vw, 188px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center text-slate-500">
              <span className="mb-2 text-xl">No Cover</span>
              <span className="text-xs">Add an image URL</span>
            </div>
          )}

          <div className="absolute bottom-2 left-2 z-20 flex gap-2">
            <span className="rounded-md bg-slate-700/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
              {item.status}
            </span>
          </div>
        </div>

        <h3
          className="mt-3 line-clamp-2 text-[15px] font-bold tracking-tight text-slate-50 transition-colors group-hover:text-blue-300"
          title={item.title}
        >
          {item.title}
        </h3>
        <p className="mt-1 text-sm text-slate-400">{renderMetaLine(item)}</p>
        {item.externalRatingLabel && typeof item.externalRatingValue === 'number' ? (
          <p className="mt-1 text-xs font-medium text-blue-200">
            {formatExternalRating(item.externalRatingLabel, item.externalRatingValue)}
          </p>
        ) : null}
      </Link>

      {item.genres.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.genres.slice(0, 2).map((genre) => (
            <span
              key={genre}
              className={`rounded-full border px-2 py-1 text-[10px] ${getGenreBadgeClass(genre)}`}
            >
              {genre}
            </span>
          ))}
          {item.genres.length > 2 ? (
            <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-400">
              +{item.genres.length - 2}
            </span>
          ) : null}
        </div>
      ) : null}

      {!isSelectionMode ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onIncrement(item)}
            disabled={progressBusy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            +1
          </button>
          <AddToListButton itemId={item.id} itemTitle={item.title} lists={listOptions} />
        </div>
      ) : null}
    </article>
  )
}

function renderMetaLine(item: MediaItem) {
  if (item.progress > 0 || item.totalProgress !== null) {
    return `${item.type} / ${formatProgressValue(item)}`
  }

  return item.type
}

function formatExternalRating(label: string, value: number) {
  if (label === 'AniList') {
    return `${label}: ${Math.round(value * 10)}%`
  }

  return `${label}: ${value.toFixed(1)}`
}



