'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteItemsBulkAction } from '../app/actions/items'
import { getConfirmedDeletedIds } from '../lib/bulk-delete-result'
import { useToast } from './ToastProvider'

export function useBulkDeleteRequest({ onDeleted, onComplete }: {
  onDeleted: (ids: Set<string>) => void
  onComplete: () => void
}) {
  const pending = useRef(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()
  const router = useRouter()

  async function deleteSelected(selectedIds: string[]) {
    if (pending.current || selectedIds.length === 0) return
    const ids = [...new Set(selectedIds)]
    pending.current = true
    setIsDeleting(true)
    setError(null)
    try {
      const result = await deleteItemsBulkAction(ids)
      const confirmed = getConfirmedDeletedIds(result, ids)
      if (confirmed.size > 0) {
        onDeleted(confirmed)
      }
      if (result.deleted > 0) router.refresh()
      if (!result.success || confirmed.size !== ids.length || result.failed > 0) {
        const message = result.deleted > 0
          ? `Deleted ${result.deleted} items. ${result.failed} were not deleted. Unconfirmed items remain selected. Refresh and review before retrying.`
          : result.error ?? 'No items were confirmed deleted. Refresh your vault before retrying.'
        setError(message)
        showToast(message, 'error')
        return
      }
      onComplete()
      showToast(`Deleted ${confirmed.size} items.`)
    } catch {
      const message = 'Connection interrupted. Some items may have been deleted. Refresh and review your vault before retrying. Your selection is still here.'
      setError(message)
      showToast(message, 'error')
    } finally {
      pending.current = false
      setIsDeleting(false)
    }
  }

  return { isDeleting, error, setError, deleteSelected }
}
