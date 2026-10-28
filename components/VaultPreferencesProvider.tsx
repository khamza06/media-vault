'use client'

import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'

import { parseVaultViewMode, vaultPreferencesKey, type VaultViewMode } from '../lib/vault-preferences'

function createStore(userId: string | null) {
  const key = userId ? vaultPreferencesKey(userId) : null
  const listeners = new Set<() => void>()
  let fallback = ''
  let memoryOnly = false
  const notify = () => listeners.forEach((listener) => listener())

  return {
    getSnapshot() {
      if (!key || memoryOnly || typeof window === 'undefined') return fallback
      try { return window.localStorage.getItem(key) ?? fallback } catch { return fallback }
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) {
          fallback = ''
          memoryOnly = false
          notify()
        }
      }
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.delete(listener)
        window.removeEventListener('storage', onStorage)
      }
    },
    setView(view: VaultViewMode) {
      fallback = JSON.stringify({ view })
      if (key) {
        try { window.localStorage.setItem(key, fallback); memoryOnly = false } catch { memoryOnly = true }
      }
      notify()
    },
  }
}

const PreferencesContext = createContext<{ view: VaultViewMode; setView: (view: VaultViewMode) => void }>({
  view: 'comfortable',
  setView: () => {},
})

export default function VaultPreferencesProvider({ userId, children }: {
  userId: string | null
  children: React.ReactNode
}) {
  const store = useMemo(() => createStore(userId), [userId])
  const raw = useSyncExternalStore(store.subscribe, store.getSnapshot, () => '')
  return (
    <PreferencesContext.Provider value={{ view: parseVaultViewMode(raw), setView: store.setView }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function useVaultPreferences() {
  return useContext(PreferencesContext)
}
