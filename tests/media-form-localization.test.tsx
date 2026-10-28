// @vitest-environment jsdom

import type { ComponentProps } from 'react'
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type AppSelect from '../components/ui/AppSelect'
const mocks = vi.hoisted(() => ({ createItemAction: vi.fn(), updateItemAction: vi.fn(), uploadCoverAction: vi.fn(), refresh: vi.fn(), replace: vi.fn(), showToast: vi.fn() }))
vi.mock('../app/actions/items', () => mocks)
vi.mock('../app/actions/storage', () => mocks)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }) }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: mocks.showToast }) }))
// Inspect option values independently of Radix's browser geometry/portal behavior.
vi.mock('../components/ui/AppSelect', () => ({ default: ({ ariaLabel, disabled, value, options, onValueChange }: ComponentProps<typeof AppSelect>) => (
  <select aria-label={ariaLabel} disabled={disabled} value={value} onChange={(event) => onValueChange(event.target.value)}>
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>
) }))
import { LocaleProvider } from '../components/LocaleProvider'
import MediaItemForm from '../components/MediaItemForm'
import EditItemPageForm from '../components/EditItemPageForm'
import AddModal from '../components/AddModal'
import { dispatchOpenAddModal } from '../lib/add-modal-events'
import { getProgressFieldLabels } from '../lib/media-form-labels'
import { getCurrentProgressLabel, getTotalProgressLabel, mediaTypes, toMediaItem, type MediaItemInput } from '../lib/media'
import type { CatalogSearchCandidate } from '../lib/catalog-types'

const notes = '  **Исходные notes**  \n\n- Keep original text\n'
const item = toMediaItem({ id: 'owned-item', title: 'Original title', type: 'Manga', status: 'Reading', progress: 7, total_progress: 100, rating: 8, notes, favorite: true, external_rating_label: 'AniList', external_rating_value: 8.3, image_url: null })
const initial: MediaItemInput = { title: item.title, type: item.type, status: item.status, progress: '7', totalProgress: '100', rating: '8', notes, genres: 'Action', favorite: true, imageUrl: '', startedAt: '2020-03-01', completedAt: '', externalRatingLabel: 'AniList', externalRatingValue: '8.3' }
const candidate: CatalogSearchCandidate = { id: 'anilist:20', title: 'Original title', type: 'Anime', status: 'Planning', description: 'Provider description must not become notes', genres: 'Action', imageUrl: '', totalProgress: '12', provider: 'AniList', score: 1, subtitle: null, year: null }

beforeEach(() => {
  mocks.createItemAction.mockResolvedValue({ success: true })
  mocks.updateItemAction.mockResolvedValue({ success: true })
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: [] })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function DraftForm() {
  const [form, setForm] = useState(initial)
  return <MediaItemForm form={form} errorMessage="" isSubmitting={false} submitLabel="Save fixture" onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))} onSubmit={(event) => event.preventDefault()} />
}
function openAdd() {
  render(<LocaleProvider locale="ru"><AddModal listenForExternalOpen /></LocaleProvider>)
  act(() => dispatchOpenAddModal({ candidate }))
}

describe('localized item forms keep their tracking contract', () => {
  it('keeps English progress labels compatible and uses chapters for all manga families', () => {
    for (const type of mediaTypes) expect(getProgressFieldLabels('en', type)).toEqual({ current: getCurrentProgressLabel(type), total: getTotalProgressLabel(type) })
    for (const type of ['Manga', 'Manhwa', 'Manhua']) expect(getProgressFieldLabels('ru', type)).toEqual({ current: 'Текущая глава', total: 'Всего глав' })
    expect(getProgressFieldLabels('ru', 'Anime').total).toBe('Всего серий')
    expect(getProgressFieldLabels('ru', 'Book').total).toBe('Всего страниц')
    expect(getProgressFieldLabels('ru', '').total).toBe('Общее количество')
  })
  it('translates option labels but retains canonical type/status values and dates', () => {
    render(<LocaleProvider locale="ru"><DraftForm /></LocaleProvider>)
    expect((screen.getByRole('combobox', { name: 'Тип медиа' }) as HTMLSelectElement).value).toBe('Manga')
    expect((screen.getByRole('option', { name: 'Манга' }) as HTMLOptionElement).value).toBe('Manga')
    expect((screen.getByRole('option', { name: 'Читаю' }) as HTMLOptionElement).value).toBe('Reading')
    expect((screen.getByRole('spinbutton', { name: 'Текущая глава' }) as HTMLInputElement).value).toBe('7')
    expect((screen.getByRole('textbox', { name: 'Начато' }) as HTMLInputElement).value).toBe('2020-03-01')
    fireEvent.change(screen.getByRole('combobox', { name: 'Тип медиа' }), { target: { value: 'Anime' } })
    expect((screen.getByRole('combobox', { name: 'Статус' }) as HTMLSelectElement).value).toBe('Planning')
    expect(screen.getByRole('spinbutton', { name: 'Текущая серия' })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: /Заметки/ }) as HTMLTextAreaElement).value).toBe(notes)
  })
  it('changes display language without replacing a draft or its exact Markdown', async () => {
    const view = render(<LocaleProvider locale="ru"><DraftForm /></LocaleProvider>)
    fireEvent.change(screen.getByRole('textbox', { name: /Заметки/ }), { target: { value: notes + '\n**Draft**  ' } })
    view.rerender(<LocaleProvider locale="en"><DraftForm /></LocaleProvider>)
    await screen.findByRole('combobox', { name: 'Media type' })
    expect((screen.getByRole('textbox', { name: /Notes/ }) as HTMLTextAreaElement).value).toBe(notes + '\n**Draft**  ')
    expect((screen.getByRole('searchbox', { name: 'Title' }) as HTMLInputElement).value).toBe(item.title)
  })
  it('keeps search/status disabled until the user chooses a canonical media type', () => {
    render(<LocaleProvider locale="ru"><MediaItemForm form={{ ...initial, type: '', status: '', title: '' }} errorMessage="" isSubmitting={false} submitLabel="Save fixture" onChange={vi.fn()} onSubmit={(event) => event.preventDefault()} /></LocaleProvider>)
    expect((screen.getByRole('searchbox', { name: 'Название' }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('combobox', { name: 'Статус' }) as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByRole('spinbutton', { name: 'Текущий прогресс' })).toBeTruthy()
    expect(mocks.createItemAction).not.toHaveBeenCalled()
  })
  it('shows localized source labels without changing the selected suggestion payload', () => {
    const select = vi.fn()
    render(<LocaleProvider locale="ru"><MediaItemForm form={initial} errorMessage="" isSubmitting={false} submitLabel="Save fixture" titleSuggestions={[candidate]} onSelectTitleSuggestion={select} onChange={vi.fn()} onSubmit={(event) => event.preventDefault()} /></LocaleProvider>)
    expect(screen.getByText('Подсказки из базы')).toBeTruthy()
    expect(screen.getByText('Год неизвестен')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Original title/ }))
    expect(select).toHaveBeenCalledExactlyOnceWith(candidate)
    expect(candidate.type).toBe('Anime')
    expect(candidate.description).toContain('must not become notes')
  })
  it('adds in Russian with the same provider identity, empty source notes and canonical values', async () => {
    openAdd()
    expect(screen.getByRole('heading', { name: 'Добавить запись' })).toBeTruthy()
    expect((screen.getByRole('textbox', { name: /Заметки/ }) as HTMLTextAreaElement).value).toBe('')
    fireEvent.change(screen.getByRole('textbox', { name: /Заметки/ }), { target: { value: notes } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(mocks.createItemAction).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: 'Anime', status: 'Planning', notes, totalProgress: '12' }), 'anilist:20'))
    expect(mocks.showToast).toHaveBeenCalledWith('Запись добавлена в хранилище.')
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
  it('uses the current language when an external catalog event opens Add New after a switch', async () => {
    const view = render(<LocaleProvider locale="en"><AddModal listenForExternalOpen /></LocaleProvider>)
    view.rerender(<LocaleProvider locale="ru"><AddModal listenForExternalOpen /></LocaleProvider>)
    await screen.findByRole('button', { name: '+ Добавить' })
    act(() => dispatchOpenAddModal({ candidate }))
    expect(screen.getByText('Найденный вариант применён. Проверь данные перед сохранением.')).toBeTruthy()
    expect((screen.getByRole('searchbox', { name: 'Название' }) as HTMLInputElement).value).toBe(candidate.title)
    expect(mocks.createItemAction).not.toHaveBeenCalled()
  })
  it('keeps an Add New draft and localized retry feedback after a transport failure', async () => {
    mocks.createItemAction.mockRejectedValueOnce(new Error('Offline'))
    openAdd()
    fireEvent.change(screen.getByRole('textbox', { name: /Заметки/ }), { target: { value: notes } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await screen.findByText(/Черновик остался в форме/)
    expect((screen.getByRole('textbox', { name: /Заметки/ }) as HTMLTextAreaElement).value).toBe(notes)
    expect((screen.getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement).disabled).toBe(false)
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
  it('shows localized duplicate feedback without claiming that existing data was overwritten', async () => {
    mocks.createItemAction.mockResolvedValueOnce({ success: true, alreadyExists: true })
    openAdd()
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('Уже есть в библиотеке. Существующие данные сохранены.'))
  })
  it('saves full edits with exact notes, progress, rating and existing provider score', async () => {
    render(<LocaleProvider locale="ru"><EditItemPageForm item={item} returnTo="/?status=Reading" /></LocaleProvider>)
    expect(screen.getByRole('link', { name: 'Отмена' }).getAttribute('href')).toBe('/?status=Reading')
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
    await waitFor(() => expect(mocks.updateItemAction).toHaveBeenCalledExactlyOnceWith(item.id, expect.objectContaining({ title: item.title, type: 'Manga', status: 'Reading', notes, progress: '7', rating: '8', favorite: true, externalRatingLabel: 'AniList', externalRatingValue: '8.3' }), null))
    expect(mocks.replace).toHaveBeenCalledWith('/?status=Reading')
  })
  it('keeps the full edit draft on failure and displays Russian fallback feedback', async () => {
    mocks.updateItemAction.mockRejectedValueOnce(new Error('Offline'))
    render(<LocaleProvider locale="ru"><EditItemPageForm item={item} returnTo="/" /></LocaleProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
    await screen.findByText('Не удалось обновить запись.')
    expect((screen.getByRole('textbox', { name: /Заметки/ }) as HTMLTextAreaElement).value).toBe(notes)
    expect((screen.getByRole('button', { name: 'Сохранить изменения' }) as HTMLButtonElement).disabled).toBe(false)
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
