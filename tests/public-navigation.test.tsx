// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppHeader from '../components/AppHeader'
import MobileTabBar from '../components/MobileTabBar'
import { isPublicVaultRoute } from '../lib/public-routes'
import { OPEN_ADD_MODAL_EVENT } from '../lib/add-modal-events'

const route = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }))
vi.mock('../components/AddModal', () => ({ default: () => <button>Add New</button> }))
vi.mock('../components/HeaderCatalogSearch', () => ({ default: () => <input aria-label="Catalog search" /> }))
vi.mock('../components/LogoutButton', () => ({ default: () => <button>Logout</button> }))
vi.mock('../components/LocaleProvider', async () => {
  const { t } = await import('../lib/i18n')
  return { useLocale: () => ({ t: (key: import('../lib/i18n').MessageKey) => t('en', key) }) }
})
afterEach(cleanup)

describe('public navigation', () => {
  it('traps mobile menu focus, locks scrolling and returns focus after Escape', async () => {
    route.pathname = '/lists/fixture'
    render(<AppHeader userId="owner" accountLabel="Owner" />)
    const trigger = screen.getByRole('button', { name: 'Open menu' })
    trigger.focus(); fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    const close = within(dialog).getByRole('button', { name: 'Close menu' })
    await waitFor(() => expect(document.activeElement).toBe(close))
    expect(document.body.style.overflow).toBe('hidden')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(within(dialog).getByRole('link', { name: 'Lists' }).getAttribute('aria-current')).toBe('page')
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Logout' }))
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflow).toBe('')
  })
  it('closes mobile navigation before opening the single shared capture dialog', async () => {
    route.pathname = '/'
    const open = vi.fn()
    window.addEventListener(OPEN_ADD_MODAL_EVENT, open)
    try {
      render(<AppHeader userId="owner" accountLabel="Owner" />)
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '+ Add New' }))
      await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(document.body.style.overflow).toBe('')
    } finally { window.removeEventListener(OPEN_ADD_MODAL_EVENT, open) }
  })
  it.each(['/u/fixture', '/login', '/discover'])('releases mobile menu scrolling and focus on history navigation to %s', pathname => {
    route.pathname = '/'
    const view = render(<AppHeader userId="owner" accountLabel="Owner" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(document.body.style.overflow).toBe('hidden')
    route.pathname = pathname
    view.rerender(<AppHeader userId="owner" accountLabel="Owner" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(fireEvent.keyDown(document.body, { key: 'Tab' })).toBe(true)
    route.pathname = '/'
    view.rerender(<AppHeader userId="owner" accountLabel="Owner" />)
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it.each([null, 'other-owner'])('closes mobile navigation when the session changes to %s', userId => {
    route.pathname = '/'
    const view = render(<AppHeader userId="owner" accountLabel="Owner" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(document.body.style.overflow).toBe('hidden')
    view.rerender(<AppHeader userId={userId} accountLabel="Account" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(fireEvent.keyDown(document.body, { key: 'Tab' })).toBe(true)
    view.rerender(<AppHeader userId="owner" accountLabel="Owner" />)
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe('false')
  })
  it('does not reopen utility navigation when returning from another route', () => {
    route.pathname = '/'
    const view = render(<AppHeader userId="owner" accountLabel="Owner" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open utility menu' }))
    expect(screen.getByRole('button', { name: 'Open utility menu' }).getAttribute('aria-expanded')).toBe('true')
    route.pathname = '/u/fixture'
    view.rerender(<AppHeader userId="owner" accountLabel="Owner" />)
    route.pathname = '/'
    view.rerender(<AppHeader userId="owner" accountLabel="Owner" />)
    expect(screen.getByRole('button', { name: 'Open utility menu' }).getAttribute('aria-expanded')).toBe('false')
  })
  it('supports the utility disclosure with ArrowDown and Escape', async () => {
    route.pathname = '/'
    render(<AppHeader userId="owner" accountLabel="Owner" />)
    const trigger = screen.getByRole('button', { name: 'Open utility menu' })
    trigger.focus(); fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Import' })))
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })
  it.each(['/items/fixture', '/shelves/anime'])('keeps Library current on mobile for %s', pathname => {
    route.pathname = pathname
    render(<MobileTabBar userId="owner" />)
    expect(screen.getByRole('link', { name: 'Library' }).getAttribute('aria-current')).toBe('page')
  })
  it.each(['/u/fixture', '/u/fixture/lists/example', '/public/fixture', '/share/fixture'])('keeps %s free of private navigation, even for a signed-in visitor', (pathname) => {
    route.pathname = pathname
    render(<><AppHeader userId="viewer" accountLabel="Private account name" /><MobileTabBar userId="viewer" /></>)
    expect(screen.queryByRole('button', { name: /Add/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Logout' })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText('Private account name')).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to vault' }).getAttribute('href')).toBe('/')
  })
  it('does not show private navigation to a guest on Settings', () => {
    route.pathname = '/settings'
    render(<><AppHeader userId={null} accountLabel="Account" /><MobileTabBar userId={null} /></>)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.getByRole('link', { name: 'Open your vault' }).getAttribute('href')).toBe('/login')
  })
  it('preserves the authenticated private Advanced Search alias and mobile navigation', () => {
    route.pathname = '/share/me'
    expect(isPublicVaultRoute('/share/me/')).toBe(false)
    render(<><AppHeader userId="owner" accountLabel="Owner" /><MobileTabBar userId="owner" /></>)
    expect(screen.getAllByRole('button', { name: 'Add New' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('navigation')).toHaveLength(2)
  })
})
