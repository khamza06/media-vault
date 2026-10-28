import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ range: vi.fn(), eq: vi.fn(), or: vi.fn(), ilike: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('../lib/auth/dal', () => ({ requireCurrentUser: vi.fn() }))
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from: () => query }) }))
import { getDiscoveryHubItemsByUserId, type DiscoveryHubFilters } from '../lib/data/items'
const rows = Array.from({ length: 1251 }, (_, index) => ({ id: String(index), title: 'Fixture', type: 'Anime', status: 'Planning', notes: 'OWNER ONLY' }))
const query = { select: () => query, eq: state.eq, or: state.or, ilike: state.ilike,
  contains: () => query, in: () => query, gte: () => query, lte: () => query, order: () => query, range: state.range,
  then: (resolve: (value: unknown) => void) => Promise.resolve({ data: [], error: null, count: rows.length }).then(resolve),
}
const filters: DiscoveryHubFilters = { dateAdded: 'all', genres: [], preset: 'all', query: 'Fixture', ratingMax: null, ratingMin: null, sortBy: 'recent', status: null, types: [] }
beforeEach(() => {
  state.eq.mockReturnValue(query); state.or.mockReturnValue(query); state.ilike.mockReturnValue(query)
  state.range.mockImplementation(async (offset: number) => ({ data: rows.slice(offset, offset + 200), error: null, count: rows.length }))
})
describe('filtered library transport pagination', () => {
  it.each([undefined, { id: 'owner', accessToken: 'synthetic' }])('reads all filtered pages under a lower API cap without exposing notes to a visitor', async viewer => {
    const result = await getDiscoveryHubItemsByUserId('owner', filters, viewer)
    expect(result.data).toHaveLength(1251)
    expect(result.filteredCount).toBe(1251)
    expect(state.range).toHaveBeenCalledTimes(8)
    expect(JSON.stringify(result.data).includes('OWNER ONLY')).toBe(Boolean(viewer))
  })
  it('does not return truncated data when a later page fails', async () => {
    state.range.mockImplementation(async (offset: number) => offset ? { data: null, error: { message: 'offline' }, count: null } : { data: rows.slice(0, 200), error: null, count: rows.length })
    expect((await getDiscoveryHubItemsByUserId('owner', filters)).data).toBeNull()
  })
})
