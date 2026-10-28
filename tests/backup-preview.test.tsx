// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ restoreBackupItemsAction: vi.fn(), restoreBackupCollectionsAction: vi.fn() }))
vi.mock('../app/actions/backup', () => mocks)
vi.mock('../app/actions/backup-collections', () => mocks)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
import ImportBackupForm from '../components/ImportBackupForm'
const row = { id: 'fixture', title: 'Fixture', type: 'Anime', status: 'Watching', progress: 5, total_progress: 12, notes: '  **Keep**\n' }
beforeEach(() => mocks.restoreBackupItemsAction.mockResolvedValue({ success: true, restored: 1, skipped: 0, invalid: 0, failed: 0, usedExternalIdColumns: true }))
afterEach(cleanup)
function upload(value: unknown) {
  const file = new File(['fixture'], 'backup.json', { type: 'application/json' })
  Object.defineProperty(file, 'text', { value: async () => JSON.stringify(value) })
  fireEvent.change(screen.getByLabelText('Media Vault backup file'), { target: { files: [file] } })
}
describe('backup preview validation', () => {
  it('reports malformed original dates before any restore is enabled', async () => {
    render(<ImportBackupForm />); upload([{ ...row, created_at: 'invalid timestamp' }])
    await screen.findByText('Added date must be a valid timestamp or empty.')
    expect((screen.getByRole('button', { name: 'Restore selected items' }) as HTMLButtonElement).disabled).toBe(true)
    expect(mocks.restoreBackupItemsAction).not.toHaveBeenCalled()
    expect(mocks.restoreBackupCollectionsAction).not.toHaveBeenCalled()
  })
  it('releases pending state and keeps the selected lists after a transport failure', async () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const list = { id: '22222222-2222-4222-8222-222222222222', name: 'Retry list', description: null, item_ids: [id] }
    mocks.restoreBackupCollectionsAction.mockRejectedValueOnce(new Error('Network interrupted'))
    render(<ImportBackupForm />); upload({ app: 'Media Vault', version: 2, items: [{ ...row, id }], lists: [list] })
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Restore list Retry list' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore selected items and lists' }))
    await screen.findByText(/Could not finish restoring/)
    expect((screen.getByRole('checkbox', { name: 'Restore list Retry list' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('button', { name: 'Restore selected items and lists' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('previews v2 lists as opt-in and only sends selected items/lists after explicit restore', async () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const list = { id: '22222222-2222-4222-8222-222222222222', name: 'Favorites', description: '  Keep description\n', item_ids: [id] }
    mocks.restoreBackupCollectionsAction.mockResolvedValue({ success: true, restored: 1, skipped: 0, failed: 0, invalid: 0, usedExternalIdColumns: true, listsRestored: 1, listsSkipped: 0, listsFailed: 0, membershipsRestored: 1, membershipsSkipped: 0, membershipsFailed: 0, warnings: [] })
    render(<ImportBackupForm />); upload({ app: 'Media Vault', version: 2, items: [{ ...row, id }], lists: [list] })
    await screen.findByRole('checkbox', { name: 'Restore list Favorites' })
    expect((screen.getByRole('checkbox', { name: 'Restore list Favorites' }) as HTMLInputElement).checked).toBe(false)
    expect(mocks.restoreBackupCollectionsAction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Restore list Favorites' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore selected items and lists' }))
    await waitFor(() => expect(mocks.restoreBackupCollectionsAction).toHaveBeenCalledWith({ items: [expect.objectContaining({ id, notes: row.notes })], lists: [list] }))
    expect(mocks.restoreBackupItemsAction).not.toHaveBeenCalled()
    await screen.findByText(/Lists: restored 1/)
  })
  it('rejects broken v2 references before enabling restore', async () => {
    render(<ImportBackupForm />); upload({ app: 'Media Vault', version: 2, items: [], lists: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Broken', item_ids: ['11111111-1111-4111-8111-111111111111'] }] })
    await screen.findByText('A list references an item missing from this backup.')
    expect(mocks.restoreBackupCollectionsAction).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Restore selected items' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('does not restore on upload and preserves selected Markdown until explicit restore', async () => {
    render(<ImportBackupForm />); upload({ app: 'Media Vault', version: 1, items: [row] })
    await screen.findByText(/Backup parsed/)
    expect(mocks.restoreBackupItemsAction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Restore selected items' }))
    await waitFor(() => expect(mocks.restoreBackupItemsAction).toHaveBeenCalledWith([expect.objectContaining({ notes: row.notes, progress: 5 })]))
  })
  it('rejects unsupported versions rather than importing their items silently', async () => {
    render(<ImportBackupForm />); upload({ app: 'Media Vault', version: 99, items: [row] })
    await screen.findByText('Backup file format is not recognized.')
    expect((screen.getByRole('button', { name: 'Restore selected items' }) as HTMLButtonElement).disabled).toBe(true)
    expect(mocks.restoreBackupItemsAction).not.toHaveBeenCalled()
  })
  it('marks mismatched status and excessive progress invalid before restore', async () => {
    render(<ImportBackupForm />); upload([ { ...row, status: 'Reading' }, { ...row, id: 'other', progress: 30 } ])
    await screen.findByText('Unsupported status for this media type.')
    expect(screen.getByText('Progress cannot exceed the total.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Restore selected items' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
