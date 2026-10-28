import { getBackupExternalKey, type VaultExportItem } from './backup'

export type VaultExportList = {
  id: string
  name: string
  description: string | null
  item_ids: string[]
}

export const MAX_BACKUP_RESTORE_ITEMS = 2000
export const MAX_BACKUP_RESTORE_LISTS = 100
export const MAX_BACKUP_RESTORE_LINKS = 20000
export const MAX_BACKUP_RESTORE_BYTES = 750000
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export const isBackupId = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value)

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function normalizeBackupName(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ')
}

// Files have a complete graph; a selected restore may intentionally omit items.
export function parseBackupCollections(value: unknown, checkReferences = true): {
  lists: VaultExportList[]; error: string | null
} {
  const fail = (error: string) => ({ lists: [], error })
  if (!isRecord(value) || value.version !== 2) return { lists: [], error: null }
  if (value.app !== 'Media Vault' || !Array.isArray(value.items) || !Array.isArray(value.lists)) {
    return fail('Backup v2 must contain Media Vault items and lists.')
  }
  const itemIds = new Set<string>()
  for (const item of value.items) {
    if (!isRecord(item) || !isBackupId(item.id) || itemIds.has(item.id)) {
      return fail('Backup v2 items need unique valid IDs. No data was restored.')
    }
    itemIds.add(item.id)
  }
  const listIds = new Set<string>()
  const lists: VaultExportList[] = []
  for (const row of value.lists) {
    if (!isRecord(row) || !isBackupId(row.id) || listIds.has(row.id)) return fail('Backup lists need unique valid IDs.')
    if (typeof row.name !== 'string' || !row.name.trim() || row.name.trim().length > 80) return fail('List names must contain 1-80 characters.')
    if (row.description !== null && row.description !== undefined && (typeof row.description !== 'string' || row.description.length > 500)) return fail('List descriptions must be text of 500 characters or fewer.')
    if (!Array.isArray(row.item_ids)) return fail('Each backup list needs an item_ids array.')
    const refs = new Set<string>()
    for (const id of row.item_ids) {
      if (!isBackupId(id) || refs.has(id)) return fail('List item references must be unique valid IDs.')
      if (checkReferences && !itemIds.has(id)) return fail('A list references an item missing from this backup.')
      refs.add(id)
    }
    listIds.add(row.id)
    // Explicit projection excludes owner, public visibility, slugs and arbitrary columns.
    lists.push({ id: row.id, name: row.name.trim(), description: typeof row.description === 'string' ? row.description : null, item_ids: [...refs] })
  }
  return { lists, error: null }
}

type BackupIdentity = { id: string; title?: string | null; type?: string | null; external_source?: string | null; external_id?: string | null }

export function mapBackupItemIds(selected: Pick<VaultExportItem, 'id' | 'type' | 'title' | 'external_source' | 'external_id'>[], owned: BackupIdentity[]) {
  const external = new Map<string, Set<string>>()
  const titles = new Map<string, BackupIdentity[]>()
  for (const row of owned) {
    if (!isBackupId(row.id)) continue
    const key = getBackupExternalKey(row)
    if (key) external.set(key, new Set([...(external.get(key) ?? []), row.id]))
    const title = `${row.type}::${normalizeBackupName(row.title ?? '')}`
    titles.set(title, [...(titles.get(title) ?? []), row])
  }
  const result = new Map<string, string>()
  for (const item of selected) {
    if (!isBackupId(item.id)) continue
    const key = getBackupExternalKey(item)
    const exact = key ? external.get(key) : undefined
    if (exact?.size === 1) { result.set(item.id, [...exact][0]); continue }
    if (exact && exact.size > 1) continue
    const matches = titles.get(`${item.type}::${normalizeBackupName(item.title)}`) ?? []
    if (matches.length !== 1) continue
    const match = matches[0]
    // Do not attach a same-title remake with a conflicting known provider ID.
    if (key && match.external_source?.toLowerCase() === item.external_source?.toLowerCase() && match.external_id && getBackupExternalKey(match) !== key) continue
    result.set(item.id, match.id)
  }
  return result
}

export function planBackupMemberships(list: VaultExportList, itemIds: Map<string, string>) {
  const ids = new Set<string>()
  let skipped = 0
  for (const oldId of list.item_ids) {
    const id = itemIds.get(oldId)
    if (!id || ids.has(id)) { skipped++; continue }
    ids.add(id)
  }
  return { itemIds: [...ids], skipped }
}
