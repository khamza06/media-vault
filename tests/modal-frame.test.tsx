// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../components/LocaleProvider', () => ({ useLocale: () => ({ t: () => 'Close modal' }) }))
import ModalFrame from '../components/ModalFrame'
afterEach(cleanup)
describe('capture modal accessibility', () => {
  it('names the dialog, restores focus, and does not steal the input focus when a parent rerenders', async () => {
    let frame: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1 })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const props = { title: 'New item', description: 'Private draft', isOpen: true, onClose: vi.fn() }
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus()
    const view = render(<ModalFrame {...props}><input aria-label="Draft" /></ModalFrame>)
    act(() => frame?.(0))
    expect(screen.getByRole('dialog', { name: 'New item' }).getAttribute('aria-modal')).toBe('true')
    const input = screen.getByRole('textbox', { name: 'Draft' }); input.focus()
    frame = undefined
    view.rerender(<ModalFrame {...props} onClose={() => {}}><input aria-label="Draft" /></ModalFrame>)
    expect(document.activeElement).toBe(input)
    expect(frame).toBeUndefined()
    view.unmount()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    trigger.remove(); vi.unstubAllGlobals()
  })
  it('supports closing by Escape', () => {
    const close = vi.fn()
    render(<ModalFrame title="Draft" description="Private" isOpen onClose={close}><p>Content</p></ModalFrame>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
  })
})
