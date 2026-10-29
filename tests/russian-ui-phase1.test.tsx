// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('../app/actions/items', () => ({ quickUpdateItemAction: vi.fn() }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
import { LocaleProvider } from '../components/LocaleProvider'
import LanguageToggle from '../components/LanguageToggle'
import PublicLibraryGrid from '../components/PublicLibraryGrid'
import ItemProviderPanel from '../components/ItemProviderPanel'
import ItemQuickEditPanel from '../components/ItemQuickEditPanel'
import { toMediaItem } from '../lib/media'
import { ui, translateMessage, translateError, formatNumber, countNoun } from '../lib/ui-i18n'
import { uiMessages } from '../lib/ui-messages'

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true }))) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Russian phase one presentation', () => {
  it('uses Russian plural forms and translates retained static feedback back to English', () => {
    expect([1, 2, 5, 21].map(count => countNoun('ru', count, 'list'))).toEqual(['список', 'списка', 'списков', 'список'])
    expect(translateMessage('en', 'Заметки сохранены.')).toBe('Notes saved.')
  })
  it('keeps unsaved personal notes verbatim when only UI language changes', async () => {
    const item = toMediaItem({ id: 'synthetic', title: 'Settings', type: 'Anime', status: 'Watching', notes: 'Original note' })
    render(<LocaleProvider locale="ru"><LanguageToggle /><ItemQuickEditPanel item={item} /></LocaleProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Редактировать заметки' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Заметки' }), { target: { value: 'My draft — Личный черновик **не менять**' } })
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'Notes' }) as HTMLTextAreaElement).value).toBe('My draft — Личный черновик **не менять**'))
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/locale', expect.anything())
    expect(item.notes).toBe('Original note')
  })
  it('aborts an old metadata request on preference switching and rejects its late response', async () => {
    let resolveOld!: (response: Response) => void
    let oldSignal: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((url: RequestInfo | URL, options?: RequestInit) => {
      if (String(url) === '/api/locale') return Promise.resolve(Response.json({ success: true }))
      if (String(url).includes('metadataLanguage=en')) {
        oldSignal = options?.signal as AbortSignal
        return new Promise<Response>(resolve => { resolveOld = resolve })
      }
      return Promise.resolve(Response.json({ data: { provider: 'TMDB', title: 'Новое название', description: 'Новое описание', genres: [], year: null, format: null, durationMinutes: null, url: 'https://www.themoviedb.org/movie/1' } }))
    }))
    render(<LocaleProvider locale="ru" metadataLanguage="en"><LanguageToggle /><ItemProviderPanel itemId="fixture" supported /></LocaleProvider>)
    fireEvent.click(screen.getByRole('button', { name: /О тайтле/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Предпочитаемый язык метаданных' }), { target: { value: 'ru' } })
    await waitFor(() => expect(oldSignal?.aborted).toBe(true))
    resolveOld(Response.json({ data: { title: 'STALE ENGLISH RESPONSE' } }))
    fireEvent.click(screen.getByRole('button', { name: /О тайтле/ }))
    await screen.findByText('Новое описание')
    expect(screen.queryByText('STALE ENGLISH RESPONSE')).toBeNull()
  })
  it('keeps English source IDs and populated Russian translations for every additional UI message', () => {
    for (const [key, value] of Object.entries(uiMessages)) {
      expect(value.trim()).not.toBe('')
      expect(value).not.toContain('\ufffd')
      expect(ui('en', key as keyof typeof uiMessages)).toBe(key.replace(/&apos;/g, "'").replace(/&quot;/g, '"'))
    }
  })
  it('translates known validation and result templates, and safely handles unknown upstream errors', () => {
    expect(translateMessage('ru', 'Title is required.')).toBe('Укажите название.')
    expect(translateMessage('ru', 'Imported 3 AniList items. Skipped 2 duplicates.')).toContain('Импортировано из AniList: 3')
    expect(translateError('ru', 'Upstream transport error')).not.toMatch(/Upstream/)
    expect(translateError('en', 'Upstream transport error')).toBe('Upstream transport error')
    expect(formatNumber('ru', 8.5)).toBe('8,5')
  })
  it('switches metadata independently without changing interface language or touching user data', async () => {
    render(<LocaleProvider locale="ru" metadataLanguage="en"><LanguageToggle /></LocaleProvider>)
    fireEvent.change(screen.getByRole('combobox', { name: 'Предпочитаемый язык метаданных' }), { target: { value: 'original' } })
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/locale', expect.objectContaining({ body: JSON.stringify({ metadataLanguage: 'original' }) })))
    expect(screen.getByRole('button', { name: 'Русский' }).getAttribute('aria-pressed')).toBe('true')
    expect(document.documentElement.lang).toBe('ru')
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('preserves metadata choice when only the interface is changed', async () => {
    render(<LocaleProvider locale="en" metadataLanguage="original"><LanguageToggle /></LocaleProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Русский' }))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect((screen.getByRole('combobox', { name: 'Предпочитаемый язык метаданных' }) as HTMLSelectElement).value).toBe('original')
    expect(fetch).toHaveBeenCalledWith('/api/locale', expect.objectContaining({ body: JSON.stringify({ locale: 'ru' }) }))
  })
  it('localizes public type/status/progress while preserving a user title identical to an English UI key', () => {
    const item = toMediaItem({ id: 'synthetic', title: 'Settings', type: 'Movie', status: 'Completed', progress: 1, total_progress: 1 })
    const before = structuredClone(item)
    render(<LocaleProvider locale="ru"><PublicLibraryGrid items={[item]} /></LocaleProvider>)
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(screen.getAllByText('Фильм').length).toBeGreaterThan(0)
    expect(screen.getByText('Завершено')).toBeTruthy()
    expect(screen.getByText(/просм\./)).toBeTruthy()
    expect(item).toEqual(before)
    expect(screen.queryByText(/notes|metadataLanguage/i)).toBeNull()
  })
})
