import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE } from '../lib/auth/constants'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), refreshSession: vi.fn() }))
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ auth: mocks }) }))
import { proxy } from '../proxy'

function request(access = 'old', refresh = 'refresh') {
  return new NextRequest('https://media-vault.app/discover', { headers: {
    cookie: `${AUTH_ACCESS_COOKIE}=${access}; ${AUTH_REFRESH_COOKIE}=${refresh}`,
  } })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } })
  mocks.refreshSession.mockResolvedValue({ data: { session: { access_token: 'fresh-access', refresh_token: 'fresh-refresh' } }, error: null })
})
describe('refresh cookie persistence before rendering', () => {
  it('persists BOTH rotated tokens and forwards them to the current Server Component render', async () => {
    const response = await proxy(request())
    expect(mocks.refreshSession).toHaveBeenCalledWith({ refresh_token: 'refresh' })
    expect(response.cookies.get(AUTH_ACCESS_COOKIE)?.value).toBe('fresh-access')
    expect(response.cookies.get(AUTH_REFRESH_COOKIE)?.value).toBe('fresh-refresh')
    expect(response.headers.get('x-middleware-request-cookie')).toContain('media-vault-access-token=fresh-access')
    expect(response.headers.get('x-middleware-request-cookie')).toContain('media-vault-refresh-token=fresh-refresh')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    for (const cookie of response.cookies.getAll()) {
      expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 604800 })
    }
    // Browser's next request uses the persisted pair, with no second refresh.
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
    await proxy(request('fresh-access', 'fresh-refresh'))
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1)
  })
  it('can recover when the access cookie is missing', async () => {
    expect((await proxy(request(''))).cookies.get(AUTH_ACCESS_COOKIE)?.value).toBe('fresh-access')
    expect(mocks.getUser).not.toHaveBeenCalled()
  })
  it('does not refresh guests or rotate a valid access token', async () => {
    await proxy(new NextRequest('https://media-vault.app/'))
    expect(mocks.refreshSession).not.toHaveBeenCalled()
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
    expect((await proxy(request())).cookies.getAll()).toEqual([])
    expect(mocks.refreshSession).not.toHaveBeenCalled()
  })
  it('preserves browser cookies on provider outages and fails closed downstream', async () => {
    mocks.refreshSession.mockRejectedValue(new Error('offline'))
    const response = await proxy(request())
    expect(response.cookies.getAll()).toEqual([])
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
  it('does not persist a rejected refresh', async () => {
    mocks.refreshSession.mockResolvedValue({ data: { session: null }, error: { status: 400 } })
    expect((await proxy(request())).cookies.getAll()).toEqual([])
  })
})
