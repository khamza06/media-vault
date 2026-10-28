import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getItemsForBackupExport: vi.fn() }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/data/items', () => mocks)
import { GET } from '../app/api/backup/route'
const record = { id: 'fixture', title: 'Fixture', type: 'Anime', status: 'Watching', progress: 5, notes: '  **Keep**\n', external_source: 'anilist', external_id: '20' }
beforeEach(() => { mocks.getCurrentUser.mockResolvedValue({ id: 'owner' }); mocks.getItemsForBackupExport.mockResolvedValue({ data: [record], error: null }) })
describe('private backup downloads', () => {
  it('blocks guests without querying private data', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    expect((await GET(new Request('https://media-vault.app/api/backup'))).status).toBe(401)
    expect(mocks.getItemsForBackupExport).not.toHaveBeenCalled()
  })
  it('keeps JSON private/no-store and preserves notes/progress/provider identity', async () => {
    const response = await GET(new Request('https://media-vault.app/api/backup'))
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect((await response.json()).items[0]).toMatchObject({ notes: record.notes, progress: 5, external_source: 'anilist', external_id: '20' })
  })
  it('keeps CSV available with private caching and does not leak database errors', async () => {
    const response = await GET(new Request('https://media-vault.app/api/backup?format=csv'))
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    mocks.getItemsForBackupExport.mockResolvedValue({ data: null, error: { message: 'Private database detail' } })
    expect(await (await GET(new Request('https://media-vault.app/api/backup'))).text()).not.toContain('Private database detail')
  })
})
