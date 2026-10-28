import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), readAllOwnedBackupRows: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/data/backup-items', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({}) }))
import { getCollectionsForBackupExport } from '../lib/data/backup-collections'
const list = { id: 'list', name: 'Favorites', description: '  Exact\n' }
beforeEach(() => {
  mocks.getCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'fixture-not-a-token' })
  mocks.readAllOwnedBackupRows.mockImplementation((_db, _owner, _fields, table) => Promise.resolve({ data: table === 'lists' ? [list] : [{ id: 'link', list_id: 'list', item_id: 'owned' }], error: null }))
})
describe('owned collection export', () => {
  it('reads both complete owned tables and preserves references/descriptions without account/sharing fields', async () => {
    expect(await getCollectionsForBackupExport(['owned'])).toEqual({ lists: [{ ...list, item_ids: ['owned'] }], error: null, warning: null })
    expect(mocks.readAllOwnedBackupRows).toHaveBeenCalledWith(expect.anything(), 'owner', 'id, name, description', 'lists')
    expect(mocks.readAllOwnedBackupRows).toHaveBeenCalledWith(expect.anything(), 'owner', 'id, list_id, item_id', 'list_items')
  })
  it('blocks guests without reads', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    expect((await getCollectionsForBackupExport([])).error).toBeTruthy()
    expect(mocks.readAllOwnedBackupRows).not.toHaveBeenCalled()
  })
  it('only falls back to clearly labelled v1 when the lists table is missing', async () => {
    mocks.readAllOwnedBackupRows.mockResolvedValueOnce({ data: null, error: { code: '42P01' } })
    expect(await getCollectionsForBackupExport([])).toMatchObject({ lists: undefined, error: null, warning: expect.stringContaining('v1') })
  })
  it('rejects partial reads and unavailable/foreign references, not a silently incomplete backup', async () => {
    expect((await getCollectionsForBackupExport(['different-owned-item'])).error).toBeTruthy()
    mocks.readAllOwnedBackupRows.mockResolvedValueOnce({ data: [list], error: null }).mockResolvedValueOnce({ data: null, error: { message: 'Private DB detail' } })
    const result = await getCollectionsForBackupExport(['owned'])
    expect(result.lists).toBeUndefined()
    expect(result.error).not.toContain('Private DB detail')
  })
})
