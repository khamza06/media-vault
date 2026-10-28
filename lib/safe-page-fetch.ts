import 'server-only'

import { lookup } from 'node:dns/promises'
import { get as httpGet } from 'node:http'
import { get as httpsGet } from 'node:https'
import ipaddr from 'ipaddr.js'
import robotsParser from 'robots-parser'

const AGENT = 'MediaVault/1.0 (+https://media-vault.app)'
const MAX_HTML = 512 * 1024
const MAX_ROBOTS = 64 * 1024

export class PageFetchError extends Error {
  constructor(public code: 'unsafe-url' | 'robots-denied' | 'metadata-unavailable') { super(code) }
}

export function isPublicAddress(address: string) {
  try { return ipaddr.process(address).range() === 'unicast' } catch { return false }
}

export function validatePageUrl(value: string) {
  let url: URL
  try { url = new URL(value) } catch { throw new PageFetchError('unsafe-url') }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (value.length > 2048 || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
    !host.includes('.') || host.endsWith('.') || /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example|onion)$/.test(host) ||
    ipaddr.isValid(host) || /[\u0000-\u0020\\]/.test(value) ||
    [...url.searchParams.keys()].some(key => /token|password|authorization|session|api[_-]?key|signature|^x-amz-/i.test(key))) throw new PageFetchError('unsafe-url')
  url.hash = ''
  return url
}

// Resolve once, reject mixed public/private answers, and pin the connection to
// the validated IP. TLS still verifies the original hostname. No proxy, cookies,
// ambient credentials, automatic redirects or shared connection pool are used.
async function requestPublic(url: URL, signal: AbortSignal, limit: number, html: boolean) {
  signal.throwIfAborted()
  const addresses = await new Promise<Array<{ address: string; family: number }>>((resolve, reject) => {
    const abort = () => reject(new PageFetchError('metadata-unavailable'))
    signal.addEventListener('abort', abort, { once: true })
    lookup(url.hostname, { all: true, verbatim: true }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
  if (!addresses.length || addresses.length > 32 || addresses.some(entry => !isPublicAddress(entry.address))) throw new PageFetchError('unsafe-url')
  const pinned = addresses.find(entry => entry.family === 4) ?? addresses[0]
  signal.throwIfAborted()
  return new Promise<{ status: number; location?: string; contentType: string; body: string; restricted: boolean }>((resolve, reject) => {
    const get = url.protocol === 'https:' ? httpsGet : httpGet
    const req = get(url, {
      agent: false,
      signal,
      family: pinned.family,
      lookup: (...args) => args[2](null, pinned.address, pinned.family),
      headers: { 'User-Agent': AGENT, Accept: html ? 'text/html,application/xhtml+xml' : 'text/plain', 'Accept-Encoding': 'identity' },
      maxHeaderSize: 16 * 1024,
    }, response => {
      const status = response.statusCode ?? 0
      const contentType = String(response.headers['content-type'] ?? '').toLowerCase()
      const result = { status, location: response.headers.location, contentType, body: '', restricted: /noindex|nosnippet|noai/i.test(String(response.headers['x-robots-tag'] ?? '')) }
      if (status < 200 || status >= 300) { response.destroy(); resolve(result); return }
      if ((html ? !/^(text\/html|application\/xhtml\+xml)(?:;|$)/.test(contentType) : !/^(text\/plain|text\/html)(?:;|$)/.test(contentType)) ||
        Number(response.headers['content-length'] ?? 0) > limit || !['', 'identity'].includes(String(response.headers['content-encoding'] ?? ''))) {
        response.destroy(); reject(new PageFetchError('metadata-unavailable')); return
      }
      let size = 0
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > limit) { response.destroy(); reject(new PageFetchError('metadata-unavailable')); return }
        chunks.push(chunk)
      })
      response.on('error', () => reject(new PageFetchError('metadata-unavailable')))
      response.on('end', () => {
        try {
          const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType)?.[1] ?? 'utf-8'
          resolve({ ...result, body: new TextDecoder(charset, { fatal: false }).decode(Buffer.concat(chunks)) })
        } catch { reject(new PageFetchError('metadata-unavailable')) }
      })
    })
    req.on('error', () => reject(new PageFetchError('metadata-unavailable')))
    req.setTimeout(4000, () => req.destroy())
  })
}

export async function fetchPublicPage(value: string, parentSignal?: AbortSignal) {
  const signal = parentSignal ? AbortSignal.any([parentSignal, AbortSignal.timeout(6500)]) : AbortSignal.timeout(6500)
  let url = validatePageUrl(value)
  const robotsByOrigin = new Map<string, ReturnType<typeof robotsParser> | null>()
  for (let redirects = 0; redirects <= 2; redirects++) {
    if (!robotsByOrigin.has(url.origin)) {
      const robotsUrl = new URL('/robots.txt', url)
      const response = await requestPublic(robotsUrl, signal, MAX_ROBOTS, false)
      if ([404, 410].includes(response.status)) robotsByOrigin.set(url.origin, null)
      else if (response.status === 200) robotsByOrigin.set(url.origin, robotsParser(robotsUrl.href, response.body))
      else throw new PageFetchError('robots-denied') // Includes robot redirects, 403, 429 and 5xx: fail closed.
    }
    const robots = robotsByOrigin.get(url.origin)
    if (robots && (robots.isDisallowed(url.href, AGENT) || (robots.getCrawlDelay(AGENT) ?? 0) > 0)) throw new PageFetchError('robots-denied')
    const response = await requestPublic(url, signal, MAX_HTML, true)
    if ([301, 302, 303, 307, 308].includes(response.status) && response.location && redirects < 2) {
      const next = validatePageUrl(new URL(response.location, url).href)
      if (url.protocol === 'https:' && next.protocol !== 'https:') throw new PageFetchError('unsafe-url')
      url = next
      continue
    }
    if (response.status !== 200 || response.restricted) throw new PageFetchError('metadata-unavailable')
    return { html: response.body, url: url.href }
  }
  throw new PageFetchError('metadata-unavailable')
}
