import {
  createBackupPayload,
  getVaultExportFilename,
  recordToVaultExportItem,
  serializeVaultExportCsv,
} from '../../../lib/backup'
import { getItemsForBackupExport } from '../../../lib/data/items'
import type { MediaItemRecord } from '../../../lib/media'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const result = await getItemsForBackupExport()

  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 })
  }

  const items = ((result.data ?? []) as MediaItemRecord[]).map(recordToVaultExportItem)
  const format = new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'json'

  if (format === 'csv') {
    return new Response(serializeVaultExportCsv(items), {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${getVaultExportFilename('csv')}"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    })
  }

  const payload = createBackupPayload(items)

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Disposition': `attachment; filename="${getVaultExportFilename('json')}"`,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
