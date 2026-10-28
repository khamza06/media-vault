// @vitest-environment jsdom

import type { ComponentProps } from 'react'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type AppSelect from '../components/ui/AppSelect'
import type ShelfItemCard from '../components/ShelfItemCard'
const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), card: vi.fn(), incrementProgressAction: vi.fn(), deleteItemsBulkAction: vi.fn(), changed: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }), usePathname: () => '/shelves/manga-family', useSearchParams: () => params }))
vi.mock('../app/actions/items', () => mocks)
vi.mock('../components/BulkItemActions', () => ({ default: () => null }))
vi.mock('../components/DiscoverRecommendationCard', () => ({ default: () => null }))
vi.mock('../components/onboarding/SetupChecklist', () => ({ default: () => null }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../components/ShelfItemCard', () => ({ default: mocks.card }))
vi.mock('../components/ui/AppSelect', () => ({ default: ({ ariaLabel, value, options, onValueChange }: ComponentProps<typeof AppSelect>) => (
  <select aria-label={ariaLabel} value={value} onChange={(event) => onValueChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
) }))
import { LocaleProvider } from '../components/LocaleProvider'
import LibraryFilterControls from '../components/LibraryFilterControls'
import LibraryViewControls from '../components/LibraryViewControls'
import ShelfGridView from '../components/ShelfGridView'
import HomeShelvesView from '../components/HomeShelvesView'
import VaultPreferencesProvider from '../components/VaultPreferencesProvider'
import { getLibraryDisplayOptions, getShelfDisplay } from '../lib/library-display'
import { defaultLibraryFilters, libraryCoverOptions, libraryRatingOptions, librarySortOptions, librarySourceOptions, libraryStatusOptions, libraryTypeOptions, writeLibraryFiltersToSearchParams, type LibraryFilters } from '../lib/library-filters'
import { shelfDefinitions } from '../lib/shelves'
import { toMediaItem } from '../lib/media'
import { parseVaultPreferences, vaultPreferencesKey } from '../lib/vault-preferences'

let params = new URLSearchParams()
const item = toMediaItem({ id: 'manga', title: 'Original manga', type: 'Manga', status: 'Completed', notes: '  **Original notes**\n', progress: 12, external_source: 'anilist', external_id: '20', rating: 8 })
beforeEach(() => {
  params = new URLSearchParams()
  mocks.card.mockImplementation(({ item, returnTo }: ComponentProps<typeof ShelfItemCard>) => <a href={`/items/${item.id}?returnTo=${encodeURIComponent(returnTo ?? '/')}`}>{item.title}</a>)
})
afterEach(() => { cleanup(); window.localStorage.clear() })

function Filters({ initial = defaultLibraryFilters }: { initial?: LibraryFilters }) {
  const [filters, setFilters] = useState(initial)
  return <LibraryFilterControls filters={filters} showSourceFilter totalCount={12} visibleCount={2} onChange={(next) => { setFilters(next); mocks.changed(next) }} />
}

describe('Library display localization without filter mutations', () => {
  it('retains every option value/order and leaves the shared English filter model unchanged', () => {
    const original = { type: libraryTypeOptions, status: libraryStatusOptions, cover: libraryCoverOptions, source: librarySourceOptions, rating: libraryRatingOptions, sort: librarySortOptions }
    const before = structuredClone(original)
    const localized = getLibraryDisplayOptions('ru')
    for (const key of Object.keys(original) as (keyof typeof original)[]) expect(localized[key].map((option) => option.value)).toEqual(original[key].map((option) => option.value))
    expect(original).toEqual(before)
    expect(getLibraryDisplayOptions('en')).toEqual(original)
    expect(localized.source.find((option) => option.value === 'anilist')?.label).toBe('AniList')
    for (const shelf of shelfDefinitions) expect(getShelfDisplay('en', shelf.key)).toEqual({ label: shelf.label, description: shelf.description })
  })
  it('translates labels/chips while changing only the requested canonical field', () => {
    const initial = { ...defaultLibraryFilters, status: 'Completed', type: 'Manga', query: '**keep** title', cover: 'no-cover' as const, rating: '8-plus' as const, source: 'anilist' as const, sort: 'title-asc' as const }
    render(<LocaleProvider locale="ru"><Filters initial={initial} /></LocaleProvider>)
    expect(screen.getByText('Показано 2 из 12')).toBeTruthy()
    expect((screen.getByRole('option', { name: 'Завершено' }) as HTMLOptionElement).value).toBe('Completed')
    expect((screen.getByRole('combobox', { name: 'Фильтр по типу' }) as HTMLSelectElement).value).toBe('Manga')
    fireEvent.click(screen.getByRole('button', { name: 'Убрать фильтр: Завершено' }))
    expect(mocks.changed).toHaveBeenLastCalledWith({ ...initial, status: 'all' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Сортировка библиотеки' }), { target: { value: 'rating-desc' } })
    expect(mocks.changed).toHaveBeenLastCalledWith({ ...initial, status: 'all', sort: 'rating-desc' })
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(mocks.changed).toHaveBeenLastCalledWith(defaultLibraryFilters)
  })
  it('retains exact search text in state and encodes existing URL keys rather than translated labels', () => {
    render(<LocaleProvider locale="ru"><Filters /></LocaleProvider>)
    const query = '  Original <title> **заметка**  '
    fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск' }), { target: { value: query } })
    expect(mocks.changed).toHaveBeenLastCalledWith({ ...defaultLibraryFilters, query })
    const next = writeLibraryFiltersToSearchParams(new URLSearchParams(), { ...defaultLibraryFilters, query, status: 'Completed', type: 'Manga', sort: 'rating-desc' })
    expect([...next.keys()]).toEqual(['q', 'type', 'status', 'sort'])
    expect(next.get('q')).toBe(query.trim())
    expect(next.get('status')).toBe('Completed')
  })
  it('preserves current filtered return URLs when rendering a translated shelf', () => {
    params = new URLSearchParams({ status: 'Completed', q: 'Original', sort: 'rating-desc', rating: '8-plus' })
    render(<LocaleProvider locale="ru"><ShelfGridView shelfKey="manga-family" title="Manga" description="Fallback" items={[item]} listOptions={[]} /></LocaleProvider>)
    expect(screen.getByRole('heading', { name: 'Манга', level: 1 })).toBeTruthy()
    expect(screen.getByRole('link', { name: item.title }).getAttribute('href')).toBe(`/items/manga?returnTo=${encodeURIComponent('/shelves/manga-family?' + params.toString())}`)
    expect(mocks.card.mock.calls[0][0].item.notes).toBe(item.notes)
    fireEvent.click(screen.getByRole('button', { name: 'Только избранное' }))
    const href = mocks.replace.mock.calls[0][0] as string
    const next = new URL(href, 'https://example.invalid').searchParams
    expect(next.get('status')).toBe('Completed'); expect(next.get('favorites')).toBe('1')
    expect(next.get('sort')).toBe('rating-desc')
    expect(mocks.incrementProgressAction).not.toHaveBeenCalled()
  })
  it('explains an empty filtered shelf and clears query/filter/favorite parameters through the existing path', () => {
    params = new URLSearchParams({ status: 'Dropped', favorites: '1', q: 'missing' })
    render(<LocaleProvider locale="ru"><ShelfGridView shelfKey="anime" title="Anime" description="Fallback" items={[item]} listOptions={[]} /></LocaleProvider>)
    expect(screen.getByRole('heading', { name: 'По этим фильтрам ничего не найдено.' })).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Сбросить фильтры' }).at(-1)!)
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/shelves/manga-family', { scroll: false })
    expect(mocks.card).not.toHaveBeenCalled()
  })
  it('keeps honest per-family completion counts when headings are translated', () => {
    const items = [{ ...item, status: 'Reading' }, { ...item, id: 'manhwa', type: 'Manhwa', status: 'Planning' }, { ...item, id: 'anime', type: 'Anime', status: 'Completed' }]
    render(<LocaleProvider locale="ru"><HomeShelvesView items={items} listOptions={[]} recommendations={[]} onboardingState={{ itemCount: 3, importedItemCount: 3, listCount: 0, listsReady: true, profileReady: false, username: null, isProfilePublic: false }} /></LocaleProvider>)
    const manga = screen.getByRole('heading', { level: 3, name: 'Манга' }).closest('article')!
    expect(within(manga).getByText('0%')).toBeTruthy()
    expect(within(manga).getByText('Завершено: 0 / всего: 2')).toBeTruthy()
    const anime = screen.getByRole('heading', { level: 3, name: 'Аниме' }).closest('article')!
    expect(within(anime).getByText('100%')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Продолжить' })).toBeTruthy()
    expect(items[0].notes).toBe(item.notes)
    expect(screen.getAllByText('0 записей').length).toBe(3)
  })
  it('changes display density using canonical preference values in Russian', () => {
    render(<LocaleProvider locale="ru"><VaultPreferencesProvider userId="synthetic-qa"><LibraryViewControls /></VaultPreferencesProvider></LocaleProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Компактный' }))
    expect(parseVaultPreferences(window.localStorage.getItem(vaultPreferencesKey('synthetic-qa'))).view).toBe('compact')
    fireEvent.click(screen.getByRole('button', { name: 'Таблица' }))
    expect(parseVaultPreferences(window.localStorage.getItem(vaultPreferencesKey('synthetic-qa'))).view).toBe('table')
    expect(screen.getByRole('button', { name: 'Таблица' }).getAttribute('aria-pressed')).toBe('true')
  })
})
