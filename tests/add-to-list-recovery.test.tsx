// @vitest-environment jsdom

import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ addItemToListsAction: vi.fn(), refresh: vi.fn(), showToast: vi.fn() }))
vi.mock('../app/actions/lists', () => mocks)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: mocks.showToast }) }))
import AddToListButton from '../components/lists/AddToListButton'
const lists = [{ id: 'list-a', name: 'Favorites', itemCount: 0 }, { id: 'list-b', name: 'Watch later', itemCount: 2 }]
const descriptors = new Map(['showModal', 'close'].map((key) => [key, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key)]))
beforeEach(() => {
  mocks.addItemToListsAction.mockResolvedValue({ success: true, added: 1, skipped: 0, failed: 0, error: null })
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
function open() {
  render(<StrictMode><AddToListButton itemId="item" itemTitle="Fixture title" lists={lists} /></StrictMode>)
  fireEvent.click(screen.getByRole('button', { name: 'Add Fixture title to a custom list' }))
  fireEvent.click(screen.getByRole('button', { name: 'Favorites 0 items' }))
}

describe('Add to list dialog request recovery', () => {
  it('releases loading, retains selection and admits unknown writes after transport failure', async () => {
    mocks.addItemToListsAction.mockRejectedValueOnce(new Error('Private network diagnostics'))
    open(); fireEvent.click(screen.getByRole('button', { name: 'Add to 1 list' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Some list additions may have saved')
    expect(screen.getByRole('button', { name: 'Favorites 0 items' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByRole('button', { name: 'Add to 1 list' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(false)
    expect(mocks.addItemToListsAction).toHaveBeenCalledExactlyOnceWith('item', ['list-a'])
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(screen.queryByText(/Private network diagnostics/)).toBeNull()
  })
  it('guards same-tick double submission and Escape/close while pending', async () => {
    let finish: (value: unknown) => void = () => {}
    mocks.addItemToListsAction.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    open()
    const save = screen.getByRole('button', { name: 'Add to 1 list' })
    act(() => { fireEvent.click(save); fireEvent.click(save) })
    expect(mocks.addItemToListsAction).toHaveBeenCalledOnce()
    const cancel = new Event('cancel', { bubbles: true, cancelable: true })
    fireEvent(screen.getByRole('dialog'), cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect((screen.getByRole('button', { name: 'Close add to list dialog' }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => finish({ success: false, added: 0, skipped: 0, failed: 1, error: 'Try again' }))
    expect((screen.getByRole('button', { name: 'Add to 1 list' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('keeps structured failure selection and supports an explicit safe retry', async () => {
    mocks.addItemToListsAction.mockResolvedValueOnce({ success: false, added: 0, skipped: 0, failed: 1, error: 'The list is unavailable.' })
    open(); fireEvent.click(screen.getByRole('button', { name: 'Add to 1 list' }))
    await screen.findByText('The list is unavailable.')
    fireEvent.click(screen.getByRole('button', { name: 'Add to 1 list' }))
    await screen.findByText('Added to 1 list.')
    expect(mocks.addItemToListsAction).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Favorites 0 items' }).getAttribute('aria-pressed')).toBe('false')
  })
  it('reports duplicates without another addition or a false failure', async () => {
    mocks.addItemToListsAction.mockResolvedValueOnce({ success: true, added: 0, skipped: 1, failed: 0, error: null })
    open(); fireEvent.click(screen.getByRole('button', { name: 'Add to 1 list' }))
    await screen.findByText('This item was already in the selected lists.')
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('retains selection and shows counts instead of claiming all lists succeeded on a partial result', async () => {
    mocks.addItemToListsAction.mockResolvedValueOnce({ success: false, added: 1, skipped: 0, failed: 1, error: 'One list failed.' })
    open(); fireEvent.click(screen.getByRole('button', { name: 'Watch later 2 items' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to 2 lists' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('status').textContent).toContain('Added to 1 list. Skipped 0. Failed 1.')
    expect(screen.getByRole('button', { name: 'Favorites 0 items' }).getAttribute('aria-pressed')).toBe('true')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
  it('resets only its local dialog selection on cancel and assigns unique dialog titles', () => {
    render(<><AddToListButton itemId="a" itemTitle="A" lists={lists} /><AddToListButton itemId="b" itemTitle="B" lists={lists} /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Add A to a custom list' }))
    const firstTitle = screen.getByRole('dialog').getAttribute('aria-labelledby')
    fireEvent.click(screen.getByRole('button', { name: 'Favorites 0 items' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add B to a custom list' }))
    expect(screen.getByRole('dialog').getAttribute('aria-labelledby')).not.toBe(firstTitle)
    expect(screen.getByRole('button', { name: 'Favorites 0 items' }).getAttribute('aria-pressed')).toBe('false')
    expect(mocks.addItemToListsAction).not.toHaveBeenCalled()
  })
})
