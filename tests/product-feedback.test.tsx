// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from '../components/ToastProvider'
import CopyShareLinkButton from '../components/CopyShareLinkButton'

vi.mock('../components/LocaleProvider', async () => {
  const { t } = await import('../lib/i18n')
  return { useLocale: () => ({ t: (key: import('../lib/i18n').MessageKey) => t('en', key) }) }
})
function Trigger() {
  const { showToast } = useToast()
  return <><button onClick={() => showToast('Saved changes')}>Success</button><button onClick={() => showToast('Review the failed operation', 'error')}>Error</button></>
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('accessible product feedback', () => {
  it('announces outcomes and keeps errors available until explicitly dismissed', () => {
    vi.useFakeTimers()
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Success' }))
    fireEvent.click(screen.getByRole('button', { name: 'Error' }))
    expect(screen.getByRole('status').textContent).toContain('Saved changes')
    act(() => vi.advanceTimersByTime(6001))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Review the failed operation')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('pauses dismissal while keyboard focus is in a notification and clears timers on unmount', () => {
    vi.useFakeTimers()
    const view = render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Success' }))
    act(() => screen.getByRole('button', { name: 'Dismiss notification' }).focus())
    act(() => vi.advanceTimersByTime(12000))
    expect(screen.getByRole('status')).toBeTruthy()
    act(() => screen.getByRole('button', { name: 'Success' }).focus())
    act(() => vi.advanceTimersByTime(6001))
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Success' }))
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('deduplicates repeated errors rather than covering the screen with copies', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    const button = screen.getByRole('button', { name: 'Error' })
    fireEvent.click(button); fireEvent.click(button)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Success' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Saved changes')
  })
  it('offers a selectable URL when clipboard permission is denied, and allows retry', async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error('Permission denied')).mockResolvedValueOnce(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } })
    render(<CopyShareLinkButton path="/u/synthetic" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy public profile link' }))
    const input = await screen.findByRole('textbox', { name: 'Sharing link' }) as HTMLInputElement
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(input.value).toBe(new URL('/u/synthetic', window.location.origin).toString())
    input.focus()
    expect(input.selectionEnd! - input.selectionStart!).toBe(input.value.length)
    fireEvent.click(screen.getByRole('button', { name: 'Copy public profile link' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByRole('status').textContent).toBe('Link copied')
    expect(write).toHaveBeenCalledTimes(2)
  })
})
