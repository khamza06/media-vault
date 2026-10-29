// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import RecentProgressActivity from '../components/RecentProgressActivity'
import { t, type MessageKey } from '../lib/i18n'
vi.mock('../components/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: MessageKey) => t('en', key) }) }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function open() {
  fireEvent.click(screen.getByText('Recent progress'))
}
it('loads private history only on request and never invents old events', async () => {
  const fetcher = vi.fn(async () => Response.json({ data: [] }))
  vi.stubGlobal('fetch', fetcher)
  render(<RecentProgressActivity />)
  expect(fetcher).not.toHaveBeenCalled()
  open()
  await screen.findByText(/Earlier activity has not been reconstructed/)
  expect(fetcher).toHaveBeenCalledWith('/api/progress-activity', expect.objectContaining({ cache: 'no-store' }))
})
it('offers a retry after failure and renders recorded corrections without changing their direction', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockImplementation(async () => Response.json({ data: [{ id: 'event', item_id: 'work', item: { title: 'Private book' }, media_type: 'Book', from_progress: 10, to_progress: 5, occurred_at: '2026-10-29T08:00:00Z' }] }))
  vi.stubGlobal('fetch', fetcher)
  render(<RecentProgressActivity />)
  open()
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByRole('link', { name: 'Private book' })
  expect(screen.getByText('p.: 10 → 5')).toBeTruthy()
  expect(document.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-29T08:00:00Z')
})
