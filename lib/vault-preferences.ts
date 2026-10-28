export const vaultViewModes = ['comfortable', 'compact', 'table'] as const
export type VaultViewMode = (typeof vaultViewModes)[number]

export function parseVaultViewMode(raw: string | null): VaultViewMode {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null
    if (value && typeof value === 'object' && 'view' in value
      && vaultViewModes.includes(value.view as VaultViewMode)) return value.view as VaultViewMode
  } catch {}
  return 'comfortable'
}

export function vaultPreferencesKey(userId: string) {
  return `media-vault-preferences:v1:${userId}`
}
