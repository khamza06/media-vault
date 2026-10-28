export const mediaCardGridClassName =
  'grid min-w-0 grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'

export function getMediaCardGridClassName(view: 'comfortable' | 'compact' | 'table') {
  if (view === 'table') return 'grid min-w-0 grid-cols-1 gap-3'
  if (view === 'compact') return 'grid min-w-0 grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8'
  return mediaCardGridClassName
}
