// @vitest-environment jsdom

import type { ComponentProps } from 'react'
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type AppSelect from '../components/ui/AppSelect'
const mocks = vi.hoisted(() => ({ bulkUpdateItemsAction: vi.fn(), addItemsToListAction: vi.fn(), refresh: vi.fn(), showToast: vi.fn() }))
vi.mock('../app/actions/bulk-items', () => mocks)
vi.mock('../app/actions/lists', () => mocks)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: mocks.showToast }) }))
vi.mock('../components/ui/AppSelect', () => ({ default: ({ ariaLabel, value, onValueChange, options, disabled, portalContainer }: ComponentProps<typeof AppSelect>) => (
  <select aria-label={ariaLabel} data-container={portalContainer?.tagName} value={value} disabled={disabled} onChange={(event) => onValueChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
) }))
import BulkItemActions from '../components/BulkItemActions'
import { toMediaItem } from '../lib/media'

const item = toMediaItem({ id: '11111111-1111-4111-8111-111111111111', title: 'Fixture', type: 'Anime', status: 'Watching' })
function props() { return { items: [item], lists: [{ id: 'list', name: 'Favorites', itemCount: 0 }], onUpdated: vi.fn(), onDone: vi.fn() } }
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; queueMicrotask(() => this.dispatchEvent(new Event('close'))) } })
  mocks.bulkUpdateItemsAction.mockResolvedValue({ success: true, updated: 1, skipped: 0, failed: 0, updatedIds: [item.id], error: null })
  mocks.addItemsToListAction.mockResolvedValue({ success: true, added: 0, skipped: 1 })
})
afterEach(() => { cleanup(); Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close') })

describe('reviewed bulk changes', () => {
  it('requires a review/apply step and mounts dropdowns inside the native dialog', async () => {
    const input = props()
    render(<StrictMode><BulkItemActions {...input} /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Change status' }))
    expect(mocks.bulkUpdateItemsAction).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Change selected statuses' })).toBeTruthy()
    expect(screen.getByLabelText('New status').getAttribute('data-container')).toBe('DIALOG')
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }))
    await waitFor(() => expect(input.onDone).toHaveBeenCalledOnce())
    expect(mocks.bulkUpdateItemsAction).toHaveBeenCalledWith([item.id], { kind: 'status', status: 'Completed' })
    expect(input.onUpdated).toHaveBeenCalledWith({ kind: 'status', status: 'Completed' }, [item.id])
  })
  it('reuses the existing membership action and reports skipped duplicates', async () => {
    render(<BulkItemActions {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add to list' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }))
    await waitFor(() => expect(mocks.addItemsToListAction).toHaveBeenCalledWith('list', [item.id]))
    expect(mocks.bulkUpdateItemsAction).not.toHaveBeenCalled()
    expect(mocks.showToast).toHaveBeenCalledWith(expect.stringContaining('Skipped 1'))
  })
  it('keeps selection/retry available on a transport error', async () => {
    mocks.bulkUpdateItemsAction.mockRejectedValueOnce(new Error('Offline'))
    const input = props()
    render(<BulkItemActions {...input} />)
    fireEvent.click(screen.getByRole('button', { name: 'Favorite settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }))
    await screen.findByRole('alert')
    expect(input.onDone).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Apply changes' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('explains the 500-item limit before submitting', () => {
    render(<BulkItemActions {...props()} items={Array(501).fill(item)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Change status' }))
    expect(screen.getByRole('alert').textContent).toContain('500')
    expect((screen.getByRole('button', { name: 'Apply changes' }) as HTMLButtonElement).disabled).toBe(true)
    expect(mocks.bulkUpdateItemsAction).not.toHaveBeenCalled()
  })
  it('does not submit twice or allow cancellation while a confirmed write is pending', async () => {
    let finish: ((value: unknown) => void) | undefined
    mocks.bulkUpdateItemsAction.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    render(<BulkItemActions {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Change status' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Applying...' }))
    const dialog = screen.getByRole('dialog')
    const cancel = new Event('cancel', { bubbles: true, cancelable: true })
    fireEvent(dialog, cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(mocks.bulkUpdateItemsAction).toHaveBeenCalledOnce()
    await act(async () => finish?.({ success: true, updated: 1, updatedIds: [item.id], skipped: 0, failed: 0 }))
  })
})
