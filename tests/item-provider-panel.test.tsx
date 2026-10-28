// @vitest-environment jsdom

import type { ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type AppSelect from '../components/ui/AppSelect'
const mocks = vi.hoisted(() => ({ quickUpdateItemAction: vi.fn(), refresh: vi.fn() }))
vi.mock('../app/actions/items', () => mocks)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../components/ui/AppSelect', () => ({ default: ({ value, onValueChange, options, ariaLabel, disabled }: ComponentProps<typeof AppSelect>) => (
  <select aria-label={ariaLabel} value={value} disabled={disabled} onChange={(event) => onValueChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
) }))
import ItemProviderPanel from '../components/ItemProviderPanel'
import ItemQuickEditPanel from '../components/ItemQuickEditPanel'
import { toMediaItem } from '../lib/media'

const details = { provider: 'AniList', title: 'Provider title', url: 'https://anilist.co/anime/20', description: 'Provider synopsis', year: '2002', format: 'TV', durationMinutes: 23, genres: ['Action'] }
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: details })))
  mocks.quickUpdateItemAction.mockResolvedValue({ success: true })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('on-demand details and notes drafts', () => {
  it('fetches only after expanding and reuses the same details when reopened', async () => {
    render(<ItemProviderPanel itemId="fixture" supported />)
    expect(fetch).not.toHaveBeenCalled()
    const toggle = screen.getByRole('button', { name: /About this title/ })
    fireEvent.click(toggle)
    await screen.findByText('Provider synopsis')
    expect(screen.getByRole('link', { name: /Open on AniList/ }).getAttribute('href')).toBe(details.url)
    fireEvent.click(toggle); fireEvent.click(toggle)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('does not request guessed metadata without a supported ID', () => {
    render(<ItemProviderPanel itemId="fixture" supported={false} />)
    fireEvent.click(screen.getByRole('button', { name: /About this title/ }))
    expect(screen.getByText(/no supported provider ID/)).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('supports retry after provider errors', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Offline'))
    render(<ItemProviderPanel itemId="fixture" supported />)
    fireEvent.click(screen.getByRole('button', { name: /About this title/ }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('Provider synopsis')
  })
  it('keeps an exact unsaved Markdown draft while toggling provider/notes previews and saving rating', async () => {
    const item = toMediaItem({ id: 'fixture', title: 'Fixture', type: 'Anime', status: 'Watching', notes: '' })
    render(<><ItemQuickEditPanel item={item} /><ItemProviderPanel itemId="fixture" supported /></>)
    const notes = '  **Draft notes**\n\n- first  \n'
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: notes } })
    fireEvent.click(screen.getByRole('button', { name: /About this title/ }))
    await screen.findByText('Provider synopsis')
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByText('Draft notes', { exact: true })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('My rating'), { target: { value: '8' } })
    await waitFor(() => expect(mocks.quickUpdateItemAction).toHaveBeenCalledWith('fixture', { rating: 8 }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit notes' }))
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe(notes)
    expect(screen.getByText('You have unsaved notes.')).toBeTruthy()
  })
  it('keeps a failed notes save retryable without replacing the draft', async () => {
    mocks.quickUpdateItemAction.mockRejectedValueOnce(new Error('Offline'))
    render(<ItemQuickEditPanel item={toMediaItem({ id: 'fixture', title: 'Fixture', type: 'Anime', status: 'Watching' })} />)
    const notes = '  **Unchanged**\n'
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: notes } })
    fireEvent.click(screen.getByRole('button', { name: 'Save notes' }))
    await screen.findByText(/Your draft is still here/)
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe(notes)
    fireEvent.click(screen.getByRole('button', { name: 'Save notes' }))
    await screen.findByText('Notes saved.')
    expect(mocks.quickUpdateItemAction).toHaveBeenLastCalledWith('fixture', { notes })
  })
})
