import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), update: vi.fn(), eq: vi.fn(), in: vi.fn(), from: vi.fn(), revalidatePath: vi.fn(), rows: [] as Record<string, unknown>[], written: [] as { id: string }[], readError: null as null | { message: string } }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from: mocks.from }) }))
vi.mock('next/cache', () => mocks)
import { bulkUpdateItemsAction } from '../app/actions/bulk-items'
import { applyBulkItemChange, parseBulkItemChange, parseBulkItemIds } from '../lib/bulk-item-changes'
import { toMediaItem } from '../lib/media'

const a = '11111111-1111-4111-8111-111111111111'
const b = '22222222-2222-4222-8222-222222222222'
const c = '33333333-3333-4333-8333-333333333333'
beforeEach(() => {
  mocks.getCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'fixture-not-a-token' })
  mocks.rows = [{ id: a, type: 'Anime', status: 'Watching', favorite: false }, { id: b, type: 'Manga', status: 'Reading', favorite: true }]
  mocks.written = [{ id: a }]; mocks.readError = null
  mocks.from.mockImplementation(() => {
    let write = false
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { mocks.eq(key, value); return query },
      in: (key: string, values: unknown) => { mocks.in(key, values); return query },
      update: (input: unknown) => { write = true; mocks.update(input); return query },
      then: (resolve: (value: unknown) => void) => Promise.resolve({ data: write ? mocks.written : mocks.rows, error: write ? null : mocks.readError }).then(resolve),
    }
    return query
  })
})
describe('bulk owner updates', () => {
  it('validates inputs before querying and ignores extra write fields', () => {
    expect(parseBulkItemIds([a, a])).toEqual([a])
    expect(parseBulkItemIds([a, 'bad'])).toBeNull()
    expect(parseBulkItemIds(Array(501).fill(a))).toBeNull()
    expect(parseBulkItemChange({ kind: 'favorite', favorite: 'yes' })).toBeNull()
    expect(parseBulkItemChange({ kind: 'status', status: 'Paused' })).toBeNull()
    expect(parseBulkItemChange({ kind: 'status', status: 'Completed', notes: 'not writable' })).toEqual({ kind: 'status', status: 'Completed' })
  })
  it('skips incompatible/unchanged statuses and missing items; only writes status for owned IDs', async () => {
    mocks.rows[0].status = 'Planning'
    const result = await bulkUpdateItemsAction([a, b, c], { kind: 'status', status: 'Watching' })
    expect(result).toMatchObject({ updated: 1, updatedIds: [a], skipped: 2, failed: 0, success: true })
    expect(mocks.update).toHaveBeenCalledWith({ status: 'Watching' })
    expect(mocks.in).toHaveBeenLastCalledWith('id', [a])
    expect(mocks.eq.mock.calls.filter(([key]) => key === 'user_id')).toEqual([['user_id', 'owner'], ['user_id', 'owner']])
  })
  it('only writes favorite and preserves every other client field', async () => {
    expect(await bulkUpdateItemsAction([a, b], { kind: 'favorite', favorite: true })).toMatchObject({ updated: 1, skipped: 1 })
    expect(mocks.update).toHaveBeenCalledWith({ favorite: true })
    const item = toMediaItem({ id: a, title: 'Fixture', type: 'Anime', status: 'Watching', notes: '  **Keep**\n', progress: 5, rating: 8 })
    const updated = applyBulkItemChange([item], { kind: 'favorite', favorite: true }, [a])[0]
    expect(updated).toEqual({ ...item, favorite: true })
    expect(item.favorite).toBe(false)
  })
  it('reports missing update rows as partial failure instead of claiming success', async () => {
    const result = await bulkUpdateItemsAction([a, b], { kind: 'status', status: 'Completed' })
    expect(result).toMatchObject({ success: false, updated: 1, failed: 1, skipped: 0 })
  })
  it('does not write if all values already match', async () => {
    expect(await bulkUpdateItemsAction([a], { kind: 'status', status: 'Watching' })).toMatchObject({ updated: 0, skipped: 1, success: true })
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('blocks guests, malformed IDs and read failures without exposing raw errors', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)
    expect((await bulkUpdateItemsAction([a], { kind: 'favorite', favorite: true })).success).toBe(false)
    expect((await bulkUpdateItemsAction(['invalid'], { kind: 'favorite', favorite: true })).success).toBe(false)
    expect(mocks.from).not.toHaveBeenCalled()
    mocks.readError = { message: 'private database detail' }
    const result = await bulkUpdateItemsAction([a], { kind: 'favorite', favorite: true })
    expect(result.failed).toBe(1)
    expect(result.error).not.toContain('private database detail')
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('keeps an accurate saved count even if cache invalidation is unavailable', async () => {
    mocks.revalidatePath.mockImplementationOnce(() => { throw new Error('Cache unavailable') })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await bulkUpdateItemsAction([a], { kind: 'favorite', favorite: true })).toMatchObject({ updated: 1, success: true })
  })
})
