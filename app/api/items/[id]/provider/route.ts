import { getRequestMetadataLanguage } from '../../../../../lib/i18n-server'
import { resolveMetadataLanguage } from '../../../../../lib/metadata-language'
import { getCurrentUser } from '../../../../../lib/auth/dal'
import { createSupabaseServerClient } from '../../../../../lib/supabase/server'
import { getAniListProviderDetails } from '../../../../../lib/anilist-import-enrichment'
import { getTmdbProviderDetails } from '../../../../../lib/catalog-search'
import { getProviderReference } from '../../../../../lib/provider-details'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Sign in to load provider details.' }, { status: 401, headers })
  const { id } = await context.params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: 'Invalid item.' }, { status: 400, headers })
  }
  try {
    const supabase = createSupabaseServerClient(user.accessToken)
    const item = await supabase.from('items').select('id, type, external_source, external_id')
      .eq('id', id).eq('user_id', user.id).maybeSingle()
    if (item.error) return Response.json({ error: 'Could not load this item.' }, { status: 500, headers })
    if (!item.data) return Response.json({ error: 'Item not found in your vault.' }, { status: 404, headers })
    const ref = getProviderReference({ type: item.data.type, externalSource: item.data.external_source, externalId: item.data.external_id })
    if (!ref) return Response.json({ error: 'This item has no supported provider ID. Personal tracking is still available.' }, { status: 422, headers })
    const data = ref.provider === 'anilist'
      ? await getAniListProviderDetails(ref.id, ref.type, ref.isMalId)
      : await getTmdbProviderDetails(ref.id, ref.type, resolveMetadataLanguage(new URL(_request.url).searchParams.get('metadataLanguage') ?? await getRequestMetadataLanguage()), _request.signal)
    return data ? Response.json({ data }, { headers })
      : Response.json({ error: 'Provider details are unavailable right now. Your saved item has not changed.' }, { status: 502, headers })
  } catch {
    return Response.json({ error: 'Could not load provider details. Please try again.' }, { status: 502, headers })
  }
}
