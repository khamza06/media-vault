import { getCurrentUser } from '../../../lib/auth/dal'
import { createSupabaseServerClient } from '../../../lib/supabase/server'

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' }
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401, headers })
  try {
    const result = await createSupabaseServerClient(user.accessToken).from('progress_events')
      .select('id,item_id,media_type,from_progress,to_progress,occurred_at,item:items(title)')
      .eq('user_id', user.id).order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(12)
    if (result.error) return Response.json({ error: 'Recent activity unavailable.' }, { status: 503, headers })
    return Response.json({ data: result.data }, { headers })
  } catch { return Response.json({ error: 'Recent activity unavailable.' }, { status: 503, headers }) }
}
