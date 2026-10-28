import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), select: vi.fn(), eq: vi.fn(), coverError: false }))
vi.mock('server-only', () => ({}))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/data/items', () => ({ getItems: vi.fn(), getPublicItemsByUserId: vi.fn() }))
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from }) }))
import { getCustomLists } from '../lib/data/lists'

function from(table: string) {
  let fields = ''
  const query = {
    select: (value: string) => { fields = value; mocks.select(table, value); return query },
    eq: (key: string, value: string) => { mocks.eq(table, key, value); return query },
    in: () => query, overrideTypes: () => query,
    order: async () => ({ data: [{ id: 'list', name: 'Favorites' }], error: null }),
    then: (resolve: (value: unknown) => void) => Promise.resolve(fields.includes('items(') && mocks.coverError
      ? { data: null, error: { message: 'Could not find a relationship' } }
      : { data: [{ list_id: 'list', items: { image_url: 'https://example.com/cover.png', user_id: 'owner' } }], error: null }).then(resolve),
  }
  return query
}
beforeEach(() => { mocks.getCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'fixture-not-a-token' }); mocks.coverError = false })
describe('optional list collage reads', () => {
  it('loads owned covers in the same membership read only when requested', async () => {
    const result = await getCustomLists({ includeCovers: true })
    expect(result.lists[0]).toMatchObject({ itemCount: 1, coverUrls: ['https://example.com/cover.png'] })
    expect(mocks.select).toHaveBeenCalledWith('list_items', 'list_id, items(image_url, user_id)')
    expect(mocks.eq).toHaveBeenCalledWith('list_items', 'user_id', 'owner')
  })
  it('keeps the normal list picker query lightweight', async () => {
    const result = await getCustomLists()
    expect(result.lists[0]).not.toHaveProperty('coverUrls')
    expect(mocks.select).toHaveBeenCalledWith('list_items', 'list_id')
  })
  it('falls back to counts rather than breaking lists if the embed is unavailable', async () => {
    mocks.coverError = true
    const result = await getCustomLists({ includeCovers: true })
    expect(result).toMatchObject({ schemaReady: true, error: null })
    expect(result.lists[0].itemCount).toBe(1)
    expect(mocks.select).toHaveBeenCalledWith('list_items', 'list_id')
  })
  it('does not fetch any previews for guests', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    expect((await getCustomLists({ includeCovers: true })).lists).toEqual([])
    expect(mocks.select).not.toHaveBeenCalled()
  })
})
