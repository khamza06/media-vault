// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
import { LocaleProvider, useLocale } from '../components/LocaleProvider'
import LanguageToggle from '../components/LanguageToggle'

function Label() { const { t } = useLocale(); return <p>{t('nav.library')}</p> }
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true }))))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('language switching', () => {
  it.each(['en', 'ru'] as const)('explains the Russian metadata limitation in %s without provider requests', async locale => {
    render(<LocaleProvider locale={locale} metadataLanguage="en"><LanguageToggle /></LocaleProvider>)
    const hint = locale === 'ru' ? /Дополнительные русские названия/ : /Additional Russian titles/
    expect(screen.queryByText(hint)).toBeNull()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ru' } })
    expect(screen.getByText(hint)).toBeTruthy()
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/locale', expect.objectContaining({ body: JSON.stringify({ metadataLanguage: 'ru' }) }))
    expect(screen.getByRole('button', { name: locale === 'ru' ? 'Русский' : 'English' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'original' } })
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(2))
    expect(screen.queryByText(hint)).toBeNull()
  })

  it('keeps metadata coverage information out of the interface-only login control', () => {
    render(<LocaleProvider locale="ru" metadataLanguage="ru"><LanguageToggle interfaceOnly /></LocaleProvider>)
    expect(screen.queryByText(/Дополнительные русские названия/)).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('renders the server locale without an English hydration flash', () => {
    render(<LocaleProvider locale="ru"><LanguageToggle /><Label /></LocaleProvider>)
    expect(screen.getByText('Библиотека')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Русский' }).getAttribute('aria-pressed')).toBe('true')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('switches despite blocked localStorage and confirms the cookie via API before refreshing', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked storage') })
    render(<LocaleProvider locale="en"><LanguageToggle /><Label /></LocaleProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Русский' }))
    await screen.findByText('Библиотека')
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    expect(fetch).toHaveBeenCalledWith('/api/locale', expect.objectContaining({ method: 'POST', body: JSON.stringify({ locale: 'ru' }) }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('keeps failed persistence retryable without unhandled rejection or refreshing to a stale locale', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Offline'))
    render(<LocaleProvider locale="en"><LanguageToggle /><Label /></LocaleProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Русский' }))
    await screen.findByRole('alert')
    expect(document.documentElement.lang).toBe('ru')
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Русский' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Русский' }))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
