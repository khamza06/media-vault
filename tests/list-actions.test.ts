import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), upsert: vi.fn(), eq: vi.fn(), revalidatePath: vi.fn(), ownedItems: [] as { id: string }[], ownedLists: [] as { id: string }[], existing: [] as { list_id?: string; item_id?: string }[], inserted: [] as { id?: string; list_id?: string }[] }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/data/lists', () => ({ isMissingListSchemaError: () => false, isMissingListSharingSchemaError: () => false }))
vi.mock('next/cache', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from }) }))
import { addItemsToListAction, addItemToListsAction } from '../app/actions/lists'

function from(table: string) {
  const rows = () => table === 'lists' ? mocks.ownedLists : table === 'items' ? mocks.ownedItems : mocks.existing
  const query = {
    select: () => query,
    eq: (key: string, value: string) => { mocks.eq(table, key, value); return query },
    in: () => query,
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => void) => Promise.resolve({ data: rows(), error: null }).then(resolve),
    upsert: (input: unknown, options: unknown) => {
      mocks.upsert(input, options)
      return { select: async () => ({ data: mocks.inserted, error: null }) }
    },
  }
  return query
}
const itemId = '11111111-1111-4111-8111-111111111111'
const listId = '22222222-2222-4222-8222-222222222222'
beforeEach(() => {
  mocks.getCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'fixture-not-a-token' })
  mocks.ownedItems = [{ id: itemId }]; mocks.ownedLists = [{ id: listId }]; mocks.existing = []; mocks.inserted = []
})
describe('race-safe list additions', () => {
  it('uses the existing unique membership constraint to skip a concurrent duplicate', async () => {
    expect(await addItemsToListAction(listId, [itemId, itemId])).toMatchObject({ added: 0, skipped: 1, success: true })
    expect(mocks.upsert).toHaveBeenCalledWith([{ item_id: itemId, list_id: listId, user_id: 'owner' }], { onConflict: 'list_id,item_id', ignoreDuplicates: true })
    expect(mocks.eq).toHaveBeenCalledWith('lists', 'user_id', 'owner')
    expect(mocks.eq).toHaveBeenCalledWith('items', 'user_id', 'owner')
  })
  it('keeps multi-list additions non-overwriting and counts inserted memberships', async () => {
    mocks.inserted = [{ list_id: listId }]
    expect(await addItemToListsAction(itemId, [listId])).toMatchObject({ added: 1, skipped: 0, failed: 0 })
    expect(mocks.upsert).toHaveBeenCalledWith(expect.anything(), { onConflict: 'list_id,item_id', ignoreDuplicates: true })
  })
  it('does not write for a foreign list or foreign item', async () => {
    mocks.ownedLists = []
    expect((await addItemsToListAction(listId, [itemId])).success).toBe(false)
    mocks.ownedLists = [{ id: listId }]; mocks.ownedItems = []
    expect((await addItemToListsAction(itemId, [listId])).success).toBe(false)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it('blocks guests before reading list data', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    expect((await addItemsToListAction(listId, [itemId])).success).toBe(false)
    expect(mocks.eq).not.toHaveBeenCalled()
  })
})
