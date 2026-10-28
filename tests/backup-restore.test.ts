import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), readAllOwnedBackupItems: vi.fn(), insert: vi.fn(), revalidatePath: vi.fn(), result: { data: [{ id: 'restored' }], error: null } as { data: { id: string }[] | null; error: { message: string } | null } }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/data/backup-items', () => mocks)
vi.mock('../lib/data/items', () => ({ getItemsForBackupExport: vi.fn() }))
vi.mock('next/cache', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from: () => ({ insert: (rows: unknown) => { mocks.insert(rows); return { select: async () => mocks.result } } }) }) }))
import { restoreBackupItemsAction } from '../app/actions/backup'
import { createBackupPayload } from '../lib/backup'
import { toMediaItem } from '../lib/media'

const backup = createBackupPayload([toMediaItem({ id: 'old-id', title: 'Fixture', type: 'Anime', status: 'Watching', notes: '  **Notes**  \n', progress: 5, total_progress: 12, rating: 8, external_source: 'anilist', external_id: '20' })]).items[0]
beforeEach(() => {
  mocks.getCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'fixture-not-a-token' })
  mocks.readAllOwnedBackupItems.mockResolvedValue({ data: [], error: null })
  mocks.result = { data: [{ id: 'restored' }], error: null }
})
describe('backup restore safety', () => {
  it('preserves exact notes/progress and never invents a progress date or restores an old owner/ID', async () => {
    expect(await restoreBackupItemsAction([backup])).toMatchObject({ restored: 1, success: true })
    expect(mocks.insert.mock.calls[0][0][0]).toMatchObject({ user_id: 'owner', notes: backup.notes, progress: 5, rating: 8, last_progress_at: null, external_source: 'anilist', external_id: '20' })
    expect(mocks.insert.mock.calls[0][0][0]).not.toHaveProperty('id')
  })
  it('does not confuse TMDB movie and TV IDs with the same numeric value', async () => {
    mocks.readAllOwnedBackupItems.mockResolvedValue({ data: [{ id: 'existing', title: 'Other title', type: 'Movie', external_source: 'tmdb', external_id: '1' }], error: null })
    expect(await restoreBackupItemsAction([{ ...backup, title: 'TV fixture', type: 'TV Series', external_source: 'tmdb', external_id: '1' }])).toMatchObject({ restored: 1, skipped: 0 })
  })
  it('recognizes canonical/prefixed provider IDs and skips without overwriting existing notes', async () => {
    mocks.readAllOwnedBackupItems.mockResolvedValue({ data: [{ id: 'existing', title: 'Renamed locally', type: 'TV Series', external_source: 'tmdb', external_id: 'tmdb:tv:1' }], error: null })
    expect(await restoreBackupItemsAction([{ ...backup, type: 'TV Series', external_source: 'tmdb', external_id: '1' }])).toMatchObject({ restored: 0, skipped: 1 })
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('finds title duplicates anywhere in the complete lookup result', async () => {
    mocks.readAllOwnedBackupItems.mockResolvedValue({ data: [...Array.from({ length: 1100 }, (_, index) => ({ id: String(index), title: `Existing ${index}`, type: 'Anime' })), { id: 'last', title: backup.title, type: 'Anime' }], error: null })
    expect(await restoreBackupItemsAction([backup])).toMatchObject({ skipped: 1, restored: 0 })
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('rejects malformed or out-of-range tracking data instead of silently clamping/dropping it', async () => {
    expect(await restoreBackupItemsAction([{ ...backup, progress: 99 }, { ...backup, notes: 123 } as unknown as typeof backup, { ...backup, status: 'Reading' }])).toMatchObject({ invalid: 3, restored: 0, success: false })
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('counts invalid rows separately from skipped duplicates and failed writes', async () => {
    expect(await restoreBackupItemsAction([backup, { ...backup, progress: 99 }])).toMatchObject({ restored: 1, invalid: 1, skipped: 0, failed: 0 })
  })
  it('does not truncate long saved titles or misidentify their title duplicates', async () => {
    const title = 'Long title '.repeat(25).trim()
    await restoreBackupItemsAction([{ ...backup, title }])
    expect(mocks.insert.mock.calls[0][0][0].title).toBe(title)
    mocks.insert.mockClear()
    mocks.readAllOwnedBackupItems.mockResolvedValue({ data: [{ id: 'existing', title, type: backup.type }], error: null })
    expect(await restoreBackupItemsAction([{ ...backup, title }])).toMatchObject({ restored: 0, skipped: 1 })
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('does not claim restored items when the insert did not confirm any rows', async () => {
    mocks.result = { data: null, error: null }
    expect(await restoreBackupItemsAction([backup])).toMatchObject({ restored: 0, failed: 1, success: false })
  })
  it('keeps the saved count when cache invalidation fails', async () => {
    mocks.revalidatePath.mockImplementationOnce(() => { throw new Error('Cache unavailable') })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await restoreBackupItemsAction([backup])).toMatchObject({ restored: 1, success: true })
  })
  it('blocks guests and lookup failures without returning raw database details', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)
    expect((await restoreBackupItemsAction([backup])).success).toBe(false)
    expect(mocks.readAllOwnedBackupItems).not.toHaveBeenCalled()
    mocks.readAllOwnedBackupItems.mockResolvedValue({ data: null, error: { message: 'private database detail' } })
    expect((await restoreBackupItemsAction([backup])).error).not.toContain('private database detail')
    expect(mocks.insert).not.toHaveBeenCalled()
  })
})
