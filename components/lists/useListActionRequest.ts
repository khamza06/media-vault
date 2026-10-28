'use client'

import { useRef } from 'react'
import { useToast } from '../ToastProvider'

export function useListActionRequest() {
  const pending = useRef(new Set<string>())
  const { showToast } = useToast()

  return async function run<T>(key: string, request: () => Promise<T>, finish: () => void): Promise<T | null> {
    if (pending.current.has(key)) return null
    pending.current.add(key)
    try { return await request() }
    catch {
      showToast('Connection interrupted. Some changes may have saved. Refresh and review your lists before retrying.', 'error')
      return null
    } finally {
      pending.current.delete(key)
      finish()
    }
  }
}
