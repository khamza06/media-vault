import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ requireCurrentUser: vi.fn(), eq: vi.fn(), select: vi.fn(), requests: 0, cap: 200, failAfter: -1, missingSource: false, missingOwner: false, rows: [] as { id: string; title: string; type: string; status: string }[] }))
vi.mock('server-only', () => ({}))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => client }))
import { readAllOwnedBackupItems, readAllOwnedBackupRows } from '../lib/data/backup-items'
import { getItemsForBackupExport } from '../lib/data/items'

function from() {
  let cursor = ''; let fields = ''
  const query = {
    select: (value: string) => { fields = value; mocks.select(value); return query },
    eq: (key: string, value: string) => { mocks.eq(key, value); return query },
    order: () => query, limit: () => query,
    gt: (_key: string, value: string) => { cursor = value; return query },
    overrideTypes: async () => {
      mocks.requests += 1
      if (mocks.missingOwner) return { data: null, error: { message: 'column user_id does not exist' } }
      if (mocks.missingSource && fields.includes('external_source')) return { data: null, error: { message: 'column external_source does not exist' } }
      if (mocks.failAfter >= 0 && mocks.requests > mocks.failAfter) return { data: null, error: { message: 'Connection failed' } }
      return { data: mocks.rows.filter((row) => row.id > cursor).slice(0, mocks.cap), error: null }
    },
  }
  return query
}
const client = { from } as unknown as Parameters<typeof readAllOwnedBackupItems>[0]
beforeEach(() => {
  mocks.requireCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'fixture-not-a-token' })
  mocks.requests = 0; mocks.cap = 200; mocks.failAfter = -1; mocks.missingSource = false; mocks.missingOwner = false
  mocks.rows = Array.from({ length: 1251 }, (_, index) => ({ id: `item-${String(index).padStart(5, '0')}`, title: 'Fixture', type: 'Anime', status: 'Planning' }))
})
describe('complete owned backup reads', () => {
  it.each(['lists', 'list_items'] as const)('keyset-pages %s with an owner filter on every page', async (table) => {
    const fromTable = vi.fn((name: string) => { expect(name).toBe(table); return from() })
    const scopedClient = { from: fromTable } as unknown as Parameters<typeof readAllOwnedBackupRows>[0]
    expect((await readAllOwnedBackupRows(scopedClient, 'owner', 'id', table)).data).toHaveLength(1251)
    expect(fromTable.mock.calls.every(([name]) => name === table)).toBe(true)
    expect(mocks.eq.mock.calls.every(([key, value]) => key === 'user_id' && value === 'owner')).toBe(true)
  })
  it('exports beyond 1000 rows even when the project row cap is lower than the requested page', async () => {
    const result = await getItemsForBackupExport()
    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1251)
    expect(new Set(result.data?.map((row) => row.id)).size).toBe(1251)
    expect(mocks.requests).toBe(8)
    expect(mocks.eq.mock.calls.every(([key, value]) => key === 'user_id' && value === 'owner')).toBe(true)
  })
  it('does not return a partial export after a later-page failure', async () => {
    mocks.failAfter = 1
    const result = await getItemsForBackupExport()
    expect(result.error).toBeTruthy()
    expect(result.data).toBeNull()
  })
  it('keeps schema fallback paginated and never falls back to an unowned read', async () => {
    mocks.missingSource = true
    expect((await getItemsForBackupExport()).data).toHaveLength(1251)
    expect(mocks.select).toHaveBeenCalledWith(expect.not.stringContaining('external_source'))
    mocks.requests = 0; mocks.missingOwner = true
    expect((await getItemsForBackupExport()).data).toBeNull()
    expect(mocks.requests).toBe(1)
  })
})
