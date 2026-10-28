import { getBackupExternalKey } from './backup'

type IdentityRow = {
  title?: string | null
  type?: string | null
  external_source?: string | null
  external_id?: string | null
}

// A title is only a fallback when at least one side has no provider identity.
// Different provider IDs may legitimately have exactly the same display title.
export function createImportDuplicateTracker(existing: IdentityRow[]) {
  const identities = new Set<string>()
  const titles = new Set<string>()
  const unidentifiedTitles = new Set<string>()
  const titleKey = (row: IdentityRow) => `${row.type ?? ''}::${(row.title ?? '').normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ')}`
  const add = (row: IdentityRow) => {
    const key = getBackupExternalKey(row)
    titles.add(titleKey(row))
    if (key) identities.add(key)
    else unidentifiedTitles.add(titleKey(row))
  }
  existing.forEach(add)
  return {
    has(row: IdentityRow) {
      const key = getBackupExternalKey(row)
      return key ? identities.has(key) || unidentifiedTitles.has(titleKey(row)) : titles.has(titleKey(row))
    },
    add,
  }
}
