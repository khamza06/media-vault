import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), requireCurrentUser: vi.fn(), revalidatePath: vi.fn(), cleanup: vi.fn(), from: vi.fn(), eq: vi.fn(), in: vi.fn(), readError: null as null | { message: string }, deleteError: null as null | { message: string }, owned: [] as { id: string; image_url: string }[], deleted: [] as { id: string }[] }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/data/items', () => ({}))
vi.mock('../lib/data/storage', () => ({ deleteOwnedCoverByPublicUrl: mocks.cleanup }))
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from: mocks.from }) }))
vi.mock('next/cache', () => mocks)
import { deleteItemsBulkAction } from '../app/actions/items'
import { getConfirmedDeletedIds } from '../lib/bulk-delete-result'
const a = '11111111-1111-4111-8111-111111111111'
const b = '22222222-2222-4222-8222-222222222222'
const foreign = '33333333-3333-4333-8333-333333333333'
beforeEach(() => {
  const user = { id: 'owner', accessToken: 'fixture-not-a-token' }
  mocks.getCurrentUser.mockResolvedValue(user); mocks.requireCurrentUser.mockResolvedValue(user)
  mocks.owned = [{ id: a, image_url: 'https://example.invalid/a.png' }, { id: b, image_url: 'https://example.invalid/b.png' }]
  mocks.deleted = [{ id: a }]; mocks.readError = null; mocks.deleteError = null
  mocks.cleanup.mockResolvedValue(undefined)
  mocks.from.mockImplementation(() => {
    let write = false
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { mocks.eq(key, value); return query },
      in: (key: string, value: unknown) => { mocks.in(key, value); return query },
      delete: () => { write = true; return query },
      then: (resolve: (value: unknown) => void) => Promise.resolve({ data: write ? mocks.deleted : mocks.owned, error: write ? mocks.deleteError : mocks.readError }).then(resolve),
    }
    return query
  })
})
describe('confirmed owner-scoped bulk delete results', () => {
  it('returns confirmed IDs, keeps both owner filters and cleans covers only for confirmed deletes', async () => {
    expect(await deleteItemsBulkAction([a, b, foreign])).toMatchObject({ success: true, deleted: 1, deletedIds: [a], failed: 2 })
    expect(mocks.eq.mock.calls.filter(([key]) => key === 'user_id')).toEqual([['user_id', 'owner'], ['user_id', 'owner']])
    expect(mocks.in).toHaveBeenLastCalledWith('id', [a, b])
    expect(mocks.cleanup).toHaveBeenCalledExactlyOnceWith('https://example.invalid/a.png')
  })
  it('deduplicates returned IDs and ignores unexpected non-owned rows', async () => {
    mocks.deleted = [{ id: a }, { id: a }, { id: foreign }]
    expect(await deleteItemsBulkAction([a, b])).toMatchObject({ deleted: 1, deletedIds: [a], failed: 1 })
  })
  it('denies guests and oversized requests without touching tables', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)
    expect(await deleteItemsBulkAction([a])).toMatchObject({ success: false, deleted: 0 })
    expect(await deleteItemsBulkAction(Array.from({ length: 501 }, (_, i) => `synthetic-${i}`))).toMatchObject({ success: false, deleted: 0 })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('does not expose raw read or delete errors to the client', async () => {
    mocks.readError = { message: 'Private database diagnostics' }
    const read = await deleteItemsBulkAction([a])
    expect(read.error).not.toContain('Private'); expect(read.success).toBe(false)
    mocks.readError = null; mocks.deleteError = { message: 'Private database diagnostics' }
    const write = await deleteItemsBulkAction([a])
    expect(write.error).not.toContain('Private'); expect(write.success).toBe(false)
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })
  it('does not turn a committed delete into an unknown failure if invalidation or cover cleanup fails', async () => {
    mocks.cleanup.mockRejectedValueOnce(new Error('Storage unavailable'))
    mocks.revalidatePath.mockImplementationOnce(() => { throw new Error('Invalidation unavailable') })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await deleteItemsBulkAction([a])).toMatchObject({ success: true, deleted: 1, deletedIds: [a], failed: 0 })
  })
  it('does not claim any delete if the database confirms no rows', async () => {
    mocks.deleted = []
    expect(await deleteItemsBulkAction([a, b])).toMatchObject({ success: false, deleted: 0, deletedIds: [], failed: 2 })
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })
  it('maps only requested IDs and supports legacy full-count results without guessing partial identities', () => {
    expect([...getConfirmedDeletedIds({ success: true, deleted: 1, failed: 1, deletedIds: [a, a, foreign] }, [a, b])]).toEqual([a])
    expect([...getConfirmedDeletedIds({ success: true, deleted: 2, failed: 0 }, [a, b])]).toEqual([a, b])
    expect(getConfirmedDeletedIds({ success: true, deleted: 1, failed: 1 }, [a, b]).size).toBe(0)
    expect(getConfirmedDeletedIds({ success: false, deleted: 0, failed: 2 }, [a, b]).size).toBe(0)
  })
})
