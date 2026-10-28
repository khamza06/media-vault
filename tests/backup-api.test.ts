import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getItemsForBackupExport: vi.fn(), getCollectionsForBackupExport: vi.fn() }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/data/items', () => mocks)
vi.mock('../lib/data/backup-collections', () => mocks)
import { GET } from '../app/api/backup/route'
const record = { id: 'fixture', title: 'Fixture', type: 'Anime', status: 'Watching', progress: 5, notes: '  **Keep**\n', external_source: 'anilist', external_id: '20' }
beforeEach(() => { mocks.getCurrentUser.mockResolvedValue({ id: 'owner' }); mocks.getItemsForBackupExport.mockResolvedValue({ data: [record], error: null }); mocks.getCollectionsForBackupExport.mockResolvedValue({ lists: [], error: null, warning: null }) })
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
    expect(mocks.getCollectionsForBackupExport).toHaveBeenCalledWith([record.id])
  })
  it('keeps CSV available with private caching and does not leak database errors', async () => {
    const response = await GET(new Request('https://media-vault.app/api/backup?format=csv'))
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.getCollectionsForBackupExport).not.toHaveBeenCalled()
    mocks.getItemsForBackupExport.mockResolvedValue({ data: null, error: { message: 'Private database detail' } })
    expect(await (await GET(new Request('https://media-vault.app/api/backup'))).text()).not.toContain('Private database detail')
  })
  it('does not emit a partial JSON export when lists cannot be read', async () => {
    mocks.getCollectionsForBackupExport.mockResolvedValue({ lists: undefined, error: 'Could not read all lists.', warning: null })
    expect((await GET(new Request('https://media-vault.app/api/backup'))).status).toBe(500)
  })
})
