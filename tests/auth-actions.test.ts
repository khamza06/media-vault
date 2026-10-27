import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(), signUp: vi.fn(), resend: vi.fn(),
  resetPasswordForEmail: vi.fn(), setSession: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
  getAuthSession: vi.fn(), persistSession: vi.fn(), clearSession: vi.fn(), revalidatePath: vi.fn(),
}))

vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ auth: mocks }) }))
vi.mock('../lib/auth/session', () => mocks)
vi.mock('next/cache', () => mocks)
vi.mock('../lib/auth/urls', () => ({
  getAuthCallbackUrl: async () => 'https://media-vault.app/auth/callback?next=%2F',
  getPasswordResetUrl: async () => 'https://media-vault.app/auth/reset-password',
}))

import { loginAction, logoutAction, requestPasswordResetAction, resendSignupConfirmationAction, signupAction, updatePasswordAction } from '../app/actions/auth'

const credentials = { email: 'reader@example.com', password: ' test-password ' }
const session = { access_token: 'test-access-token', refresh_token: 'test-refresh-token' }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getAuthSession.mockResolvedValue({ accessToken: session.access_token, refreshToken: session.refresh_token })
  mocks.setSession.mockResolvedValue({ data: { session }, error: null })
  mocks.updateUser.mockResolvedValue({ error: null })
})

describe('auth actions', () => {
  it('passes the original password and only persists a real session', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session }, error: null })
    expect((await loginAction(credentials)).status).toBe('signed-in')
    expect(mocks.signInWithPassword).toHaveBeenCalledWith(credentials)
    expect(mocks.persistSession).toHaveBeenCalledWith(session)
  })

  it('does not sign in on invalid credentials', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } })
    expect((await loginAction(credentials)).success).toBe(false)
    expect(mocks.persistSession).not.toHaveBeenCalled()
  })

  it('distinguishes an unconfirmed email from a network failure', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Email not confirmed' } })
    expect((await loginAction(credentials)).status).toBe('email-unconfirmed')
    mocks.signInWithPassword.mockRejectedValue(new Error('offline'))
    expect((await loginAction(credentials)).error).toContain('cannot reach')
  })

  it('does not claim a sign-in or resend when signup requires confirmation', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null })
    const result = await signupAction(credentials)
    expect(result.status).toBe('confirmation-required')
    expect(result.message).not.toContain('again')
    expect(mocks.resend).not.toHaveBeenCalled()
    expect(mocks.persistSession).not.toHaveBeenCalled()
  })

  it('accepts an immediate signup session when confirmation is disabled', async () => {
    mocks.signUp.mockResolvedValue({ data: { session }, error: null })
    expect((await signupAction(credentials)).status).toBe('signed-in')
    expect(mocks.persistSession).toHaveBeenCalledWith(session)
  })

  it('uses the same production redirect for signup and resend', async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null })
    mocks.resend.mockResolvedValue({ error: null })
    await signupAction(credentials)
    await resendSignupConfirmationAction(credentials.email)
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { emailRedirectTo: 'https://media-vault.app/auth/callback?next=%2F' } }))
    expect(mocks.resend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', options: { emailRedirectTo: 'https://media-vault.app/auth/callback?next=%2F' } }))
  })

  it('uses the production recovery route', async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null })
    expect((await requestPasswordResetAction(credentials.email)).status).toBe('reset-sent')
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(credentials.email, { redirectTo: 'https://media-vault.app/auth/reset-password' })
  })

  it('restores the Auth session before updating the password', async () => {
    expect((await updatePasswordAction(credentials.password)).success).toBe(true)
    expect(mocks.setSession).toHaveBeenCalledWith(session)
    expect(mocks.persistSession).toHaveBeenCalledWith(session)
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: credentials.password })
    expect(mocks.setSession.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateUser.mock.invocationCallOrder[0])
  })

  it('does not update a password without a valid session', async () => {
    mocks.getAuthSession.mockResolvedValue(null)
    expect((await updatePasswordAction(credentials.password)).success).toBe(false)
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('does not update after session restoration fails', async () => {
    mocks.setSession.mockResolvedValue({ data: { session: null }, error: { message: 'Expired' } })
    expect((await updatePasswordAction(credentials.password)).success).toBe(false)
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('revokes only this session and clears local cookies on logout', async () => {
    await logoutAction()
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(mocks.clearSession).toHaveBeenCalled()
  })

  it('clears local cookies even when the provider is offline', async () => {
    mocks.setSession.mockRejectedValue(new Error('offline'))
    await expect(logoutAction()).resolves.toMatchObject({ success: true })
    expect(mocks.clearSession).toHaveBeenCalled()
  })
})
