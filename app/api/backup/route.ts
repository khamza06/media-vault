import {
  createBackupPayload,
  getVaultExportFilename,
  recordToVaultExportItem,
  serializeVaultExportCsv,
} from '../../../lib/backup'
import { getItemsForBackupExport } from '../../../lib/data/items'
import type { MediaItemRecord } from '../../../lib/media'
import { getCurrentUser } from '../../../lib/auth/dal'
import { getCollectionsForBackupExport } from '../../../lib/data/backup-collections'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!await getCurrentUser()) return Response.json({ error: 'Sign in to export your vault.' }, { status: 401, headers })
  const result = await getItemsForBackupExport()

  if (result.error) {
    return Response.json({ error: 'Could not export your vault. Please try again or check the database setup.' }, { status: 500, headers })
  }

  const items = ((result.data ?? []) as MediaItemRecord[]).map(recordToVaultExportItem)
  const format = new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'json'

  if (format === 'csv') {
    return new Response(serializeVaultExportCsv(items), {
      status: 200,
      headers: {
        ...headers,
        'Content-Disposition': `attachment; filename="${getVaultExportFilename('csv')}"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    })
  }

  const collections = await getCollectionsForBackupExport(items.map((item) => item.id))
  if (collections.error) return Response.json({ error: collections.error }, { status: 500, headers })
  const payload = createBackupPayload(items, collections.lists)

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      ...headers,
      'Content-Disposition': `attachment; filename="${getVaultExportFilename('json')}"`,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
