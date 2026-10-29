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
