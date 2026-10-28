// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ deleteItemAction: vi.fn(), logoutAction: vi.fn(), showToast: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock('../app/actions/items', () => mocks)
vi.mock('../app/actions/auth', () => mocks)
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: mocks.showToast }) }))
vi.mock('../components/LocaleProvider', () => ({ useLocale: () => ({ t: (key: string) => key }) }))
vi.mock('next/navigation', () => ({ useRouter: () => mocks }))
import DeleteItemButton from '../components/DeleteItemButton'
import LogoutButton from '../components/LogoutButton'
afterEach(cleanup)
beforeEach(() => { vi.spyOn(window, 'confirm').mockReturnValue(true) })
describe('single mutation transport recovery', () => {
  it('releases deletion pending state after a transport rejection', async () => {
    mocks.deleteItemAction.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ success: true })
    render(<DeleteItemButton id="fixture" title="Fixture" />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(expect.stringContaining('Refresh'), 'error'))
    expect((button as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(button)
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
  })
  it('allows a logout retry and never claims signed out when transport fails', async () => {
    mocks.logoutAction.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ success: true })
    render(<LogoutButton />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(expect.stringContaining('logout'), 'error'))
    expect(mocks.replace).not.toHaveBeenCalled()
    expect((button as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(button)
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'))
  })
})
