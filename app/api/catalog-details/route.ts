import { getCurrentUser } from '../../../lib/auth/dal'
import { getTmdbCandidateById } from '../../../lib/catalog-search'
import { parseProviderMediaId } from '../../../lib/provider-ids'

export async function POST(request: Request) {
  if (!await getCurrentUser()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const input = body as { id?: unknown; type?: unknown } | null
  if (!input || typeof input.id !== 'string' || (input.type !== 'movie' && input.type !== 'series')) {
    return Response.json({ error: 'Invalid catalog item.' }, { status: 400 })
  }
  const type = input.type === 'movie' ? 'movie' : 'tv'
  const id = parseProviderMediaId(input.id, 'tmdb', type)
  if (!id) return Response.json({ error: 'Invalid catalog item.' }, { status: 400 })
  const data = await getTmdbCandidateById(id, type)
  return data ? Response.json({ data }) : Response.json({ error: 'Provider details are unavailable. You can still review this title before saving.' }, { status: 502 })
}
