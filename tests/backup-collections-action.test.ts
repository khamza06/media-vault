import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultExportList } from '../lib/backup-collections'
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), readAllOwnedBackupItems: vi.fn(), readAllOwnedBackupRows: vi.fn(),
  restoreBackupItemsAction: vi.fn(), revalidatePath: vi.fn(), create: vi.fn(), add: vi.fn(),
  createResult: { data: { id: '44444444-4444-4444-8444-444444444444' }, error: null } as { data: { id: string } | null; error: { message: string } | null },
  addResult: null as { data: { item_id: string }[] | null; error: { message: string } | null } | null,
}))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/data/backup-items', () => mocks)
vi.mock('../app/actions/backup', () => mocks)
vi.mock('next/cache', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from: (table: string) => ({
  insert: (row: unknown) => { mocks.create(table, row); return { select: () => ({ single: async () => mocks.createResult }) } },
  upsert: (rows: { item_id: string }[], options: unknown) => { mocks.add(table, rows, options); return { select: async () => mocks.addResult ?? { data: rows.map((row) => ({ item_id: row.item_id })), error: null } } },
}) }) }))
import { restoreBackupCollectionsAction } from '../app/actions/backup-collections'
import { recordToVaultExportItem } from '../lib/backup'

const oldId = '11111111-1111-4111-8111-111111111111'
const ownedId = '22222222-2222-4222-8222-222222222222'
const listId = '33333333-3333-4333-8333-333333333333'
const item = recordToVaultExportItem({ id: oldId, title: 'Fixture', type: 'Anime', status: 'Planning', notes: ' **Exact**\n', external_source: 'anilist', external_id: '20' })
const list: VaultExportList = { id: listId, name: 'Favorites', description: '  Exact\n', item_ids: [oldId] }
const itemResult = { success: true, error: null, restored: 1, skipped: 0, failed: 0, invalid: 0, usedExternalIdColumns: true }
beforeEach(() => {
  mocks.getCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'fixture-not-a-token' })
  mocks.readAllOwnedBackupRows.mockResolvedValue({ data: [], error: null })
  mocks.readAllOwnedBackupItems.mockResolvedValue({ data: [{ ...item, id: ownedId }], error: null })
  mocks.restoreBackupItemsAction.mockResolvedValue(itemResult)
  mocks.createResult = { data: { id: '44444444-4444-4444-8444-444444444444' }, error: null }
  mocks.addResult = null
})

describe('selected collection restore', () => {
  it('reuses item restore, maps IDs from owned lookup, creates private lists and preserves descriptions', async () => {
    const inputList = { ...list, user_id: 'foreign', is_public: true, slug: 'public' }
    const result = await restoreBackupCollectionsAction({ items: [item], lists: [inputList] })
    expect(result).toMatchObject({ success: true, restored: 1, listsRestored: 1, membershipsRestored: 1 })
    expect(mocks.restoreBackupItemsAction).toHaveBeenCalledExactlyOnceWith([item])
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith('lists', { user_id: 'owner', name: list.name, description: list.description, is_public: false, slug: null })
    expect(mocks.add).toHaveBeenCalledExactlyOnceWith('list_items', [{ list_id: mocks.createResult.data?.id, item_id: ownedId, user_id: 'owner' }], { onConflict: 'list_id,item_id', ignoreDuplicates: true })
    expect(mocks.readAllOwnedBackupItems).toHaveBeenCalledWith(expect.anything(), 'owner', expect.stringContaining('external_id'))
  })
  it('skips normalized duplicate list names without merging or changing existing lists', async () => {
    mocks.readAllOwnedBackupRows.mockResolvedValue({ data: [{ id: listId, name: '  FAVORITES  ' }], error: null })
    expect(await restoreBackupCollectionsAction({ items: [item], lists: [list] })).toMatchObject({ success: true, listsSkipped: 1, membershipsSkipped: 1 })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.add).not.toHaveBeenCalled()
  })
  it('does not add unselected backup item IDs or ambiguous matches', async () => {
    expect(await restoreBackupCollectionsAction({ items: [], lists: [list] })).toMatchObject({ listsRestored: 1, membershipsSkipped: 1 })
    expect(mocks.restoreBackupItemsAction).not.toHaveBeenCalled()
    expect(mocks.readAllOwnedBackupItems).not.toHaveBeenCalled()
    expect(mocks.add).not.toHaveBeenCalled()
    mocks.readAllOwnedBackupItems.mockResolvedValue({ data: [{ ...item, id: ownedId }, { ...item, id: listId }], error: null })
    expect(await restoreBackupCollectionsAction({ items: [item], lists: [list] })).toMatchObject({ membershipsRestored: 0, membershipsSkipped: 1 })
    expect(mocks.add).not.toHaveBeenCalled()
  })
  it('maps skipped existing item duplicates without overwriting their notes', async () => {
    mocks.restoreBackupItemsAction.mockResolvedValue({ ...itemResult, restored: 0, skipped: 1 })
    expect(await restoreBackupCollectionsAction({ items: [item], lists: [list] })).toMatchObject({ restored: 0, skipped: 1, membershipsRestored: 1 })
    expect(mocks.add.mock.calls[0][1][0].item_id).toBe(ownedId)
  })
  it('blocks guests before any data lookup or write', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    expect((await restoreBackupCollectionsAction({ items: [item], lists: [list] })).success).toBe(false)
    expect(mocks.readAllOwnedBackupRows).not.toHaveBeenCalled()
    expect(mocks.restoreBackupItemsAction).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('rejects malformed graph, duplicate IDs and extra root fields attempting to bypass validation', async () => {
    const invalid = { items: [item], lists: [{ ...list, item_ids: ['foreign-item'] }], version: 1, app: 'Other app' }
    expect((await restoreBackupCollectionsAction(invalid)).success).toBe(false)
    expect((await restoreBackupCollectionsAction({ items: [item, item], lists: [list] })).success).toBe(false)
    expect(mocks.restoreBackupItemsAction).not.toHaveBeenCalled()
  })
  it('bounds item/list/payload sizes before processing items', async () => {
    for (const input of [
      { items: Array(2001).fill(item), lists: [] },
      { items: [item], lists: Array(101).fill(list) },
      { items: [{ ...item, notes: 'x'.repeat(750001) }], lists: [list] },
    ]) expect((await restoreBackupCollectionsAction(input)).success).toBe(false)
    expect(mocks.restoreBackupItemsAction).not.toHaveBeenCalled()
  })
  it('does not create lists after failed item restore or unavailable owner mapping', async () => {
    mocks.restoreBackupItemsAction.mockResolvedValueOnce({ ...itemResult, success: false, restored: 0, failed: 1 })
    expect((await restoreBackupCollectionsAction({ items: [item], lists: [list] })).success).toBe(false)
    mocks.readAllOwnedBackupItems.mockResolvedValue({ data: null, error: { message: 'private database detail' } })
    const result = await restoreBackupCollectionsAction({ items: [item], lists: [list] })
    expect(result).toMatchObject({ restored: 1, listsRestored: 0, success: false })
    expect(result.error).not.toContain('private database detail')
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('reports partial membership failure without deleting restored items/lists or inventing success', async () => {
    mocks.addResult = { data: null, error: { message: 'private failure' } }
    expect(await restoreBackupCollectionsAction({ items: [item], lists: [list] })).toMatchObject({ success: false, restored: 1, listsRestored: 1, membershipsFailed: 1, membershipsRestored: 0 })
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/lists/${mocks.createResult.data?.id}`)
  })
  it('does not count unconfirmed returned membership rows as duplicate skips', async () => {
    mocks.addResult = { data: [], error: null }
    expect(await restoreBackupCollectionsAction({ items: [item], lists: [list] })).toMatchObject({ membershipsFailed: 1, membershipsSkipped: 0, success: false })
  })
  it('keeps confirmed progress if transport or cache invalidation fails after list creation', async () => {
    mocks.add.mockImplementationOnce(() => { throw new Error('Network') })
    mocks.revalidatePath.mockImplementationOnce(() => { throw new Error('Cache') })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await restoreBackupCollectionsAction({ items: [item], lists: [list] })
    expect(result).toMatchObject({ success: false, restored: 1, listsRestored: 1 })
    expect(result.error).toContain('Some changes may have saved')
  })
})
