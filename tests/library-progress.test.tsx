// @vitest-environment jsdom

import type { ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type ShelfItemCard from '../components/ShelfItemCard'
const mocks = vi.hoisted(() => ({ incrementProgressAction: vi.fn(), deleteItemsBulkAction: vi.fn(), showToast: vi.fn() }))
vi.mock('../app/actions/items', () => mocks)
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), useSearchParams: () => params }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: mocks.showToast }) }))
vi.mock('../components/LibraryFilterControls', () => ({ default: ({ actions }: { actions?: React.ReactNode }) => <div>{actions}</div> }))
vi.mock('../components/BulkItemActions', () => ({ default: () => null }))
vi.mock('../components/DiscoverRecommendationCard', () => ({ default: () => null }))
vi.mock('../components/onboarding/SetupChecklist', () => ({ default: () => null }))
vi.mock('../components/ShelfItemCard', () => ({ default: ({ item, onIncrement, progressBusy }: ComponentProps<typeof ShelfItemCard>) => <button type="button" onClick={() => onIncrement(item)} disabled={progressBusy}>{item.title}:{item.progress}</button> }))
import HomeShelvesView from '../components/HomeShelvesView'
import ShelfGridView from '../components/ShelfGridView'
import { toMediaItem } from '../lib/media'
const params = new URLSearchParams()
const item = toMediaItem({ id: 'fixture', title: 'Fixture', type: 'Anime', status: 'Planning', notes: '  **Keep**\n', progress: 0 })
beforeEach(() => { mocks.incrementProgressAction.mockRejectedValueOnce(new Error('Offline')); mocks.incrementProgressAction.mockResolvedValue({ success: true }) })
afterEach(cleanup)
describe('progress retry and bulk select availability', () => {
  it.each(['home', 'shelf'])('clears busy state and restores progress after a transport error in %s', async (view) => {
    render(view === 'home' ? <HomeShelvesView items={[item]} listOptions={[]} recommendations={[]} onboardingState={{ itemCount: 1, importedItemCount: 0, isProfilePublic: false, listCount: 0, listsReady: true, profileReady: false, username: null }} />
      : <ShelfGridView items={[item]} listOptions={[]} title="Fixture shelf" description="Fixture" />)
    fireEvent.click(screen.getByRole('button', { name: 'Fixture:0' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Fixture:0' }) as HTMLButtonElement).disabled).toBe(false))
    expect((screen.getByRole('button', { name: 'Select' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Fixture:0' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Fixture:1' }).every((button) => !(button as HTMLButtonElement).disabled)).toBe(true))
    expect(item.progress).toBe(0)
    expect(item.notes).toBe('  **Keep**\n')
  })
})
