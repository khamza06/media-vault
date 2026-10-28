// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('../components/lists/AddToListButton', () => ({ default: () => null }))
import { LocaleProvider } from '../components/LocaleProvider'
import CatalogDiscover from '../components/catalog/CatalogDiscover'
import RelatedTitles from '../components/catalog/RelatedTitles'
import ItemProviderPanel from '../components/ItemProviderPanel'
import type { CatalogSearchCandidate } from '../lib/catalog-types'
import { OPEN_ADD_MODAL_EVENT } from '../lib/add-modal-events'

const candidate: CatalogSearchCandidate = { id: 'anilist:20', provider: 'AniList', title: 'Original title', description: 'Original provider description', type: 'Anime', status: 'Planning', imageUrl: '', genres: 'Action', score: 1, subtitle: null, year: null, totalProgress: '12' }
const dialogMethods = new Map(['showModal', 'close'].map((name) => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]))
beforeEach(() => {
  vi.useFakeTimers()
  window.history.replaceState(null, '', '/discover')
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; queueMicrotask(() => this.dispatchEvent(new Event('close'))) } })
})
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.unstubAllGlobals()
  for (const [name, descriptor] of dialogMethods) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
})
describe('Russian catalog controls with unchanged data', () => {
  it('keeps request values and the add-form payload unchanged while translating search/preview controls', async () => {
    const loadPage = vi.fn(async () => ({ data: [candidate], page: 1, hasMore: false, provider: 'AniList' as const }))
    render(<LocaleProvider locale="ru"><CatalogDiscover loadPage={loadPage} ownedItems={[]} lists={[]} /></LocaleProvider>)
    fireEvent.change(screen.getByRole('textbox', { name: 'Поиск тайтлов' }), { target: { value: 'naruto' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(401) })
    expect(loadPage).toHaveBeenCalledWith(expect.objectContaining({ type: 'anime', locale: 'ru', query: 'naruto', source: 'primary' }), expect.anything())
    fireEvent.click(screen.getByRole('button', { name: 'Посмотреть: Original title' }))
    expect(screen.getByRole('dialog', { name: candidate.title })).toBeTruthy()
    expect(screen.queryByText('Anime')).toBeNull()
    expect(screen.getByText(candidate.description)).toBeTruthy()
    const received = vi.fn()
    window.addEventListener(OPEN_ADD_MODAL_EVENT, received)
    fireEvent.click(screen.getByRole('button', { name: 'Добавить в библиотеку' }))
    await act(async () => { await Promise.resolve() })
    expect((received.mock.calls[0][0] as CustomEvent).detail.candidate).toEqual(candidate)
    window.removeEventListener(OPEN_ADD_MODAL_EVENT, received)
  })
  it('keeps owned-title recognition and detail links in Russian', async () => {
    const loadPage = vi.fn(async () => ({ data: [candidate], page: 1, hasMore: false, provider: 'AniList' as const }))
    render(<LocaleProvider locale="ru"><CatalogDiscover loadPage={loadPage} ownedItems={[{ id: 'owned', title: 'Renamed title', type: 'Anime', externalSource: 'anilist', externalId: '20' }]} lists={[]} /></LocaleProvider>)
    fireEvent.change(screen.getByRole('textbox', { name: 'Поиск тайтлов' }), { target: { value: 'naruto' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(401) })
    fireEvent.click(screen.getByRole('button', { name: 'Посмотреть: Original title' }))
    expect(screen.getByRole('link', { name: 'Открыть запись' }).getAttribute('href')).toBe('/items/owned')
    expect(screen.queryByRole('button', { name: 'Добавить в библиотеку' })).toBeNull()
  })
  it('translates relation display labels but not source titles or Discover query values', () => {
    const relation = { id: 21, title: 'Unchanged source title', type: 'Manga' as const, relation: 'Source material', coverUrl: null, url: 'https://anilist.co/manga/21' }
    render(<LocaleProvider locale="ru"><RelatedTitles titles={[relation]} /></LocaleProvider>)
    expect(screen.getByText('Первоисточник / Манга')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Найти в Каталоге' }).getAttribute('href')).toBe('/discover?q=Unchanged+source+title&type=manga')
    expect(relation.title).toBe('Unchanged source title')
  })
  it('translates the provider-panel empty identity state without issuing a request', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    render(<LocaleProvider locale="ru"><ItemProviderPanel itemId="fixture" supported={false} /></LocaleProvider>)
    fireEvent.click(screen.getByRole('button', { name: /О тайтле/ }))
    expect(screen.getByText(/У записи нет поддерживаемого ID/)).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
