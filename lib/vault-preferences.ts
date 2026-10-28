import { parseSavedLibraryViews, type SavedLibraryView } from './saved-library-views'

export const vaultViewModes = ['comfortable', 'compact', 'table'] as const
export type VaultViewMode = (typeof vaultViewModes)[number]
export type VaultPreferences = { view: VaultViewMode; savedViews: SavedLibraryView[] }

export function parseVaultViewMode(raw: string | null): VaultViewMode {
  return parseVaultPreferences(raw).view
}

export function parseVaultPreferences(raw: string | null): VaultPreferences {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null
    if (value && typeof value === 'object') {
      return {
        view: 'view' in value && vaultViewModes.includes(value.view as VaultViewMode) ? value.view as VaultViewMode : 'comfortable',
        savedViews: 'savedViews' in value ? parseSavedLibraryViews(value.savedViews) : [],
      }
    }
  } catch {}
  return { view: 'comfortable', savedViews: [] }
}

export function vaultPreferencesKey(userId: string) {
  return `media-vault-preferences:v1:${userId}`
}
