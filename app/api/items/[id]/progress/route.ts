import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '../../../../../lib/auth/dal'
import { createSupabaseServerClient } from '../../../../../lib/supabase/server'
import { shelfDefinitions } from '../../../../../lib/shelves'
import { isProgressSnapshot } from '../../../../../lib/progress'

const headers = { 'Cache-Control': 'private, no-store' }
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers })

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return reply({ error: 'Sign in required.' }, 401)
  // Reject cross-origin submissions even when the browser has an existing session.
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return reply({ error: 'Invalid origin.' }, 403)
  const { id } = await context.params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return reply({ error: 'Invalid item.' }, 400)
  let body: { progress?: unknown; lastProgressAt?: unknown }
  try {
    const reader = request.body?.getReader()
    if (!reader) return reply({ error: 'Invalid request.' }, 400)
    const chunks: Uint8Array[] = []; let bytes = 0
    try { for (;;) { const { value, done } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 1024) return reply({ error: 'Request too large.' }, 413); chunks.push(value) } }
    finally { await reader.cancel().catch(() => {}) }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return reply({ error: 'Invalid request.' }, 400)
    body = parsed
  } catch { return reply({ error: 'Invalid request.' }, 400) }
  if (!Number.isInteger(body.progress) || (body.progress as number) < 0 || (body.progress as number) > 2147483647 ||
    !(body.lastProgressAt === null || (typeof body.lastProgressAt === 'string' && body.lastProgressAt.length <= 40 && Number.isFinite(Date.parse(body.lastProgressAt))))) return reply({ error: 'Invalid progress version.' }, 400)
  try {
    const result = await createSupabaseServerClient(user.accessToken).rpc('advance_item_progress', {
      p_item_id: id, p_expected_progress: body.progress as number, p_expected_last_progress_at: body.lastProgressAt as string | null,
    })
    if (result.error) return reply({ error: 'Progress could not be confirmed. Retry safely.' }, 503)
    if (!result.data) return reply({ error: 'Item not found in your vault.' }, 404)
    if (!isProgressSnapshot(result.data, id)) return reply({ error: 'Invalid progress response.' }, 503)
    if (result.data.outcome === 'updated') {
      // A Route Handler invalidates future visits without waiting for the Library's
      // recommendation providers to render before acknowledging a simple +1.
      try {
        for (const path of ['/', '/stats', '/summary', `/items/${id}`, `/items/${id}/edit`, ...shelfDefinitions.map(shelf => `/shelves/${shelf.slug}`)]) revalidatePath(path)
      } catch { console.warn('Progress saved; view invalidation unavailable.') }
    }
    return reply({ data: result.data }, result.data.outcome === 'conflict' ? 409 : 200)
  } catch { return reply({ error: 'Progress could not be confirmed. Retry safely.' }, 503) }
}
