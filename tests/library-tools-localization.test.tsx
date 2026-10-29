import { render } from './render-with-locale'
// @vitest-environment jsdom

import { StrictMode } from 'react'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ addItemToListsAction: vi.fn(), showToast: vi.fn(), refresh: vi.fn() }))
vi.mock('../app/actions/lists', () => mocks)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: mocks.showToast }) }))
import { LocaleProvider } from '../components/LocaleProvider'
import ShelfItemCard from '../components/ShelfItemCard'
import LibraryTools from '../components/LibraryTools'
import CoverPlaceholder from '../components/CoverPlaceholder'
import AddToListButton from '../components/lists/AddToListButton'
import VaultPreferencesProvider from '../components/VaultPreferencesProvider'
import { defaultLibraryFilters } from '../lib/library-filters'
import { formatProgressValue, mediaTypes, toMediaItem } from '../lib/media'
import { formatLocalizedProgress } from '../lib/media-form-labels'
import { parseVaultPreferences, vaultPreferencesKey } from '../lib/vault-preferences'

const item = toMediaItem({ id: 'synthetic-manga', title: 'Original source title', type: 'Manga', status: 'Reading', progress: 12, total_progress: 24, rating: 8, genres: ['Action'], notes: '  **Keep exact notes**\n' })
const planning = ['a', 'b'].map((id) => ({ ...item, id, title: `Original ${id}`, status: 'Planning' }))
const returnTo = '/shelves/manga-family?status=Planning&favorites=1'
const descriptors = new Map(['showModal', 'close'].map((key) => [key, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key)]))
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; queueMicrotask(() => this.dispatchEvent(new Event('close'))) } })
})
afterEach(() => {
  cleanup(); window.localStorage.clear()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
  }
})

function Tools({ userId = 'synthetic-qa', items = planning, selectionActive = false }: { userId?: string | null; items?: typeof planning; selectionActive?: boolean }) {
  return <VaultPreferencesProvider userId={userId}><LibraryTools filters={{ ...defaultLibraryFilters, status: 'Planning' }} favoritesOnly items={items} returnTo={returnTo} selectionActive={selectionActive} /></VaultPreferencesProvider>
}
function saveView(name: string) {
  fireEvent.click(screen.getByText(/^Сохранённые виды \(/))
  fireEvent.change(screen.getByRole('textbox', { name: 'Название сохранённого вида' }), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить текущий вид' }))
}

describe('localized cards and non-mutating Library tools', () => {
  it('retains all English progress formats and uses display-only Russian units', () => {
    for (const type of mediaTypes) for (const progress of [0, 3]) for (const totalProgress of [null, 12]) {
      const input = { type, progress, totalProgress }
      expect(formatLocalizedProgress('en', input)).toBe(formatProgressValue(input))
    }
    for (const type of ['Manga', 'Manhwa', 'Manhua']) expect(formatLocalizedProgress('ru', { ...item, type })).toBe('гл. 12 / 24')
    expect(formatLocalizedProgress('ru', { ...item, type: 'Anime' })).toBe('эп. 12 / 24')
    expect(formatLocalizedProgress('ru', { ...item, type: 'Book' })).toBe('стр. 12 / 24')
    expect(formatLocalizedProgress('ru', { ...item, type: 'Movie', progress: 1, totalProgress: 1 })).toBe('просм. 1 / 1')
    expect(formatLocalizedProgress('ru', { ...item, progress: 0, totalProgress: null })).toBe('Ещё не начато')
    expect(item.progress).toBe(12)
  })
  it.each(['grid', 'rail', 'row'] as const)('keeps card actions, canonical items and return URLs in Russian %s layout', (layout) => {
    const increment = vi.fn()
    render(<LocaleProvider locale="ru"><ShelfItemCard item={item} layout={layout} onIncrement={increment} progressBusy={false} returnTo={returnTo} /></LocaleProvider>)
    expect(screen.getByText(/гл\. 12 \/ 24/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: `Увеличить прогресс: ${item.title}` }))
    expect(increment).toHaveBeenCalledExactlyOnceWith(item)
    expect(screen.getByRole('button', { name: `Добавить в свой список: ${item.title}` }).textContent).toBe('Список')
    expect(screen.getByRole('button', { name: `Добавить в свой список: ${item.title}` }).querySelector('svg')).toBeNull()
    expect(screen.getByRole('link').getAttribute('href')).toContain(`returnTo=${encodeURIComponent(returnTo)}`)
    expect(screen.getByRole('progressbar', { name: `Прогресс: ${item.title}` }).getAttribute('aria-valuenow')).toBe('12')
    expect(item.status).toBe('Reading'); expect(item.notes).toBe('  **Keep exact notes**\n')
    expect(mocks.addItemToListsAction).not.toHaveBeenCalled()
  })
  it.each(['grid', 'row'] as const)('hides private per-item actions during %s selection and keeps selection separate', (layout) => {
    const select = vi.fn()
    render(<LocaleProvider locale="ru"><ShelfItemCard item={item} layout={layout} isSelectionMode isSelected onToggleSelection={select} onIncrement={vi.fn()} progressBusy={false} /></LocaleProvider>)
    fireEvent.click(screen.getByRole('button', { name: `Снять выбор: ${item.title}` }))
    expect(select).toHaveBeenCalledExactlyOnceWith(item)
    expect(screen.queryByRole('button', { name: `Увеличить прогресс: ${item.title}` })).toBeNull()
    expect(screen.queryByRole('button', { name: `Добавить в свой список: ${item.title}` })).toBeNull()
    expect(mocks.addItemToListsAction).not.toHaveBeenCalled()
  })
  it('leaves default cover placeholders usable outside locale context, including public cards', () => {
    render(<CoverPlaceholder title={item.title} type="Manga" />)
    expect(screen.getByRole('img', { name: `${item.title} cover placeholder` })).toBeTruthy()
    expect(screen.getByText('Manga')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('keeps non-compact and detail list triggers unchanged for other call sites', () => {
    const view = render(<AddToListButton itemId={item.id} itemTitle={item.title} lists={[]} />)
    const trigger = screen.getByRole('button', { name: `Add ${item.title} to a custom list` })
    expect(trigger.textContent).toBe('List')
    expect(trigger.querySelector('svg')).toBeTruthy()
    view.rerender(<AddToListButton itemId={item.id} itemTitle={item.title} lists={[]} variant="detail" compact />)
    expect(screen.getByRole('button').textContent).toBe('Add to list')
    expect(screen.getByRole('button').querySelector('svg')).toBeTruthy()
    expect(mocks.addItemToListsAction).not.toHaveBeenCalled()
  })
  it('retains busy state and source titles while changing card display language', async () => {
    const increment = vi.fn()
    const view = render(<LocaleProvider locale="ru"><ShelfItemCard item={item} onIncrement={increment} progressBusy /></LocaleProvider>)
    view.rerender(<LocaleProvider locale="en"><ShelfItemCard item={item} onIncrement={increment} progressBusy /></LocaleProvider>)
    const button = await screen.findByRole('button', { name: `Increase progress for ${item.title}` })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('heading', { name: item.title })).toBeTruthy()
    expect(screen.getByText('Action')).toBeTruthy()
    expect(increment).not.toHaveBeenCalled()
  })
  it('stores exact saved-view names and canonical filters, not translated labels', () => {
    render(<LocaleProvider locale="ru"><Tools /></LocaleProvider>)
    saveView('Original подборка')
    const prefs = parseVaultPreferences(window.localStorage.getItem(vaultPreferencesKey('synthetic-qa')))
    expect(prefs.savedViews[0]).toMatchObject({ name: 'Original подборка', filters: { status: 'Planning' }, favoritesOnly: true })
    expect(screen.getByRole('link', { name: /Original подборка/ }).getAttribute('href')).toBe(returnTo)
    expect(screen.getByText('Полка: Манга')).toBeTruthy()
    expect(mocks.showToast).toHaveBeenCalledWith('Вид сохранён в этом браузере.')
    fireEvent.click(screen.getByRole('button', { name: 'Удалить сохранённый вид: Original подборка' }))
    expect(parseVaultPreferences(window.localStorage.getItem(vaultPreferencesKey('synthetic-qa'))).savedViews).toHaveLength(0)
    expect(mocks.addItemToListsAction).not.toHaveBeenCalled()
  })
  it('retains saved views, filters and a new name draft after a language switch', async () => {
    const view = render(<LocaleProvider locale="ru"><Tools /></LocaleProvider>)
    saveView('Original name')
    const stored = window.localStorage.getItem(vaultPreferencesKey('synthetic-qa'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Название сохранённого вида' }), { target: { value: 'Unsaved draft' } })
    view.rerender(<LocaleProvider locale="en"><Tools /></LocaleProvider>)
    const name = await screen.findByRole('textbox', { name: 'Saved view name' })
    expect((name as HTMLInputElement).value).toBe('Unsaved draft')
    expect(window.localStorage.getItem(vaultPreferencesKey('synthetic-qa'))).toBe(stored)
    expect(screen.getByRole('link', { name: /Original name/ }).getAttribute('href')).toBe(returnTo)
  })
  it('honestly reports in-session saving when browser storage fails', () => {
    render(<LocaleProvider locale="ru"><Tools /></LocaleProvider>)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable') })
    saveView('Session view')
    expect(screen.getByRole('link', { name: /Session view/ })).toBeTruthy()
    expect(mocks.showToast).toHaveBeenCalledWith('Сохранено только на время сессии. Хранилище браузера недоступно.')
  })
  it('hides saved views for a guest and localizes an empty Planning pool without writes', () => {
    render(<LocaleProvider locale="ru"><Tools userId={null} items={[item]} /></LocaleProvider>)
    expect(screen.queryByText(/^Сохранённые виды/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать за меня' }))
    expect(screen.getByRole('status').textContent).toContain('нет запланированных тайтлов')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(window.localStorage.length).toBe(0)
    expect(mocks.addItemToListsAction).not.toHaveBeenCalled()
  })
  it('keeps the Planning picker read-only, filter-preserving and Strict Mode-safe', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<StrictMode><LocaleProvider locale="ru"><Tools /></LocaleProvider></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать за меня' }))
    expect(screen.getByRole('dialog', { name: 'Original a' })).toBeTruthy()
    expect(screen.getByText('Манга / Планирую')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Открыть тайтл' }).getAttribute('href')).toContain(`returnTo=${encodeURIComponent(returnTo)}`)
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать другой' }))
    expect(screen.getByRole('dialog', { name: 'Original b' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await act(async () => { await Promise.resolve() })
    expect(planning.map((value) => value.status)).toEqual(['Planning', 'Planning'])
    expect(mocks.addItemToListsAction).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
  it('hides the picker in selection mode and disables another pick for a single title', () => {
    const view = render(<LocaleProvider locale="ru"><Tools selectionActive /></LocaleProvider>)
    expect(screen.queryByRole('button', { name: 'Выбрать за меня' })).toBeNull()
    view.rerender(<LocaleProvider locale="ru"><Tools items={[planning[0]]} /></LocaleProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать за меня' }))
    expect((screen.getByRole('button', { name: 'Выбрать другой' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
