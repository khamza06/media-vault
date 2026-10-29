'use client'

import { ui } from '../lib/ui-i18n'
import { useLocale } from './LocaleProvider'

import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'

import { parseVaultPreferences, vaultPreferencesKey, type VaultViewMode, type VaultPreferences } from '../lib/vault-preferences'
import { normalizeSavedView, type SavedLibraryViewInput } from '../lib/saved-library-views'

type SaveViewResult = { success: boolean; error: string | null; persistent: boolean }

function createStore(userId: string | null, locale: import('../lib/i18n').Locale = 'en') {
  const key = userId ? vaultPreferencesKey(userId) : null
  const listeners = new Set<() => void>()
  let fallback = ''
  let memoryOnly = false
  const notify = () => listeners.forEach((listener) => listener())
  function getSnapshot() {
    if (!key || memoryOnly || typeof window === 'undefined') return fallback
    try { return window.localStorage.getItem(key) ?? fallback } catch { return fallback }
  }
  function write(value: VaultPreferences) {
    fallback = JSON.stringify(value)
    if (key) {
      try { window.localStorage.setItem(key, fallback); memoryOnly = false } catch { memoryOnly = true }
    }
    notify()
    return Boolean(key) && !memoryOnly
  }

  return {
    getSnapshot,
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
      write({ ...parseVaultPreferences(getSnapshot()), view })
    },
    saveView(input: SavedLibraryViewInput): SaveViewResult {
      if (!key) return { success: false, error: ui(locale, "Sign in to save a view for your account."), persistent: false }
      const current = parseVaultPreferences(getSnapshot())
      let fallbackId = 0
      const prefix = `view-${Date.now().toString(36)}`
      while (current.savedViews.some((view) => view.id === `${prefix}-${fallbackId}`)) fallbackId += 1
      const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${prefix}-${fallbackId}`
      const next = normalizeSavedView(input, id)
      if (!next) return { success: false, error: ui(locale, "Use a name of 1-60 characters and valid Library filters (search up to 300 characters)."), persistent: false }
      if (current.savedViews.length >= 12) return { success: false, error: ui(locale, "You can save up to 12 views. Remove one first."), persistent: false }
      if (current.savedViews.some((view) => view.name.toLocaleLowerCase('en-US') === next.name.toLocaleLowerCase('en-US'))) {
        return { success: false, error: ui(locale, "A view with that name already exists. Choose another name."), persistent: false }
      }
      return { success: true, error: null, persistent: write({ ...current, savedViews: [...current.savedViews, next] }) }
    },
    removeSavedView(id: string) {
      const current = parseVaultPreferences(getSnapshot())
      write({ ...current, savedViews: current.savedViews.filter((view) => view.id !== id) })
    },
  }
}

const PreferencesContext = createContext<VaultPreferences & {
  setView: (view: VaultViewMode) => void
  canSave: boolean
  saveView: (input: SavedLibraryViewInput) => SaveViewResult
  removeSavedView: (id: string) => void
}>({
  view: 'comfortable', savedViews: [], canSave: false, setView: () => {}, removeSavedView: () => {},
  saveView: () => ({ success: false, persistent: false, error: 'Sign in to save views.' }),
})

export default function VaultPreferencesProvider({ userId, children }: {
  userId: string | null
  children: React.ReactNode
}) {
  const { locale } = useLocale()

  const store = useMemo(() => createStore(userId, locale), [userId, locale])
  const raw = useSyncExternalStore(store.subscribe, store.getSnapshot, () => '')
  const preferences = useMemo(() => parseVaultPreferences(raw), [raw])
  return (
    <PreferencesContext.Provider value={{ ...preferences, setView: store.setView, canSave: Boolean(userId), saveView: store.saveView, removeSavedView: store.removeSavedView }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function useVaultPreferences() {
  return useContext(PreferencesContext)
}
