// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RecommendationCarousel from '../components/RecommendationCarousel'
import { LocaleProvider } from '../components/LocaleProvider'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

let resize: () => void
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function setup(locale: 'en' | 'ru' = 'en') {
  const clicked = vi.fn()
  render(<LocaleProvider locale={locale}><RecommendationCarousel itemCount={4}><button onClick={clicked}>First title</button><button>Last title</button></RecommendationCarousel></LocaleProvider>)
  const viewport = screen.getByRole('group', { name: locale === 'en' ? 'Recommended titles' : 'Рекомендованные тайтлы' })
  let width = 500
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, get: () => width },
    scrollWidth: { configurable: true, value: 1500 },
    setPointerCapture: { configurable: true, value: vi.fn() },
  })
  const scrollTo = vi.fn((options: ScrollToOptions) => {
    viewport.scrollLeft = Math.max(0, Math.min(1500 - width, options.left!))
    fireEvent.scroll(viewport)
  })
  Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scrollTo })
  act(() => resize())
  return { viewport, scrollTo, clicked, resizeTo: (next: number) => { width = next; act(() => resize()) } }
}

describe('recommendation carousel', () => {
  it('scrolls smoothly with arrows, disables boundaries and updates after resize', () => {
    const { viewport, scrollTo, resizeTo } = setup()
    const previous = screen.getByRole('button', { name: 'Previous recommendations' }) as HTMLButtonElement
    const next = screen.getByRole('button', { name: 'Next recommendations' }) as HTMLButtonElement
    expect(previous.disabled).toBe(true)
    expect(next.disabled).toBe(false)
    fireEvent.click(next)
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 400, behavior: 'smooth' })
    expect(previous.disabled).toBe(false)
    fireEvent.keyDown(viewport, { key: 'End' })
    expect(next.disabled).toBe(true)
    fireEvent.click(previous)
    expect(next.disabled).toBe(false)
    viewport.scrollLeft = 0
    resizeTo(1500)
    expect(previous.disabled).toBe(true)
    expect(next.disabled).toBe(true)
  })
  it('supports keyboard scrolling and reduced motion without stealing card keys', () => {
    const { viewport, scrollTo } = setup()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 400, behavior: 'auto' })
    fireEvent.keyDown(viewport, { key: 'Home' })
    expect(viewport.scrollLeft).toBe(0)
    scrollTo.mockClear()
    fireEvent.keyDown(screen.getByRole('button', { name: 'First title' }), { key: 'ArrowRight' })
    expect(scrollTo).not.toHaveBeenCalled()
  })
  it('suppresses a card click after a mouse drag, while ordinary clicks remain active', () => {
    const { viewport, clicked } = setup()
    const card = screen.getByRole('button', { name: 'First title' })
    fireEvent.pointerDown(card, { pointerType: 'mouse', pointerId: 1, isPrimary: true, button: 0, clientX: 300, clientY: 20 })
    fireEvent.pointerMove(viewport, { pointerType: 'mouse', pointerId: 1, clientX: 100, clientY: 20 })
    expect(viewport.scrollLeft).toBe(200)
    fireEvent.pointerUp(viewport, { pointerType: 'mouse', pointerId: 1 })
    fireEvent.click(card, { detail: 1 })
    expect(clicked).not.toHaveBeenCalled()
    fireEvent.pointerDown(card, { pointerType: 'mouse', pointerId: 2, isPrimary: true, button: 0, clientX: 100, clientY: 20 })
    fireEvent.pointerUp(card, { pointerType: 'mouse', pointerId: 2 })
    fireEvent.click(card, { detail: 1 })
    expect(clicked).toHaveBeenCalledTimes(1)
  })
  it('leaves native touch, pen and wheel behavior alone and localizes controls', () => {
    const { viewport } = setup('ru')
    for (const pointerType of ['touch', 'pen']) {
      fireEvent.pointerDown(viewport, { pointerType, pointerId: 1, isPrimary: true, button: 0, clientX: 300 })
      expect(fireEvent.pointerMove(viewport, { pointerType, pointerId: 1, clientX: 100, cancelable: true })).toBe(true)
      expect(viewport.scrollLeft).toBe(0)
    }
    expect(fireEvent.wheel(viewport, { deltaX: 120, cancelable: true })).toBe(true)
    expect(screen.getByRole('button', { name: 'Следующие рекомендации' })).toBeTruthy()
  })
})
