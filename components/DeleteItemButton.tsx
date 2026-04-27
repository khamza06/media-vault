'use client'

import { startTransition, useState } from 'react'
import { useRouter } from 'next/navigation'

import { deleteItemAction } from '../app/actions/items'
import { useLocale } from './LocaleProvider'
import { useToast } from './ToastProvider'

type DeleteItemButtonProps = {
  id: string
  imageUrl?: string | null
  redirectTo?: string
  title: string
}

export default function DeleteItemButton({
  id,
  imageUrl,
  redirectTo,
  title,
}: DeleteItemButtonProps) {
  const router = useRouter()
  const { t } = useLocale()
  const { showToast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    const shouldDelete = window.confirm(`"${title}"?`)
    if (!shouldDelete) {
      return
    }

    setIsDeleting(true)
    const result = await deleteItemAction(id, imageUrl)
    setIsDeleting(false)

    if (!result.success) {
      showToast(result.error ?? 'Failed to delete item.', 'error')
      return
    }

    showToast(`Deleted "${title}".`)
    startTransition(() => {
      if (redirectTo) {
        router.push(redirectTo)
        router.refresh()
        return
      }

      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isDeleting ? t('common.deleting') : t('common.delete')}
    </button>
  )
}
