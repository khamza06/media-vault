import { describe, expect, it } from 'vitest'
import { createBackupPayload, extractBackupItems, recordToVaultExportItem } from '../lib/backup'
import { mapBackupItemIds, parseBackupCollections, planBackupMemberships } from '../lib/backup-collections'

const oldId = '11111111-1111-4111-8111-111111111111'
const newId = '22222222-2222-4222-8222-222222222222'
const otherId = '33333333-3333-4333-8333-333333333333'
const list = { id: '44444444-4444-4444-8444-444444444444', name: 'Favorites', description: '  Exact\n', item_ids: [oldId] }
const item = recordToVaultExportItem({ id: oldId, title: 'Fixture', type: 'Anime', status: 'Planning', notes: '  **Notes**\n', external_source: 'anilist', external_id: '20' })

describe('backup v2 contract and ID mapping', () => {
  it('keeps v1 compatible and exports only explicit v2 list fields', () => {
    expect(createBackupPayload([item]).version).toBe(1)
    const payload = createBackupPayload([item], [{ ...list, user_id: 'foreign', is_public: true, slug: 'private' } as typeof list])
    expect(payload.version).toBe(2)
    expect(extractBackupItems(payload)).toEqual([item])
    expect(parseBackupCollections(payload)).toEqual({ lists: [list], error: null })
    expect(JSON.stringify(payload)).not.toContain('foreign')
    expect(JSON.stringify(payload)).not.toContain('is_public')
    expect(payload.items[0].notes).toBe(item.notes)
  })
  it('rejects duplicate IDs and dangling or duplicate references before restore', () => {
    const payload = createBackupPayload([item], [list])
    for (const broken of [
      { ...payload, items: [item, item] },
      { ...payload, lists: [list, list] },
      { ...payload, lists: [{ ...list, item_ids: [otherId] }] },
      { ...payload, lists: [{ ...list, item_ids: [oldId, oldId] }] },
      { ...payload, lists: [{ ...list, name: ' ' }] },
      { ...payload, lists: [{ ...list, description: 123 }] },
    ]) expect(parseBackupCollections(broken).error).toBeTruthy()
  })
  it('allows omitted items only in an explicit restore selection', () => {
    expect(parseBackupCollections({ app: 'Media Vault', version: 2, items: [], lists: [list] }, false).error).toBeNull()
    expect(planBackupMemberships(list, new Map())).toEqual({ itemIds: [], skipped: 1 })
  })
  it('maps exact IDs before normalized title, and never uses the old item ID as a target', () => {
    const owned = [{ ...item, id: newId, title: 'Renamed locally' }, { ...item, id: otherId, external_id: null, external_source: null }]
    expect(mapBackupItemIds([item], owned).get(oldId)).toBe(newId)
    expect(mapBackupItemIds([item], [{ ...owned[1], title: ' fixture ' }]).get(oldId)).toBe(otherId)
  })
  it('does not guess ambiguous or conflicting same-title work identities', () => {
    expect(mapBackupItemIds([item], [{ ...item, id: newId }, { ...item, id: otherId }]).size).toBe(0)
    expect(mapBackupItemIds([item], [{ ...item, id: newId, external_id: '99' }]).size).toBe(0)
    expect(mapBackupItemIds([item], [{ ...item, id: newId, external_source: 'myanimelist' }]).size).toBe(0)
    expect(mapBackupItemIds([item], [{ ...item, id: newId, external_source: null }, { ...item, id: otherId, external_source: null }]).size).toBe(0)
  })
  it('maps two same-title works to their distinct restored IDs for list membership', () => {
    const second = { ...item, id: otherId, external_id: '99' }
    const secondNewId = '55555555-5555-4555-8555-555555555555'
    const mapped = mapBackupItemIds([item, second], [{ ...item, id: newId }, { ...second, id: secondNewId }])
    expect(mapped.get(oldId)).toBe(newId)
    expect(mapped.get(otherId)).toBe(secondNewId)
  })
  it('deduplicates aliases and counts unselected/unresolved links without mutating the backup', () => {
    const input = { ...list, item_ids: [oldId, otherId, newId] }
    const map = new Map([[oldId, newId], [otherId, newId]])
    expect(planBackupMemberships(input, map)).toEqual({ itemIds: [newId], skipped: 2 })
    expect(input.item_ids).toEqual([oldId, otherId, newId])
  })
})
