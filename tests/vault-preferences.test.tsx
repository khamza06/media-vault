// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import VaultPreferencesProvider, { useVaultPreferences } from '../components/VaultPreferencesProvider'
import LibraryViewControls from '../components/LibraryViewControls'
import { t, type MessageKey } from '../lib/i18n'
vi.mock('../components/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: MessageKey) => t('en', key) }) }))
import { parseVaultViewMode, vaultPreferencesKey } from '../lib/vault-preferences'

function Value() {
  return <output aria-label="Current view">{useVaultPreferences().view}</output>
}
function UI({ userId }: { userId: string | null }) {
  return <VaultPreferencesProvider userId={userId}><LibraryViewControls /><Value /></VaultPreferencesProvider>
}
afterEach(() => { cleanup(); window.localStorage.clear() })

describe('account-scoped view preferences', () => {
  it('ignores malformed/unknown storage values', () => {
    for (const value of [null, '', 'not json', 'null', '[]', '{"view":"nope"}', '{"view":{}}']) {
      expect(parseVaultViewMode(value)).toBe('comfortable')
    }
  })
  it('persists an accessible selection and restores it on remount', () => {
    const view = render(<UI userId="alice" />)
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }))
    expect(screen.getByRole('button', { name: 'Compact' }).getAttribute('aria-pressed')).toBe('true')
    expect(JSON.parse(window.localStorage.getItem(vaultPreferencesKey('alice')) ?? '{}')).toMatchObject({ view: 'compact', savedViews: [] })
    view.unmount()
    render(<UI userId="alice" />)
    expect(screen.getByLabelText('Current view').textContent).toBe('compact')
  })
  it('does not carry one account preferences into another or a guest', () => {
    window.localStorage.setItem(vaultPreferencesKey('alice'), '{"view":"table"}')
    const view = render(<UI userId="alice" />)
    expect(screen.getByLabelText('Current view').textContent).toBe('table')
    view.rerender(<UI userId="bob" />)
    expect(screen.getByLabelText('Current view').textContent).toBe('comfortable')
    view.rerender(<UI userId={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }))
    expect(window.localStorage.length).toBe(1)
  })
  it('stays usable when storage reads or writes are blocked', () => {
    window.localStorage.setItem(vaultPreferencesKey('alice'), '{"view":"table"}')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded') })
    render(<UI userId="alice" />)
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }))
    expect(screen.getByLabelText('Current view').textContent).toBe('compact')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable') })
    fireEvent.click(screen.getByRole('button', { name: 'Comfortable' }))
    expect(screen.getByLabelText('Current view').textContent).toBe('comfortable')
  })
  it('responds to another tab changing or clearing the account preference', () => {
    render(<UI userId="alice" />)
    window.localStorage.setItem(vaultPreferencesKey('alice'), '{"view":"table"}')
    fireEvent(window, new StorageEvent('storage', { key: vaultPreferencesKey('alice') }))
    expect(screen.getByLabelText('Current view').textContent).toBe('table')
    window.localStorage.clear()
    fireEvent(window, new StorageEvent('storage', { key: null }))
    expect(screen.getByLabelText('Current view').textContent).toBe('comfortable')
  })
})
