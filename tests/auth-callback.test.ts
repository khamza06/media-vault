import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn(), persistSession: vi.fn() }))
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ auth: mocks }) }))
vi.mock('../lib/auth/session', () => mocks)

import { GET as callback } from '../app/auth/callback/route'
import { GET as confirm } from '../app/auth/confirm/route'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.verifyOtp.mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null })
})

describe.each([['callback', callback], ['confirm', confirm]] as const)('%s email links', (_, handler) => {
  it('keeps signup redirects local and persists only a verified session', async () => {
    const response = await handler(new Request('https://media-vault.app/auth/callback?token_hash=test-hash&type=signup&next=%2F%5Cexample.com'))
    expect(response.headers.get('location')).toBe('https://media-vault.app/?confirmed=1')
    expect(mocks.persistSession).toHaveBeenCalledOnce()
  })

  it('sends verified recovery links to the password form', async () => {
    const response = await handler(new Request('https://media-vault.app/auth/callback?token_hash=test-hash&type=recovery'))
    expect(response.headers.get('location')).toBe('https://media-vault.app/auth/reset-password?ready=1')
  })

  it('rejects undocumented OTP types without calling Supabase', async () => {
    await handler(new Request('https://media-vault.app/auth/callback?token_hash=test-hash&type=sms'))
    expect(mocks.verifyOtp).not.toHaveBeenCalled()
    expect(mocks.persistSession).not.toHaveBeenCalled()
  })

  it('never persists an expired or invalid link', async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'Expired' } })
    const response = await handler(new Request('https://media-vault.app/auth/callback?token_hash=test-hash&type=signup'))
    expect(response.headers.get('location')).toBe('https://media-vault.app/login?authError=invalid-link')
    expect(mocks.persistSession).not.toHaveBeenCalled()
  })
})
