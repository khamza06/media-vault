import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ requireCurrentUser: vi.fn(), eq: vi.fn(), limit: vi.fn(), remove: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from: () => ({ select: () => query }), storage: { from: () => ({ remove: mocks.remove }) } }) }))
import { deleteOwnedCoverByPublicUrl } from '../lib/data/storage'
const query = { eq: mocks.eq, limit: mocks.limit }
const url = 'https://fixture.supabase.co/storage/v1/object/public/media-covers/owner/cover.png'
beforeEach(() => {
  mocks.requireCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'synthetic' })
  mocks.eq.mockReturnValue(query)
  mocks.limit.mockResolvedValue({ data: [], error: null })
  mocks.remove.mockResolvedValue({ error: null })
})
describe('post-commit cover cleanup', () => {
  it('preserves a cover still referenced by another owned item', async () => {
    mocks.limit.mockResolvedValue({ data: [{ id: 'other-item' }], error: null })
    await deleteOwnedCoverByPublicUrl(url)
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(mocks.eq).toHaveBeenCalledWith('image_url', url)
  })
  it('removes an unreferenced cover but fails safe if reference lookup fails', async () => {
    await deleteOwnedCoverByPublicUrl(url)
    expect(mocks.remove).toHaveBeenCalledWith(['owner/cover.png'])
    mocks.remove.mockClear()
    mocks.limit.mockResolvedValue({ data: null, error: { message: 'offline' } })
    await deleteOwnedCoverByPublicUrl(url)
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('does not turn a committed item write into a failure when Storage throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.remove.mockRejectedValue(new Error('offline'))
    await expect(deleteOwnedCoverByPublicUrl(url)).resolves.toBeUndefined()
  })
  it('never deletes a foreign folder or an unrelated provider image', async () => {
    await deleteOwnedCoverByPublicUrl(url.replace('/owner/', '/other/'))
    await deleteOwnedCoverByPublicUrl('https://provider.invalid/cover.png')
    expect(mocks.limit).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
  })
})
