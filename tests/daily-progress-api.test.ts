import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('next/cache', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ rpc: mocks.rpc }) }))
import { POST } from '../app/api/items/[id]/progress/route'
const id = 'd20f8e39-e3c4-4797-bccb-188b32123456'
const context = { params: Promise.resolve({ id }) }
const input = { progress: 0, lastProgressAt: null }
const snapshot = { id, progress: 1, total_progress: 12, status: 'Watching', last_progress_at: '2026-10-29T08:00:00.123456Z', outcome: 'updated' }
const request = (body: unknown = input, origin = 'https://media-vault.app') => new Request(`https://media-vault.app/api/items/${id}/progress`, { method: 'POST', headers: { origin }, body: JSON.stringify(body) })
beforeEach(() => { vi.resetAllMocks(); mocks.getCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'synthetic' }); mocks.rpc.mockResolvedValue({ data: snapshot, error: null }) })
describe('daily progress authorization and version boundary', () => {
  it('authenticates before any RPC', async () => { mocks.getCurrentUser.mockResolvedValue(null); expect((await POST(request(), context)).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled() })
  it('rejects cross-origin submissions', async () => { expect((await POST(request(input, 'https://untrusted.example'), context)).status).toBe(403); expect(mocks.rpc).not.toHaveBeenCalled() })
  it.each([null, [], { progress: -1, lastProgressAt: null }, { progress: 1.5, lastProgressAt: null }, { progress: 1 }, { ...input, lastProgressAt: 'invalid' }, { ...input, progress: 2147483648 }])('rejects invalid versions %j', async body => { expect((await POST(request(body), context)).status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled() })
  it('rejects oversized bodies', async () => expect((await POST(request({ ...input, extra: 'x'.repeat(2000) }), context)).status).toBe(413))
  it('passes the original version to one atomic owner-scoped RPC and returns its exact timestamp', async () => {
    const response = await POST(request(), context)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ data: snapshot })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('advance_item_progress', { p_item_id: id, p_expected_progress: 0, p_expected_last_progress_at: null })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
  })
  it('returns a conflict snapshot without issuing a second increment', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...snapshot, outcome: 'conflict' }, error: null })
    expect((await POST(request(), context)).status).toBe(409)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
  it('hides missing and foreign items', async () => { mocks.rpc.mockResolvedValue({ data: null, error: null }); expect((await POST(request(), context)).status).toBe(404) })
  it('does not expose database failure details or use a read/write fallback', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'SECRET INTERNAL' } })
    const response = await POST(request(), context)
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('SECRET')
  })
  it('rejects a mismatched or malformed returned identity', async () => { mocks.rpc.mockResolvedValue({ data: { ...snapshot, id: 'other-item' }, error: null }); expect((await POST(request(), context)).status).toBe(503) })
})
