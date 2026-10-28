import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), or: vi.fn(), ilike: vi.fn(),
  result: { data: [{ id: 'item', user_id: 'owner', title: 'Public title', type: 'Anime', status: 'Planning', notes: 'PRIVATE SENTINEL' }], error: null, count: 1 } as { data: unknown[] | null; error: { message: string } | null; count: number } }))
vi.mock('server-only', () => ({}))
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from: mocks.from }) }))
vi.mock('../lib/auth/dal', () => ({ requireCurrentUser: vi.fn() }))
import { getPublicItemsByUserId, publicItemRecords } from '../lib/data/public-items'
import { getDiscoveryHubItemsByUserId, getDiscoveryHubGenresByUserId, getSharedItemsByUserId, type DiscoveryHubFilters } from '../lib/data/items'

const filters: DiscoveryHubFilters = { dateAdded: 'all', genres: [], preset: 'all', query: 'PRIVATE SENTINEL', ratingMax: null, ratingMin: null, sortBy: 'recent', status: null, types: [] }
const query = {
  select: mocks.select, eq: mocks.eq, or: mocks.or, ilike: mocks.ilike,
  order: () => query, contains: () => query, in: () => query, gte: () => query, lte: () => query,
  then: (resolve: (value: typeof mocks.result) => unknown) => Promise.resolve(mocks.result).then(resolve),
}
beforeEach(() => {
  mocks.result = { data: [{ id: 'item', user_id: 'owner', title: 'Public title', type: 'Anime', status: 'Planning', notes: 'PRIVATE SENTINEL' }], error: null, count: 1 }
  for (const fn of [mocks.from, mocks.select, mocks.eq, mocks.or, mocks.ilike]) fn.mockReturnValue(query)
})

describe('public notes boundary', () => {
  it('uses the public projection and never serializes unexpected private fields', async () => {
    const result = await getPublicItemsByUserId('owner')
    expect(mocks.from).toHaveBeenCalledWith('public_items')
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(mocks.select.mock.calls[0][0].split(', ')).not.toContain('notes')
    expect(JSON.stringify(result.data)).not.toContain('PRIVATE SENTINEL')
    expect(result.data?.[0]).not.toHaveProperty('notes')
  })
  it('fails closed instead of falling back to a note-bearing table on schema errors', async () => {
    mocks.result = { data: null, error: { message: 'public_items missing' }, count: 0 }
    expect((await getPublicItemsByUserId('owner')).data).toBeNull()
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(['public_items'])
  })
  it('keeps the old shared helper on the safe projection', async () => {
    expect(JSON.stringify((await getSharedItemsByUserId('owner')).data)).not.toContain('PRIVATE SENTINEL')
    expect(mocks.from).toHaveBeenCalledWith('public_items')
  })
  it.each([undefined, { id: 'visitor', accessToken: 'synthetic' }])('does not search notes for a non-owner', async (viewer) => {
    const result = await getDiscoveryHubItemsByUserId('owner', filters, viewer)
    expect(mocks.from.mock.calls.every(([table]) => table === 'public_items')).toBe(true)
    expect(mocks.ilike).toHaveBeenCalledWith('title', '*PRIVATE SENTINEL*')
    expect(mocks.or).not.toHaveBeenCalled()
    expect(JSON.stringify(result.data)).not.toContain('PRIVATE SENTINEL')
  })
  it('retains owner notes and private title/notes search', async () => {
    const result = await getDiscoveryHubItemsByUserId('owner', filters, { id: 'owner', accessToken: 'synthetic' })
    expect(mocks.from.mock.calls.every(([table]) => table === 'items')).toBe(true)
    expect(mocks.or).toHaveBeenCalledWith('title.ilike.*PRIVATE SENTINEL*,notes.ilike.*PRIVATE SENTINEL*')
    expect(result.data?.[0].notes).toBe('PRIVATE SENTINEL')
  })
  it('loads public genre options from the safe view too', async () => {
    await getDiscoveryHubGenresByUserId('owner')
    expect(mocks.from).toHaveBeenCalledWith('public_items')
  })
  it('retains only explicitly public columns', () => {
    expect(publicItemRecords([{ id: 'x', title: 'Title', notes: 'secret', future_private_field: 'secret' }]))
      .toEqual([{ id: 'x', title: 'Title' }])
  })
})
