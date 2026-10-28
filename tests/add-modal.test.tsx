// @vitest-environment jsdom

import type { ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type MediaItemForm from '../components/MediaItemForm'
import type { CatalogSearchCandidate } from '../lib/catalog-types'
import { t, type MessageKey } from '../lib/i18n'

const mocks = vi.hoisted(() => ({ createItemAction: vi.fn(), refresh: vi.fn(), showToast: vi.fn() }))
vi.mock('../app/actions/items', () => mocks)
vi.mock('../app/actions/storage', () => ({ uploadCoverAction: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('../components/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: MessageKey) => t('en', key) }) }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: mocks.showToast }) }))
vi.mock('../components/ModalFrame', () => ({ default: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => isOpen ? <div role="dialog">{children}</div> : null }))
vi.mock('../components/MediaItemForm', () => ({ default: ({ form, onChange, onSubmit, isSubmitting, errorMessage }: ComponentProps<typeof MediaItemForm>) => (
  <form onSubmit={onSubmit}>
    <input aria-label="Title" value={form.title} onChange={(event) => onChange('title', event.target.value)} />
    <textarea aria-label="Notes" value={form.notes} onChange={(event) => onChange('notes', event.target.value)} />
    <p role="alert">{errorMessage}</p><button disabled={isSubmitting} type="submit">Save fixture</button>
  </form>
) }))
import AddModal from '../components/AddModal'
import { dispatchOpenAddModal } from '../lib/add-modal-events'

const candidate: CatalogSearchCandidate = { id: 'anilist:20', provider: 'AniList', title: 'Fixture', type: 'Anime', status: 'Planning', description: 'Not notes', genres: '', imageUrl: '', score: 1, subtitle: null, totalProgress: '12', year: null }
beforeEach(() => {
  mocks.createItemAction.mockResolvedValue({ success: true })
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: [] })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function open() {
  render(<AddModal listenForExternalOpen />)
  act(() => dispatchOpenAddModal({ candidate }))
}

describe('Add New catalog save', () => {
  it('sends the selected ID, preserves exact notes and closes after success', async () => {
    open()
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: '  **Draft**\n' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save fixture' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.createItemAction).toHaveBeenCalledWith(expect.objectContaining({ notes: '  **Draft**\n' }), 'anilist:20')
  })
  it('clears identity when the user changes the selected title', async () => {
    open()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Manually changed title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save fixture' }))
    await waitFor(() => expect(mocks.createItemAction).toHaveBeenCalledWith(expect.anything(), undefined))
  })
  it('keeps drafts and enables retry after a transport error', async () => {
    mocks.createItemAction.mockRejectedValueOnce(new Error('Offline'))
    open()
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: '**Keep draft**' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save fixture' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Your draft is still here'))
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('**Keep draft**')
    expect((screen.getByRole('button', { name: 'Save fixture' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
