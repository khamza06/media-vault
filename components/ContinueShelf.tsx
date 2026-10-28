'use client'

import { Play } from 'lucide-react'

import { getContinueItems } from '../lib/continue-items'
import type { MediaItem } from '../lib/media'
import type { AddToListOption } from './lists/AddToListButton'
import ShelfItemCard from './ShelfItemCard'

type ContinueShelfProps = {
  items: MediaItem[]
  listOptions: AddToListOption[]
  busyIds: Record<string, boolean>
  isSelectionMode: boolean
  onIncrement: (item: MediaItem) => void
  accentHandler: (imageUrl: string | null) => void
  returnTo: string
  density?: 'comfortable' | 'compact'
}

export default function ContinueShelf({
  items, listOptions, busyIds, isSelectionMode, onIncrement, accentHandler, returnTo, density,
}: ContinueShelfProps) {
  const continueItems = getContinueItems(items)

  if (isSelectionMode || continueItems.length === 0) return null

  return (
    <section aria-labelledby="continue-heading" className="min-w-0 space-y-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-blue-200">
          <Play aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 id="continue-heading" className="text-lg font-bold tracking-tight text-white sm:text-2xl">
            Continue
          </h2>
          <p className="text-sm text-slate-400">
            Pick up a title you are watching or reading. Your current filters apply.
          </p>
        </div>
      </div>
      <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2 md:gap-4">
        {continueItems.map((item) => (
          <ShelfItemCard
            key={item.id}
            accentHandler={accentHandler}
            item={item}
            layout="rail"
            density={density}
            listOptions={listOptions}
            onIncrement={onIncrement}
            progressBusy={Boolean(busyIds[item.id])}
            returnTo={returnTo}
          />
        ))}
      </div>
    </section>
  )
}
