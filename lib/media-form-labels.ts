import { t, type Locale } from './i18n'
import { formatProgressValue, getProgressMode, isMovieType, mediaTypes, type MediaItem } from './media'

const progressKeys = {
  chapter: ['form.currentChapter', 'form.totalChapters'],
  episode: ['form.currentEpisode', 'form.totalEpisodes'],
  page: ['form.currentPage', 'form.totalPages'],
} as const

export function getProgressFieldLabels(locale: Locale, type: string) {
  if (!mediaTypes.some((value) => value === type)) {
    return { current: t(locale, 'form.currentProgress'), total: t(locale, 'form.totalCount') }
  }
  const [current, total] = progressKeys[getProgressMode(type)]
  return { current: t(locale, current), total: t(locale, total) }
}

export function formatLocalizedProgress(locale: Locale, item: Pick<MediaItem, 'progress' | 'totalProgress' | 'type'>) {
  if (locale === 'en') return formatProgressValue(item)
  const unit = isMovieType(item.type) ? 'просм.' : { chapter: 'гл.', episode: 'эп.', page: 'стр.' }[getProgressMode(item.type)]
  if (item.totalProgress && item.totalProgress > 0) return `${unit} ${item.progress} / ${item.totalProgress}`
  return item.progress > 0 ? `${unit} ${item.progress}` : t(locale, 'card.notStarted')
}
