import type { MediaItem } from './media'

export function formatAverageRating(items: MediaItem[]) {
  const ratedItems = items.filter((item) => item.rating !== null)
  if (ratedItems.length === 0) {
    return 'N/A'
  }

  const total = ratedItems.reduce((sum, item) => sum + (item.rating ?? 0), 0)
  return (total / ratedItems.length).toFixed(1)
}

export function getCompletionRate(items: MediaItem[]) {
  if (items.length === 0) {
    return 0
  }

  const completedCount = items.filter((item) => item.status === 'Completed').length
  return Math.round((completedCount / items.length) * 100)
}

export function groupItems<T extends string>(
  items: MediaItem[],
  getKey: (item: MediaItem) => T
) {
  return items.reduce<Record<T, number>>((groups, item) => {
    const key = getKey(item)
    groups[key] = (groups[key] ?? 0) + 1
    return groups
  }, {} as Record<T, number>)
}

export function groupGenres(items: MediaItem[]) {
  return items.reduce<Record<string, number>>((groups, item) => {
    for (const genre of item.genres) {
      groups[genre] = (groups[genre] ?? 0) + 1
    }

    return groups
  }, {})
}

export function getInProgressItems(items: MediaItem[]) {
  return items
    .filter((item) => item.status === 'Watching' || item.status === 'Reading')
    .sort((left, right) => {
      if (right.progress !== left.progress) {
        return right.progress - left.progress
      }

      return (
        new Date(right.createdAt ?? 0).getTime() -
        new Date(left.createdAt ?? 0).getTime()
      )
    })
}

export function getRecentItems(items: MediaItem[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.createdAt ?? 0).getTime() -
      new Date(left.createdAt ?? 0).getTime()
  )
}

export function getTopRatedItems(items: MediaItem[]) {
  return [...items]
    .filter((item) => item.rating !== null)
    .sort((left, right) => {
      if ((right.rating ?? 0) !== (left.rating ?? 0)) {
        return (right.rating ?? 0) - (left.rating ?? 0)
      }

      return left.title.localeCompare(right.title)
    })
}

export function getFavoriteItems(items: MediaItem[]) {
  return [...items]
    .filter((item) => item.favorite)
    .sort((left, right) => {
      if ((right.rating ?? 0) !== (left.rating ?? 0)) {
        return (right.rating ?? 0) - (left.rating ?? 0)
      }

      return left.title.localeCompare(right.title)
    })
}

export function getPlanningItems(items: MediaItem[]) {
  return [...items]
    .filter((item) => item.status === 'Planning')
    .sort((left, right) => {
      if (Number(right.favorite) !== Number(left.favorite)) {
        return Number(right.favorite) - Number(left.favorite)
      }

      if ((right.rating ?? 0) !== (left.rating ?? 0)) {
        return (right.rating ?? 0) - (left.rating ?? 0)
      }

      return left.title.localeCompare(right.title)
    })
}

export function getCompletedItems(items: MediaItem[]) {
  return [...items]
    .filter((item) => item.status === 'Completed')
    .sort((left, right) => {
      const rightCompleted = new Date(right.completedAt ?? right.createdAt ?? 0).getTime()
      const leftCompleted = new Date(left.completedAt ?? left.createdAt ?? 0).getTime()
      return rightCompleted - leftCompleted
    })
}

export function getTopCompletedItems(items: MediaItem[]) {
  return getCompletedItems(items)
    .filter((item) => item.rating !== null)
    .sort((left, right) => {
      if ((right.rating ?? 0) !== (left.rating ?? 0)) {
        return (right.rating ?? 0) - (left.rating ?? 0)
      }

      return left.title.localeCompare(right.title)
    })
}
