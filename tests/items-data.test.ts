import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ insert: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn(), requireCurrentUser: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from: () => query }) }))
import { createItem, getItemById } from '../lib/data/items'
import { normalizeMediaItemInput } from '../lib/media'

const query = { insert: mocks.insert, select: mocks.select, eq: mocks.eq, single: mocks.single }
const input = normalizeMediaItemInput({ title: 'Fixture', type: 'Anime', status: 'Planning', progress: '', totalProgress: '', rating: '', externalRatingValue: '', externalRatingLabel: '', favorite: false, genres: '', imageUrl: '', startedAt: '', completedAt: '', notes: '  **Notes**\n' }).data!
beforeEach(() => {
  mocks.requireCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'fixture-not-a-token' })
  mocks.insert.mockReturnValue(query)
  mocks.select.mockReturnValue(query)
  mocks.eq.mockReturnValue(query)
  mocks.single.mockResolvedValue({ data: { id: 'item' }, error: null })
})

describe('item data identity', () => {
  it('inserts identity into existing columns with the authenticated owner, not user input', async () => {
    await createItem(input, { source: 'anilist', id: '20' })
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'owner', external_source: 'anilist', external_id: '20', notes: '  **Notes**\n', progress: 0 }))
  })
  it('does not add source tags to manual items', async () => {
    await createItem(input)
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty('external_source')
  })
  it('keeps identity in the older progress-timestamp schema fallback', async () => {
    mocks.single.mockResolvedValueOnce({ data: null, error: { message: 'column last_progress_at does not exist' } })
    await createItem(input, { source: 'tmdb', id: '1' })
    expect(mocks.insert.mock.calls[1][0]).toMatchObject({ external_source: 'tmdb', external_id: '1', user_id: 'owner', notes: '  **Notes**\n' })
  })
  it('loads source IDs on detail pages with owner-scoped filters', async () => {
    await getItemById('item')
    expect(mocks.select.mock.calls[0][0]).toContain('external_source, external_id')
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(mocks.eq).toHaveBeenCalledWith('id', 'item')
  })
  it('keeps older read compatibility if source columns are absent', async () => {
    mocks.single.mockResolvedValueOnce({ data: null, error: { message: 'column external_source does not exist' } })
    await getItemById('item')
    expect(mocks.select).toHaveBeenCalledTimes(2)
    expect(mocks.select.mock.calls[1][0]).not.toContain('external_source')
    expect(mocks.eq.mock.calls.filter(([field]) => field === 'user_id')).toHaveLength(2)
  })
})
