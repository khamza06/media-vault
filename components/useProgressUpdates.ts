'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { applyProgressSnapshot, canAdvanceProgress, isProgressSnapshot, type ProgressExpectation } from '../lib/progress'
import type { MediaItem } from '../lib/media'
import { useLocale } from './LocaleProvider'
import { useToast } from './ToastProvider'

export function useProgressUpdates(setItems: Dispatch<SetStateAction<MediaItem[]>>) {
  const pending = useRef(new Set<string>())
  const retries = useRef(new Map<string, ProgressExpectation>())
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({})
  const [errorIds, setErrorIds] = useState<Record<string, boolean>>({})
  const { t } = useLocale()
  const { showToast } = useToast()
  const router = useRouter()
  useEffect(() => {
    const refresh = () => { if (!pending.current.size) router.refresh() }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [router])

  async function handleIncrement(item: MediaItem) {
    if (pending.current.has(item.id) || !canAdvanceProgress(item)) return
    pending.current.add(item.id) // Synchronous guard also protects two copies of a card.
    const expected = retries.current.get(item.id) ?? { progress: item.progress, lastProgressAt: item.lastProgressAt }
    retries.current.set(item.id, expected)
    setBusyIds(current => ({ ...current, [item.id]: true }))
    setErrorIds(current => ({ ...current, [item.id]: false }))
    try {
      const response = await fetch(`/api/items/${encodeURIComponent(item.id)}/progress`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expected),
        signal: AbortSignal.timeout(15000),
      })
      const payload = await response.json()
      if ((!response.ok && response.status !== 409) || !isProgressSnapshot(payload.data, item.id)) throw new Error('Unconfirmed progress')
      retries.current.delete(item.id)
      setItems(current => current.map(row => row.id === item.id ? applyProgressSnapshot(row, payload.data) : row))
      showToast(t(payload.data.outcome === 'conflict' ? 'progress.conflict' : payload.data.outcome === 'complete' ? 'progress.complete' : 'progress.saved', { title: item.title, progress: payload.data.progress }), payload.data.outcome === 'conflict' ? 'error' : 'success')
      window.dispatchEvent(new Event('media-vault-progress-updated'))
    } catch {
      // Keep the original expected version: a response can be lost after commit.
      // Replaying it must reconcile, never blindly add another episode/chapter.
      setErrorIds(current => ({ ...current, [item.id]: true }))
      showToast(t('progress.failed'), 'error')
    } finally {
      pending.current.delete(item.id)
      setBusyIds(current => { const next = { ...current }; delete next[item.id]; return next })
    }
  }
  return { busyIds, errorIds, handleIncrement }
}
