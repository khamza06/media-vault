import { render } from './render-with-locale'
// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ createListAction: vi.fn(), deleteListAction: vi.fn(), updateListAction: vi.fn(), updateListSharingAction: vi.fn(), addItemsToListAction: vi.fn(), removeItemFromListAction: vi.fn(), showToast: vi.fn(), refresh: vi.fn() }))
vi.mock('../app/actions/lists', () => mocks)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: mocks.showToast }) }))
import CustomListsManager from '../components/lists/CustomListsManager'
import ListDetailManager from '../components/lists/ListDetailManager'
import { toMediaItem } from '../lib/media'

const list = { id: 'list', name: 'Favorites', description: 'Original description', isPublic: false, slug: null, itemCount: 0, createdAt: null, updatedAt: null }
const item = toMediaItem({ id: 'item', title: 'Fixture title', type: 'Anime', status: 'Planning', notes: '  Keep\n' })
beforeEach(() => {
  for (const action of [mocks.createListAction, mocks.deleteListAction, mocks.updateListAction, mocks.updateListSharingAction, mocks.addItemsToListAction, mocks.removeItemFromListAction]) action.mockRejectedValue(new Error('Network interrupted'))
})
afterEach(cleanup)

describe('list transport recovery', () => {
  it('releases Create and keeps its draft without claiming the server did not write', async () => {
    render(<CustomListsManager lists={[]} profile={null} sharingReady />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Draft list' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Draft description' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Create list' }) as HTMLButtonElement).disabled).toBe(false))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Draft list')
    expect(mocks.showToast).toHaveBeenCalledWith(expect.stringContaining('Some changes may have saved'), 'error')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
  it.each(['edit', 'sharing', 'delete'] as const)('releases %s and preserves its confirmation/form after transport failure', async (kind) => {
    render(<CustomListsManager lists={[list]} profile={null} sharingReady />)
    const trigger = kind === 'edit' ? 'Edit Favorites' : kind === 'sharing' ? 'Sharing settings for Favorites' : 'Delete Favorites'
    const save = kind === 'edit' ? 'Save changes' : kind === 'sharing' ? 'Save sharing' : 'Delete list'
    fireEvent.click(screen.getByRole('button', { name: trigger }))
    fireEvent.click(screen.getByRole('button', { name: save }))
    await waitFor(() => expect((screen.getByRole('button', { name: save }) as HTMLButtonElement).disabled).toBe(false))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(mocks.showToast).toHaveBeenCalledWith(expect.stringContaining('Refresh and review'), 'error')
    expect(screen.getByRole('link', { name: 'Preview Favorites' })).toBeTruthy()
  })
  it('guards duplicate create requests while pending and keeps inputs disabled', async () => {
    let resolve: (result: { success: boolean; error: string }) => void = () => {}
    mocks.createListAction.mockReturnValue(new Promise((done) => { resolve = done }))
    render(<CustomListsManager lists={[]} profile={null} sharingReady />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Draft' } })
    const form = screen.getByRole('button', { name: 'Create list' }).closest('form')!
    fireEvent.submit(form); fireEvent.submit(form)
    expect(mocks.createListAction).toHaveBeenCalledTimes(1)
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true)
    resolve({ success: false, error: 'Try again' })
    await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(false))
  })
  it('releases remove without removing the item or calling a vault delete', async () => {
    render(<ListDetailManager list={{ ...list, items: [item] }} availableItems={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }))
    await waitFor(() => expect((screen.getByRole('button', { name: /Remove/ }) as HTMLButtonElement).disabled).toBe(false))
    expect(screen.getByText(item.title)).toBeTruthy()
    expect(mocks.removeItemFromListAction).toHaveBeenCalledExactlyOnceWith(list.id, item.id)
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
  it('releases Add and keeps selection on failure', async () => {
    render(<ListDetailManager list={{ ...list, items: [] }} availableItems={[item]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add items' }))
    fireEvent.click(screen.getByRole('button', { name: /Fixture title/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add 1' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Add 1' }) as HTMLButtonElement).disabled).toBe(false))
    expect(mocks.addItemsToListAction).toHaveBeenCalledExactlyOnceWith(list.id, [item.id])
    expect(screen.getByText('Selected 1 of 1 available')).toBeTruthy()
  })
  it('reconciles server-refreshed membership instead of retaining a stale optimistic grid', async () => {
    const view = render(<ListDetailManager list={{ ...list, items: [] }} availableItems={[item]} />)
    expect(screen.getByText('This list is empty.')).toBeTruthy()
    view.rerender(<ListDetailManager list={{ ...list, items: [item] }} availableItems={[]} />)
    await waitFor(() => expect(screen.queryByText('This list is empty.')).toBeNull())
    expect(screen.getByText(item.title)).toBeTruthy()
  })
})
