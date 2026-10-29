import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

function worker() {
  const handlers: Record<string, (event: { waitUntil: (p: Promise<unknown>) => void; respondWith?: (p: Promise<unknown>) => void; request?: unknown }) => void> = {}
  const entries = new Map<string, Map<string, Response>>([
    ['media-vault-shell-v2', new Map([['/offline', new Response('PRIVATE ACCOUNT')]])],
    ['other-app-cache', new Map()],
  ])
  const requests: Array<{ url: string; credentials: string }> = []
  const source = readFileSync('public/sw.js', 'utf8')
  class ShellRequest {
    url: string; credentials: string
    constructor(input: string | { url: string }, options: { credentials: string }) {
      this.url = typeof input === 'string' ? input : input.url
      this.credentials = options.credentials
    }
  }
  vm.runInNewContext(source, {
    Request: ShellRequest, Response, URL,
    fetch: async () => { throw new Error('offline') },
    self: { location: { origin: 'https://vault.invalid' }, addEventListener: (name: string, handler: typeof handlers[string]) => { handlers[name] = handler }, skipWaiting: () => {}, clients: { claim: async () => {} } },
    caches: {
      keys: async () => [...entries.keys()], delete: async (name: string) => entries.delete(name),
      open: async (name: string) => {
        if (!entries.has(name)) entries.set(name, new Map())
        const cache = entries.get(name)!
        return {
          addAll: async (inputs: ShellRequest[]) => { requests.push(...inputs); for (const input of inputs) cache.set(input.url, new Response('PUBLIC OFFLINE')) },
          match: async (url: string) => cache.get(url),
        }
      },
    },
  })
  return { handlers, entries, requests }
}
describe('offline cache authorization boundary', () => {
  it('prefetches only static shell URLs without credentials and removes the old private shell', async () => {
    const w = worker()
    let pending = Promise.resolve<unknown>(null)
    w.handlers.install({ waitUntil: p => { pending = p } }); await pending
    expect(w.requests.every(req => req.credentials === 'omit')).toBe(true)
    expect(w.requests.map(req => req.url)).toContain('/offline.html')
    expect(w.requests.map(req => req.url)).not.toContain('/offline')
    w.handlers.activate({ waitUntil: p => { pending = p } }); await pending
    expect(w.entries.has('media-vault-shell-v2')).toBe(false)
    expect(w.entries.has('other-app-cache')).toBe(true)
    expect(w.entries.has('media-vault-shell-v4')).toBe(true)
  })
  it('serves the static fallback for failed navigation but never intercepts writes or arbitrary images', async () => {
    const w = worker()
    let pending = Promise.resolve<unknown>(null)
    w.handlers.install({ waitUntil: p => { pending = p } }); await pending
    let response: Promise<unknown> | undefined
    w.handlers.fetch({ waitUntil: () => {}, request: { method: 'GET', mode: 'navigate', url: 'https://vault.invalid/login' }, respondWith: p => { response = p } })
    expect(await (await response as Response).text()).toBe('PUBLIC OFFLINE')
    for (const request of [{ method: 'POST', url: 'https://vault.invalid/' }, { method: 'GET', url: 'https://vault.invalid/private-cover.png', destination: 'image' }]) {
      response = undefined
      w.handlers.fetch({ waitUntil: () => {}, request, respondWith: p => { response = p } })
      expect(response).toBeUndefined()
    }
  })
  it('ships a self-contained fallback with no React hydration or account state', () => {
    const html = readFileSync('public/offline.html', 'utf8')
    expect(html).toContain('Media Vault is temporarily offline')
    expect(html).toContain('lang="ru"')
    expect(html).not.toMatch(/_next\/|userId|accountLabel|<link[^>]*stylesheet/)
    expect(html.match(/<script[^>]*>/g)).toEqual(['<script src="/offline-locale.js" defer>'])
    const script = readFileSync('public/offline-locale.js', 'utf8')
    expect(script).not.toMatch(/fetch\(|access[_-]?token|refresh[_-]?token|userId|Authorization/)
    expect(script).toContain('media-vault-locale=')
  })
})
