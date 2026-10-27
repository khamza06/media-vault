import { afterEach, describe, expect, it, vi } from 'vitest'

import { getEmailOtpType, getSafeAuthNextPath } from '../lib/auth/redirects'
import { getConfiguredSiteUrl } from '../lib/auth/site-url'
import { validateAuthInput, validatePasswordInput } from '../lib/auth/validation'

afterEach(() => vi.unstubAllEnvs())

describe('auth credentials', () => {
  it('normalizes the email without modifying the password', () => {
    expect(validateAuthInput({ email: ' reader@example.com ', password: ' secret ' }).data)
      .toEqual({ email: 'reader@example.com', password: ' secret ' })
  })

  it.each(['', 'short'])('rejects short passwords: %j', (password) => {
    expect(validatePasswordInput(password).error).toBeTruthy()
  })
})

describe('auth return paths', () => {
  it.each([null, '', 'https://example.com', '//example.com', '/\\example.com', '/\n/example.com', '/\texample.com', '//[invalid'])('rejects unsafe next=%j', (value) => {
    expect(getSafeAuthNextPath(value)).toBe('/')
  })

  it('keeps local paths and filters intact', () => {
    expect(getSafeAuthNextPath('/shelves/anime?status=Completed&q=One%20Piece#items'))
      .toBe('/shelves/anime?status=Completed&q=One%20Piece#items')
  })

  it('only accepts documented email OTP types', () => {
    expect(getEmailOtpType('recovery')).toBe('recovery')
    expect(getEmailOtpType('signup')).toBe('signup')
    expect(getEmailOtpType('sms')).toBeNull()
    expect(getEmailOtpType(null)).toBeNull()
  })
})

describe('site URL configuration', () => {
  it('prefers the explicit domain and removes trailing slashes', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://media-vault.app///')
    expect(getConfiguredSiteUrl()).toBe('https://media-vault.app')
  })

  it('keeps explicit localhost configuration for development', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
    expect(getConfiguredSiteUrl()).toBe('http://localhost:3000')
  })

  it('does not default production to localhost', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(getConfiguredSiteUrl()).toBe('https://media-vault.app')
  })
})
