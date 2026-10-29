import { getCurrentUser } from '../../../lib/auth/dal'
import { getRequestLocale, getRequestMetadataLanguage } from '../../../lib/i18n-server'
import { resolveMetadataLanguage } from '../../../lib/metadata-language'
import { resolveLocale } from '../../../lib/i18n'
import { resolveQuickImport } from '../../../lib/quick-import-resolver'
import { containsBlockedSearchTerm, isCatalogSearchType } from '../../../lib/search-safety'
import { createSupabaseServerClient } from '../../../lib/supabase/server'
import { PageFetchError } from '../../../lib/safe-page-fetch'

export const runtime = 'nodejs'
export const maxDuration = 25

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return json({ error: 'Sign in to identify media.' }, 401)
  let body: Record<string, unknown>
  try {
    const reader = request.body?.getReader()
    if (!reader) return json({ error: 'Invalid request body.' }, 400)
    const chunks: Uint8Array[] = []; let size = 0
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 8192) return json({ error: 'Request is too large.' }, 413); chunks.push(value) } }
    finally { await reader.cancel().catch(() => {}) }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'Invalid request body.' }, 400)
    body = parsed as Record<string, unknown>
  } catch { return json({ error: 'Invalid request body.' }, 400) }
  const input = typeof body.url === 'string' ? body.url.trim() : typeof body.query === 'string' ? body.query.trim() : ''
  if (input.length < 2 || input.length > 2048 || /[\u0000-\u001f]/.test(input)) return json({ error: 'Enter a title (2–200 characters) or a public web URL (up to 2048 characters).' }, 400)
  if (!/^(?:[a-z][a-z0-9+.-]*:\/\/|https?:|file:|data:|javascript:|gopher:|www\.)/i.test(input) && input.length > 200) return json({ error: 'Titles must be 200 characters or fewer.' }, 400)
  if (containsBlockedSearchTerm(input)) return json({ error: 'Please search for a different title.' }, 400)
  if (body.type !== undefined && body.type !== '' && (typeof body.type !== 'string' || !isCatalogSearchType(body.type))) return json({ error: 'Invalid media type.' }, 400)
  const locale = resolveLocale(typeof body.locale === 'string' ? body.locale : await getRequestLocale())
  const metadataLanguage = resolveMetadataLanguage(body.metadataLanguage ?? await getRequestMetadataLanguage())
  let quota: { data: unknown; error: unknown }
  try { quota = await createSupabaseServerClient(user.accessToken).rpc('consume_quick_import_quota') }
  catch { return json({ error: 'Identification is temporarily unavailable. You can still add media manually.' }, 503) }
  if (quota.error) return json({ error: 'Identification is temporarily unavailable. You can still add media manually.' }, 503)
  if (quota.data !== true) return json({ error: 'Too many identification requests. Wait a few minutes, or use the manual form.', code: 'rate-limited' }, 429, { 'Retry-After': '600' })
  try {
    return json({ data: await resolveQuickImport(input, locale, isCatalogSearchType(typeof body.type === 'string' ? body.type : '') ? body.type as import('../../../lib/search-safety').CatalogSearchType : undefined, metadataLanguage) })
  } catch (error) {
    return json({ error: error instanceof PageFetchError && error.code === 'unsafe-url' ? 'This URL cannot be fetched safely. Enter the media title instead.' : 'Identification is unavailable. Enter a title or use the manual form.' }, 400)
  }
}
