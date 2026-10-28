import { t, type Locale } from './i18n'
import { getProgressMode, mediaTypes } from './media'

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
