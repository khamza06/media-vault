// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ restoreBackupItemsAction: vi.fn() }))
vi.mock('../app/actions/backup', () => mocks)
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
