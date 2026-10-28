// @vitest-environment jsdom

import type { ComponentProps } from 'react'
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type ShelfItemCard from '../components/ShelfItemCard'
import { t, type MessageKey } from '../lib/i18n'
const mocks = vi.hoisted(() => ({ deleteItemsBulkAction: vi.fn(), incrementProgressAction: vi.fn(), refresh: vi.fn(), showToast: vi.fn() }))
vi.mock('../app/actions/items', () => mocks)
vi.mock('next/navigation', () => ({ usePathname: () => '/shelves/anime', useSearchParams: () => params, useRouter: () => ({ refresh: mocks.refresh, replace: vi.fn() }) }))
vi.mock('../components/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: MessageKey, vars?: Record<string, string | number>) => t('en', key, vars) }) }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: mocks.showToast }) }))
vi.mock('../components/LibraryFilterControls', () => ({ default: ({ actions }: { actions?: React.ReactNode }) => <div>{actions}</div> }))
vi.mock('../components/BulkItemActions', () => ({ default: () => null }))
vi.mock('../components/DiscoverRecommendationCard', () => ({ default: () => null }))
vi.mock('../components/onboarding/SetupChecklist', () => ({ default: () => null }))
vi.mock('../components/ShelfItemCard', () => ({ default: ({ item, isSelected, onToggleSelection }: ComponentProps<typeof ShelfItemCard>) => <button type="button" aria-pressed={isSelected} onClick={() => onToggleSelection?.(item)}>Choose {item.title}</button> }))
import HomeShelvesView from '../components/HomeShelvesView'
import ShelfGridView from '../components/ShelfGridView'
import { useBulkDeleteRequest } from '../components/useBulkDeleteRequest'
import { toMediaItem } from '../lib/media'
const params = new URLSearchParams()
const items = ['Alpha', 'Beta'].map((title, i) => toMediaItem({ id: `item-${i}`, title, type: 'Anime', status: 'Planning', notes: '  **Keep**\n', progress: 3 }))
const descriptors = new Map(['showModal', 'close'].map((key) => [key, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key)]))
beforeEach(() => {
  mocks.deleteItemsBulkAction.mockResolvedValue({ success: true, deleted: 2, failed: 0, deletedIds: items.map((item) => item.id), error: null })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { if (this.open) { this.open = false; queueMicrotask(() => this.dispatchEvent(new Event('close'))) } } })
})
afterEach(() => {
  cleanup()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
  }
})
function open(view: string) {
  render(view === 'home' ? <HomeShelvesView items={items} listOptions={[]} recommendations={[]} onboardingState={{ itemCount: 2, importedItemCount: 0, isProfilePublic: false, listCount: 0, listsReady: true, profileReady: false, username: null }} /> : <ShelfGridView title="Anime" description="Fixture" items={items} listOptions={[]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Select' }))
  fireEvent.click(screen.getByRole('button', { name: 'Select all visible' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }))
}
function HookHarness() {
  const [ids, setIds] = useState(['a', 'b'])
  const [complete, setComplete] = useState(false)
  const request = useBulkDeleteRequest({ onDeleted: (removed) => setIds((current) => current.filter((id) => !removed.has(id))), onComplete: () => setComplete(true) })
  return <><output>{ids.join(',')}</output><output>{complete ? 'Complete' : 'Review'}</output>{request.error ? <p role="alert">{request.error}</p> : null}<button disabled={request.isDeleting} onClick={() => void request.deleteSelected(ids)}>Delete fixture</button></>
}
describe('bulk delete client recovery', () => {
  it('focuses Cancel and returns focus to Delete selected without deleting anything', () => {
    render(<ShelfGridView title="Anime" description="Fixture" items={items} listOptions={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select all visible' }))
    const trigger = screen.getByRole('button', { name: 'Delete selected' })
    trigger.focus()
    fireEvent.click(trigger)
    const cancel = within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.click(cancel)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(mocks.deleteItemsBulkAction).not.toHaveBeenCalled()
  })
  it('blocks Escape, cancel and duplicate confirmation while a reviewed delete is pending', async () => {
    let finish: (value: unknown) => void = () => {}
    mocks.deleteItemsBulkAction.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    open('shelf')
    const button = screen.getByRole('button', { name: 'Delete 2 items' })
    act(() => { fireEvent.click(button); fireEvent.click(button) })
    const dialog = screen.getByRole('dialog')
    const cancel = new Event('cancel', { bubbles: true, cancelable: true })
    fireEvent(dialog, cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect((within(dialog).getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true)
    expect(mocks.deleteItemsBulkAction).toHaveBeenCalledOnce()
    await act(async () => finish({ success: false, deleted: 0, failed: 2, error: 'Try again' }))
    expect((within(dialog).getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it.each(['home', 'shelf'])('retains %s selection/dialog and releases pending state after a transport error', async (view) => {
    mocks.deleteItemsBulkAction.mockRejectedValueOnce(new Error('Connection interrupted'))
    open(view); fireEvent.click(screen.getByRole('button', { name: 'Delete 2 items' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('Some items may have been deleted')
    expect((screen.getByRole('button', { name: 'Delete 2 items' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('Selected 2 items')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose Alpha' })).toBeTruthy()
    expect((within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(false)
    expect(mocks.deleteItemsBulkAction).toHaveBeenCalledOnce()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
  it.each(['home', 'shelf'])('removes only confirmed %s cards after a partial delete and keeps the rest selected', async (view) => {
    mocks.deleteItemsBulkAction.mockResolvedValueOnce({ success: true, deleted: 1, failed: 1, deletedIds: ['item-0'], error: null })
    open(view); fireEvent.click(screen.getByRole('button', { name: 'Delete 2 items' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Choose Alpha' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Choose Beta' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Selected 1 item')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete 1 item' })).toBeTruthy()
    expect(items[1].notes).toBe('  **Keep**\n'); expect(items[1].progress).toBe(3)
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
  it('guards same-tick repeated calls and completes only once after all IDs are confirmed', async () => {
    let finish: (value: unknown) => void = () => {}
    mocks.deleteItemsBulkAction.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    render(<HookHarness />)
    const button = screen.getByRole('button', { name: 'Delete fixture' })
    act(() => { fireEvent.click(button); fireEvent.click(button) })
    expect(mocks.deleteItemsBulkAction).toHaveBeenCalledExactlyOnceWith(['a', 'b'])
    await act(async () => finish({ success: true, deleted: 2, failed: 0, deletedIds: ['a', 'b'], error: null }))
    expect(screen.getByText('Complete')).toBeTruthy()
    expect(mocks.showToast).toHaveBeenCalledExactlyOnceWith('Deleted 2 items.')
  })
  it('does not guess removed rows from a legacy partial count; it refreshes for review', async () => {
    mocks.deleteItemsBulkAction.mockResolvedValueOnce({ success: true, deleted: 1, failed: 1, error: null })
    render(<HookHarness />); fireEvent.click(screen.getByRole('button', { name: 'Delete fixture' }))
    await screen.findByRole('alert')
    expect(screen.getByText('a,b')).toBeTruthy()
    expect(screen.getByText('Review')).toBeTruthy()
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
  it('retains all rows after a structured denial and permits explicit review/cancel', async () => {
    mocks.deleteItemsBulkAction.mockResolvedValueOnce({ success: false, deleted: 0, failed: 2, error: 'Sign in again.' })
    render(<HookHarness />); fireEvent.click(screen.getByRole('button', { name: 'Delete fixture' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Sign in again.'))
    expect(screen.getByText('a,b')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Delete fixture' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
