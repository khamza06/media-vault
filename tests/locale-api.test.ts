import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ set: vi.fn(), get: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: async () => ({ set: mocks.set, get: mocks.get }) }))
import { POST } from '../app/api/locale/route'
import { getRequestLocale, getRequestMetadataLanguage } from '../lib/i18n-server'
beforeEach(() => mocks.get.mockReturnValue(undefined))
describe('locale preference cookie', () => {
  it.each([{ metadataLanguage: 'ja' }, { metadataLanguage: {} }, { locale: 'ru', metadataLanguage: 'invalid' }, { locale: 'invalid', metadataLanguage: 'ru' }])('rejects invalid mixed preferences atomically: %j', async body => {
    const response = await POST(new Request('https://media-vault.app/api/locale', { method: 'POST', body: JSON.stringify(body) }))
    expect(response.status).toBe(400)
    expect(mocks.set).not.toHaveBeenCalled()
  })
  it.each(['en', 'ru', 'original'])('persists metadata %s without setting the UI preference or a public profile field', async metadataLanguage => {
    const response = await POST(new Request('https://media-vault.app/api/locale', { method: 'POST', body: JSON.stringify({ metadataLanguage }) }))
    expect(await response.json()).toEqual({ success: true, metadataLanguage })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith('media-vault-metadata-language', metadataLanguage, expect.objectContaining({ path: '/', sameSite: 'lax' }))
  })
  it('reads the independent metadata cookie and defaults existing browsers to English', async () => {
    expect(await getRequestMetadataLanguage()).toBe('en')
    mocks.get.mockReturnValueOnce({ value: 'original' })
    expect(await getRequestMetadataLanguage()).toBe('original')
  })
  it.each(['en', 'ru'])('sets only the harmless %s preference cookie', async (locale) => {
    const response = await POST(new Request('https://media-vault.app/api/locale', { method: 'POST', body: JSON.stringify({ locale }) }))
    expect(await response.json()).toEqual({ success: true, locale })
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith('media-vault-locale', locale, expect.objectContaining({ path: '/', sameSite: 'lax' }))
  })
  it.each([null, [], {}, { locale: {} }, { locale: 'unsupported' }])('rejects malformed/unsupported preferences', async (body) => {
    expect((await POST(new Request('https://media-vault.app/api/locale', { method: 'POST', body: JSON.stringify(body) }))).status).toBe(400)
    expect(mocks.set).not.toHaveBeenCalled()
  })
  it('reads locale per request rather than forcing English or using a global cache', async () => {
    mocks.get.mockReturnValueOnce({ value: 'ru' })
    expect(await getRequestLocale()).toBe('ru')
    mocks.get.mockReturnValueOnce({ value: 'invalid' })
    expect(await getRequestLocale()).toBe('en')
    expect(mocks.get).toHaveBeenCalledWith('media-vault-locale')
  })
})
