import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), get: vi.fn() }))
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }))
vi.mock('node:http', () => ({ get: mocks.get }))
vi.mock('node:https', () => ({ get: mocks.get }))
import { fetchPublicPage, isPublicAddress, validatePageUrl } from '../lib/safe-page-fetch'

type ResponseFixture = { status?: number; headers?: Record<string, string>; body?: string }
let responses: ResponseFixture[]
beforeEach(() => {
  mocks.lookup.mockResolvedValue([{ address: '93.184.215.14', family: 4 }])
  responses = [{ status: 404 }, { body: '<title>Fixture</title>', headers: { 'content-type': 'text/html; charset=utf-8' } }]
  mocks.get.mockImplementation((...args) => {
    const fixture = responses.shift() ?? { status: 500 }
    const req = new EventEmitter() as EventEmitter & { setTimeout: () => void; destroy: () => void }
    req.setTimeout = vi.fn(); req.destroy = vi.fn()
    queueMicrotask(() => {
      const res = new PassThrough() as PassThrough & { statusCode: number; headers: Record<string, string> }
      res.statusCode = fixture.status ?? 200; res.headers = fixture.headers ?? {}
      args[2](res)
      if (!res.destroyed) res.end(fixture.body ?? '')
    })
    return req
  })
})
afterEach(() => vi.clearAllMocks())

describe('untrusted URL fetch boundary', () => {
  it.each(['file:///etc/passwd', 'http://localhost', 'http://127.0.0.1', 'http://2130706433', 'http://0x7f000001', 'http://[::1]', 'http://[::ffff:127.0.0.1]', 'https://host.local/a', 'https://host.internal/a', 'https://user:password@example.org/', 'https://example.org:444/a', 'https://example.org/?access_token=secret'])('rejects unsafe URL %s before DNS or network', async url => {
    expect(() => validatePageUrl(url)).toThrow('unsafe-url')
    expect(mocks.lookup).not.toHaveBeenCalled()
    expect(mocks.get).not.toHaveBeenCalled()
  })
  it.each(['10.0.0.1', '172.16.1.1', '192.168.1.1', '100.64.0.1', '169.254.169.254', '0.0.0.0', '224.0.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:10.0.0.1', '2001:db8::1'])('rejects non-public DNS address %s', address => expect(isPublicAddress(address)).toBe(false))
  it('rejects mixed private/public DNS answers and never connects', async () => {
    mocks.lookup.mockResolvedValue([{ address: '93.184.215.14', family: 4 }, { address: '127.0.0.1', family: 4 }])
    await expect(fetchPublicPage('https://example.org/title')).rejects.toThrow('unsafe-url')
    expect(mocks.get).not.toHaveBeenCalled()
  })
  it('pins each connection to its checked address rather than resolving a second time', async () => {
    expect(await fetchPublicPage('https://example.org/title')).toMatchObject({ html: '<title>Fixture</title>' })
    const options = mocks.get.mock.calls[1][1]
    const callback = vi.fn()
    options.lookup('example.org', {}, callback)
    expect(callback).toHaveBeenCalledWith(null, '93.184.215.14', 4)
    expect(options).toMatchObject({ agent: false, family: 4 })
    expect(options.headers.Cookie).toBeUndefined()
    expect(mocks.get.mock.calls.map(call => call[0].pathname)).toEqual(['/robots.txt', '/title'])
  })
  it('obeys robots.txt and stops before requesting a disallowed page', async () => {
    responses = [{ body: 'User-agent: *\nDisallow: /private', headers: { 'content-type': 'text/plain' } }]
    await expect(fetchPublicPage('https://example.org/private/book')).rejects.toThrow('robots-denied')
    expect(mocks.get).toHaveBeenCalledTimes(1)
  })
  it('rejects redirects into internal networks, without connecting to the redirect target', async () => {
    responses[1] = { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }
    await expect(fetchPublicPage('https://example.org/title')).rejects.toThrow('unsafe-url')
    expect(mocks.get).toHaveBeenCalledTimes(2)
  })
  it('rechecks DNS after a public redirect and blocks rebinding', async () => {
    responses[1] = { status: 302, headers: { location: '/next' } }
    mocks.lookup.mockResolvedValueOnce([{ address: '93.184.215.14', family: 4 }]).mockResolvedValueOnce([{ address: '93.184.215.14', family: 4 }]).mockResolvedValueOnce([{ address: '10.1.1.1', family: 4 }])
    await expect(fetchPublicPage('https://example.org/title')).rejects.toThrow('unsafe-url')
    expect(mocks.get).toHaveBeenCalledTimes(2)
  })
  it.each([
    { headers: { 'content-type': 'application/pdf' } },
    { headers: { 'content-type': 'text/html', 'content-length': '9999999' } },
    { headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' } },
    { headers: { 'content-type': 'text/html' }, body: 'x'.repeat(512 * 1024 + 1) },
    { headers: { 'content-type': 'text/html', 'x-robots-tag': 'noindex' } },
  ] as ResponseFixture[])('enforces MIME, size, compression and page restrictions', async fixture => {
    responses[1] = fixture
    await expect(fetchPublicPage('https://example.org/title')).rejects.toThrow()
  })
  it('aborts before any network request when its deadline has expired', async () => {
    await expect(fetchPublicPage('https://example.org/title', AbortSignal.abort())).rejects.toThrow()
    expect(mocks.get).not.toHaveBeenCalled()
  })
})
