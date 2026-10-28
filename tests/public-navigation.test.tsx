// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppHeader from '../components/AppHeader'
import MobileTabBar from '../components/MobileTabBar'
import { isPublicVaultRoute } from '../lib/public-routes'

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
