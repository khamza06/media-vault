// @vitest-environment jsdom

import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t, type MessageKey } from '../lib/i18n'
vi.mock('../components/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: MessageKey, vars?: Record<string, string | number>) => t('en', key, vars) }) }))
vi.mock('next/navigation', () => ({ usePathname: () => '/shelves/anime' }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
import LibraryTools from '../components/LibraryTools'
import VaultPreferencesProvider from '../components/VaultPreferencesProvider'
import { defaultLibraryFilters } from '../lib/library-filters'
import { toMediaItem } from '../lib/media'
import { parseVaultPreferences, vaultPreferencesKey } from '../lib/vault-preferences'

const items = ['a', 'b'].map((id) => toMediaItem({ id, title: `Planning ${id}`, type: 'Anime', status: 'Planning' }))
function UI({ userId = 'alice' }: { userId?: string | null }) {
  return <VaultPreferencesProvider userId={userId}><LibraryTools filters={{ ...defaultLibraryFilters, status: 'Planning' }} favoritesOnly items={items} returnTo="/shelves/anime?status=Planning&favorites=1" /></VaultPreferencesProvider>
}
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; queueMicrotask(() => this.dispatchEvent(new Event('close'))) } })
})
afterEach(() => { cleanup(); window.localStorage.clear(); Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close') })
function save(name: string) {
  fireEvent.change(screen.getByLabelText('Saved view name'), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Save current view' }))
}
function expand() { fireEvent.click(screen.getByText(/^Saved views \(/)) }

describe('saved view controls', () => {
  it('saves clean links, preserves them across density changes and removes only the chosen view', () => {
    render(<UI />); expand(); save('Watch next')
    expect(screen.getByRole('link', { name: /Watch next/ }).getAttribute('href')).toBe('/shelves/anime?status=Planning&favorites=1')
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }))
    const prefs = parseVaultPreferences(window.localStorage.getItem(vaultPreferencesKey('alice')))
    expect(prefs.view).toBe('compact'); expect(prefs.savedViews).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Remove saved view Watch next' }))
    expect(screen.queryByRole('link', { name: /Watch next/ })).toBeNull()
    expect(parseVaultPreferences(window.localStorage.getItem(vaultPreferencesKey('alice'))).view).toBe('compact')
  })
  it('restores only this account views and blocks duplicate names', () => {
    const view = render(<UI />); expand(); save('Watch next'); save('watch NEXT')
    expect(screen.getByRole('alert').textContent).toContain('already exists')
    view.unmount(); render(<UI userId="bob" />); expand()
    expect(screen.queryByRole('link', { name: /Watch next/ })).toBeNull()
    cleanup(); render(<UI />); expand()
    expect(screen.getByRole('link', { name: /Watch next/ })).toBeTruthy()
  })
  it('hides saving controls for guests and handles blocked storage in memory', () => {
    const view = render(<UI userId={null} />)
    expect(screen.queryByText(/^Saved views/)).toBeNull()
    view.rerender(<UI />); expand()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded') })
    save('Session view')
    expect(screen.getByRole('link', { name: /Session view/ })).toBeTruthy()
  })
})
describe('non-mutating title picker', () => {
  it('opens a Planning title and another choice with a filter-preserving detail link', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<StrictMode><UI /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Pick for me' }))
    expect(screen.getByRole('dialog', { name: 'Planning a' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open title' }).getAttribute('href')).toContain('returnTo=%2Fshelves%2Fanime%3Fstatus%3DPlanning%26favorites%3D1')
    fireEvent.click(screen.getByRole('button', { name: 'Pick another' }))
    expect(screen.getByRole('dialog', { name: 'Planning b' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await act(async () => { await Promise.resolve() })
  })
  it('explains an empty Planning pool', () => {
    render(<LibraryTools filters={defaultLibraryFilters} items={[]} returnTo="/" />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick for me' }))
    expect(screen.getByRole('status').textContent).toContain('No Planning titles')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
