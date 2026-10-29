'use client'

import { ui } from '../lib/ui-i18n'

import { startTransition, useRef, useState } from 'react'
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
  const { locale, t  } = useLocale()
  const { showToast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const pending = useRef(false)

  async function handleDelete() {
    if (pending.current) return
    const shouldDelete = window.confirm(`"${title}"?`)
    if (!shouldDelete) {
      return
    }

    pending.current = true
    setIsDeleting(true)
    try {
    const result = await deleteItemAction(id, imageUrl)

    if (!result.success) {
      showToast(result.error ?? 'Failed to delete item.', 'error')
      return
    }

    showToast(ui(locale, "Deleted \"{value0}\".", { value0: title }))
    startTransition(() => {
      if (redirectTo) {
        router.push(redirectTo)
        router.refresh()
        return
      }

      router.refresh()
    })
    } catch {
      showToast(ui(locale, "Could not confirm deletion. Refresh your vault before retrying."), 'error')
    } finally {
      pending.current = false
      setIsDeleting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className="min-h-11 min-w-11 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isDeleting ? t('common.deleting') : t('common.delete')}
    </button>
  )
}
