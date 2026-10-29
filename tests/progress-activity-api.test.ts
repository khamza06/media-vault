import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn() }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from: mocks.from }) }))
import { GET } from '../app/api/progress-activity/route'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'synthetic' })
  for (const method of [mocks.from, mocks.select, mocks.eq, mocks.order]) method.mockReturnValue(mocks)
  mocks.limit.mockResolvedValue({ data: [], error: null })
})
it('denies anonymous requests before reading private activity', async () => { mocks.getCurrentUser.mockResolvedValue(null); expect((await GET()).status).toBe(401); expect(mocks.from).not.toHaveBeenCalled() })
it('bounds activity, reads the current owner only and prevents shared caching', async () => {
  const response = await GET()
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(mocks.eq).toHaveBeenCalledWith('user_id', 'owner')
  expect(mocks.limit).toHaveBeenCalledWith(12)
  expect(mocks.select.mock.calls[0][0]).not.toMatch(/notes|rating/)
})
it('reports a journal outage instead of fabricating activity from item creation dates', async () => {
  mocks.limit.mockResolvedValue({ data: null, error: { message: 'internal' } })
  expect((await GET()).status).toBe(503)
  expect(mocks.from).toHaveBeenCalledExactlyOnceWith('progress_events')
})
