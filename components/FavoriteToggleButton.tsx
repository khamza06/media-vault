'use client'

import { startTransition, useState } from 'react'
import { useRouter } from 'next/navigation'

import { toggleFavoriteAction } from '../app/actions/items'
import { useLocale } from './LocaleProvider'
import { useToast } from './ToastProvider'

type FavoriteToggleButtonProps = {
  favorite: boolean
  id: string
  title: string
}

export default function FavoriteToggleButton({
  favorite,
  id,
  title,
}: FavoriteToggleButtonProps) {
  const router = useRouter()
  const { t } = useLocale()
  const { showToast } = useToast()
  const [isPending, setIsPending] = useState(false)

  async function handleToggle() {
    setIsPending(true)
    const nextValue = !favorite
    const result = await toggleFavoriteAction(id, nextValue)
    setIsPending(false)

    if (!result.success) {
      showToast(result.error ?? 'Failed to update favorite.', 'error')
      return
    }

    showToast(nextValue ? `Added "${title}" to favorites.` : `Removed "${title}" from favorites.`)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void handleToggle()
      }}
      disabled={isPending}
      aria-label={favorite ? t('common.favorited') : t('common.favorite')}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
        favorite
          ? 'border-amber-400/40 bg-amber-400/15 text-amber-100 hover:bg-amber-400/20'
          : 'border-slate-700 bg-slate-900/90 text-slate-200 hover:border-amber-400/40 hover:text-amber-100'
      }`}
    >
      {isPending ? t('common.saving') : favorite ? t('common.favorited') : t('common.favorite')}
    </button>
  )
}
