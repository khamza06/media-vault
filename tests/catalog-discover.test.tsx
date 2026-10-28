// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }))
vi.mock('../components/LocaleProvider', async () => {
  const { t } = await import('../lib/i18n')
  return { useLocale: () => ({ locale: 'en', t: (key: import('../lib/i18n').MessageKey, vars?: Record<string, string | number>) => t('en', key, vars) }) }
})
vi.mock('../components/lists/AddToListButton', () => ({ default: () => null }))
import CatalogDiscover from '../components/catalog/CatalogDiscover'
import CatalogPreview from '../components/catalog/CatalogPreview'
import type { CatalogPageRequest } from '../lib/catalog-client'
import type { CatalogSearchCandidate, CatalogSearchPage } from '../lib/catalog-types'

const candidate: CatalogSearchCandidate = { id: 'fixture:1', title: 'Fixture', type: 'Anime', provider: 'AniList', description: '', genres: '', imageUrl: '', status: 'Planning', score: 1, subtitle: null, totalProgress: '', year: null }

function pageFor(input: CatalogPageRequest): CatalogSearchPage {
  return { page: input.page, provider: input.source === 'jikan' ? 'Jikan' : 'AniList', hasMore: input.page < 2, data: Array.from({ length: 20 }, (_, index) => ({ ...candidate, id: `fixture:${(input.page - 1) * 20 + index}`, title: `${input.query} ${index}` })) }
}
async function flushSearch() {
  await act(async () => { await vi.advanceTimersByTimeAsync(401) })
}
beforeEach(() => {
  vi.useFakeTimers()
  window.history.replaceState(null, '', '/discover')
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('Discover interactions', () => {
  it('debounces typing and keeps focused input, without Enter or blur', async () => {
    const loadPage = vi.fn(async (input: CatalogPageRequest) => pageFor(input))
    render(<CatalogDiscover ownedItems={[]} lists={[]} loadPage={loadPage} />)
    const input = screen.getByRole('textbox', { name: 'Search titles' })
    input.focus()
    fireEvent.change(input, { target: { value: 'naruto' } })
    expect(loadPage).not.toHaveBeenCalled()
    await flushSearch()
    expect(screen.getAllByRole('button', { name: /^Preview / })).toHaveLength(20)
    expect(document.activeElement).toBe(input)
    expect(window.location.search).toBe('?q=naruto')
  })

  it('resets pagination when returning to an earlier source', async () => {
    const loadPage = vi.fn(async (input: CatalogPageRequest) => pageFor(input))
    const view = render(<CatalogDiscover ownedItems={[]} lists={[]} loadPage={loadPage} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search titles' }), { target: { value: 'naruto' } })
    await flushSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    await flushSearch()
    expect(screen.getAllByRole('button', { name: /^Preview / })).toHaveLength(40)
    window.history.replaceState(null, '', '/discover?q=naruto&source=jikan')
    view.rerender(<CatalogDiscover ownedItems={[]} lists={[]} loadPage={loadPage} />)
    await flushSearch()
    window.history.replaceState(null, '', '/discover?q=naruto')
    view.rerender(<CatalogDiscover ownedItems={[]} lists={[]} loadPage={loadPage} />)
    await flushSearch()
    expect(loadPage.mock.lastCall?.[0]).toMatchObject({ source: 'primary', page: 1 })
    expect(screen.getAllByRole('button', { name: /^Preview / })).toHaveLength(20)
  })

  it('ignores an old response after a new query has completed', async () => {
    let finishSlow: ((page: CatalogSearchPage) => void) | undefined
    const loadPage = vi.fn((input: CatalogPageRequest) => input.query === 'slow'
      ? new Promise<CatalogSearchPage>((resolve) => { finishSlow = resolve })
      : Promise.resolve(pageFor(input)))
    render(<CatalogDiscover ownedItems={[]} lists={[]} loadPage={loadPage} />)
    const input = screen.getByRole('textbox', { name: 'Search titles' })
    fireEvent.change(input, { target: { value: 'slow' } })
    await flushSearch()
    fireEvent.change(input, { target: { value: 'naruto' } })
    await flushSearch()
    await act(async () => { finishSlow?.({ data: [{ ...candidate, title: 'Old result' }], hasMore: false, page: 1, provider: 'AniList' }) })
    expect(screen.queryByRole('button', { name: 'Preview Old result' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Preview naruto/ })).toHaveLength(20)
  })
})

describe('preview dialog lifecycle', () => {
  it('does not dismiss itself from a queued Strict Mode cleanup close event', async () => {
    // JSDOM does not implement the native dialog methods used in the real browser.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) {
      this.open = false
      queueMicrotask(() => this.dispatchEvent(new Event('close')))
    } })
    const onClose = vi.fn()
    render(<StrictMode><CatalogPreview candidate={candidate} ownedItem={null} onClose={onClose} /></StrictMode>)
    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole('dialog', { name: 'Fixture' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }))
    await act(async () => { await Promise.resolve() })
    expect(onClose).toHaveBeenCalledOnce()
    cleanup()
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
  })
})
