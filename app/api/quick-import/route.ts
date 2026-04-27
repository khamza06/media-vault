import { getCurrentUser } from '../../../lib/auth/dal'
import { buildQuickImportDraft } from '../../../lib/quick-import-draft'
import { getRequestLocale } from '../../../lib/i18n-server'
import { resolveLocale } from '../../../lib/i18n'
import { resolveQuickImport } from '../../../lib/quick-import-resolver'

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: { locale?: string; url?: string }

  try {
    payload = (await request.json()) as { url?: string }
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const url = payload.url?.trim()
  const locale = resolveLocale(payload.locale ?? (await getRequestLocale()))

  if (!url) {
    return Response.json({ error: 'Paste a URL first.' }, { status: 400 })
  }

  try {
    const data = await resolveQuickImport(url, locale)
    return Response.json({ data })
  } catch (error) {
    const fallback = buildQuickImportDraft(url)

    if (fallback) {
      return Response.json({ data: fallback })
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Quick import failed.',
      },
      { status: 400 }
    )
  }
}
