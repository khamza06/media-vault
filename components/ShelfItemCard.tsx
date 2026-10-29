'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Check, LoaderCircle, Plus } from 'lucide-react'

import { getGenreBadgeClass } from '../lib/genres'
import type { MediaItem } from '../lib/media'
import { formatExternalRatingValue } from '../lib/media'
import { getProgressMode, isMovieType } from '../lib/media'
import { canAdvanceProgress } from '../lib/progress'
import { translateStatus, translateType, type Locale } from '../lib/i18n'
import { formatLocalizedProgress } from '../lib/media-form-labels'
import { useLocale } from './LocaleProvider'
import AddToListButton, { type AddToListOption } from './lists/AddToListButton'
import CoverPlaceholder from './CoverPlaceholder'

type ShelfItemCardProps = {
  accentHandler?: (imageUrl: string | null) => void
  isSelected?: boolean
  isSelectionMode?: boolean
  item: MediaItem
  layout?: 'grid' | 'rail' | 'row'
  density?: 'comfortable' | 'compact'
  listOptions?: AddToListOption[]
  onIncrement: (item: MediaItem) => void
  onToggleSelection?: (item: MediaItem) => void
  progressBusy: boolean
  progressError?: boolean
  returnTo?: string
}

export default function ShelfItemCard({
  accentHandler,
  isSelected = false,
  isSelectionMode = false,
  item,
  layout = 'grid',
  density = 'comfortable',
  listOptions = [],
  onIncrement,
  onToggleSelection,
  progressBusy,
  progressError = false,
  returnTo,
}: ShelfItemCardProps) {
  const { locale, t } = useLocale()
  const selectionLabel = t(isSelected ? 'card.deselect' : 'card.select', { title: item.title })
  const placeholder = <CoverPlaceholder title={item.title} type={item.type} typeLabel={translateType(locale, item.type)} ariaLabel={t('card.coverPlaceholder', { title: item.title })} />
  const href = returnTo
    ? { pathname: `/items/${item.id}`, query: { returnTo } }
    : { pathname: `/items/${item.id}` }

  const actions = !isSelectionMode ? (
    <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
      <button
        type="button"
        aria-label={t('card.increase', { title: item.title })}
        onClick={() => onIncrement(item)}
        disabled={progressBusy || !canAdvanceProgress(item)}
        aria-busy={progressBusy}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {progressBusy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" /> : !canAdvanceProgress(item) ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />}
        {progressBusy ? t('progress.saving') : !canAdvanceProgress(item) ? t('progress.atTotal') : progressError ? t('progress.retry') : isMovieType(item.type) ? t('progress.watched') : `+1 ${t(`progress.${getProgressMode(item.type)}`)}`}
      </button>
      <AddToListButton itemId={item.id} itemTitle={item.title} lists={listOptions} compact buttonLabel={t('card.list')} buttonAriaLabel={t('card.addToList', { title: item.title })} />
      {progressError && <p role="alert" className="col-span-2 text-xs leading-5 text-amber-200">{t('progress.retryHint')}</p>}
    </div>
  ) : null

  if (layout === 'row') {
    return (
      <article className={`grid min-w-0 gap-x-4 gap-y-1 rounded-xl border bg-slate-900/80 p-3 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-center ${isSelected ? 'border-blue-400/70' : 'border-slate-800'}`}>
        <Link href={href} role={isSelectionMode ? 'button' : undefined}
          aria-pressed={isSelectionMode ? isSelected : undefined}
          aria-label={isSelectionMode ? selectionLabel : undefined}
          onClick={(event) => {
            if (isSelectionMode) { event.preventDefault(); onToggleSelection?.(item) }
          }}
          className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">
          <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-xl bg-slate-950">
            {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />
              : placeholder}
            {isSelectionMode ? <span className="absolute inset-0 flex items-center justify-center bg-slate-950/65">
              {isSelected ? <Check aria-hidden="true" className="h-6 w-6 text-blue-200" /> : null}
            </span> : null}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="line-clamp-2 text-sm font-bold text-slate-100">{item.title}</h3>
            <p className="text-xs text-slate-400">{translateType(locale, item.type)} / {translateStatus(locale, item.status)}</p>
            <p className="text-xs text-slate-300">{formatLocalizedProgress(locale, item)}{item.rating ? ` / ${t('card.personalRating', { rating: item.rating })}` : ''}</p>
            <ItemProgressBar item={item} />
          </div>
        </Link>
        {actions}
      </article>
    )
  }

  return (
    <article
      className={`group flex min-w-0 shrink-0 flex-col ${layout === 'rail' ? density === 'compact' ? 'w-36 sm:w-40' : 'w-[10.5rem] sm:w-[11.5rem]' : 'w-full'}`}
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
          isSelectionMode ? selectionLabel : undefined
        }
        className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
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
              sizes="(max-width: 640px) 50vw, 188px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            placeholder
          )}

          <div className="absolute bottom-2 left-2 z-20 flex gap-2">
            <span className="rounded-xl bg-slate-900/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
              {translateStatus(locale, item.status)}
            </span>
          </div>
        </div>

        <h3
          className="mt-3 line-clamp-2 min-h-11 text-sm font-bold leading-[1.4] tracking-tight text-slate-50 transition-colors group-hover:text-blue-300"
          title={item.title}
        >
          {item.title}
        </h3>
        <p className="mt-1 text-sm text-slate-400">{renderMetaLine(item, locale)}</p>
        <ItemProgressBar item={item} />
        {item.externalRatingLabel && typeof item.externalRatingValue === 'number' ? (
          <p className="mt-1 text-xs font-medium text-blue-200">
            {formatExternalRating(item.externalRatingLabel, item.externalRatingValue)}
          </p>
        ) : null}
      </Link>

      {density !== 'compact' && item.genres.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.genres.slice(0, 2).map((genre) => (
            <span
              key={genre}
              className={`rounded-xl border px-2 py-1 text-[10px] ${getGenreBadgeClass(genre)}`}
            >
              {genre}
            </span>
          ))}
          {item.genres.length > 2 ? (
            <span className="rounded-xl border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-400">
              +{item.genres.length - 2}
            </span>
          ) : null}
        </div>
      ) : null}

      {actions}
    </article>
  )
}

function ItemProgressBar({ item }: { item: MediaItem }) {
  const { t } = useLocale()
  if (item.totalProgress === null || !Number.isFinite(item.totalProgress) || item.totalProgress <= 0) return null
  const progress = Math.max(0, Math.min(Number.isFinite(item.progress) ? item.progress : 0, item.totalProgress))
  return (
    <div role="progressbar" aria-label={t('card.progress', { title: item.title })} aria-valuemin={0}
      aria-valuemax={item.totalProgress} aria-valuenow={progress}
      className="mt-2 h-1 overflow-hidden rounded-xl bg-slate-800">
      <div className="h-full rounded-xl bg-blue-400/80" style={{ width: `${progress / item.totalProgress * 100}%` }} />
    </div>
  )
}

function renderMetaLine(item: MediaItem, locale: Locale) {
  if (item.progress > 0 || item.totalProgress !== null) {
    return `${translateType(locale, item.type)} / ${formatLocalizedProgress(locale, item)}`
  }

  return translateType(locale, item.type)
}

function formatExternalRating(label: string, value: number) {
  return formatExternalRatingValue(label, value)
}



