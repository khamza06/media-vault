import type { Metadata } from 'next'

import ImportBackupForm from '../../components/ImportBackupForm'
import SetupNotice from '../../components/SetupNotice'
import VaultExportSection from '../../components/VaultExportSection'
import { recordToVaultExportItem } from '../../lib/backup'
import { getItemsForBackupExport } from '../../lib/data/items'
import { getCollectionsForBackupExport } from '../../lib/data/backup-collections'
import { getOwnershipMode } from '../../lib/data/ownership'
import type { MediaItemRecord } from '../../lib/media'

export const revalidate = 0
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Backup | Media Vault',
  description: 'Export and import your media vault as JSON or CSV.',
}

export default async function BackupPage() {
  const [itemsResult, ownershipMode] = await Promise.all([
    getItemsForBackupExport(),
    getOwnershipMode(),
  ])
  const { data, error } = itemsResult

  if (error) {
    throw new Error(error.message)
  }

  const totalItems = data?.length ?? 0
  const exportItems = ((data ?? []) as MediaItemRecord[]).map(recordToVaultExportItem)
  const collections = await getCollectionsForBackupExport(exportItems.map((item) => item.id))

  return (
    <main className="vault-page">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-blue-300/70">
          Safety
        </p>
        <h1 className="vault-title mt-3">
          Backup Center
        </h1>
        <p className="mt-3 max-w-2xl text-base text-slate-300">
          Export your vault to JSON or CSV, then preview JSON backups before restoring
          selected items into the current account.
        </p>
      </header>

      {ownershipMode === 'legacy' ? <SetupNotice /> : null}

      <section className="mb-8 grid min-w-0 gap-4 md:grid-cols-3">
        <SummaryCard label="Current items" value={String(totalItems)} />
        <SummaryCard label="Export format" value="JSON + CSV" />
        <SummaryCard label="Restore mode" value="Preview + skip duplicates" />
      </section>

      <section className="grid min-w-0 gap-6 lg:grid-cols-2">
        <VaultExportSection items={exportItems} lists={collections.lists} listExportError={collections.error} listExportWarning={collections.warning} />

        <ImportBackupForm />
      </section>
    </main>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel-soft rounded-xl px-5 py-5">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-3 break-words text-2xl font-semibold leading-tight tracking-tight text-white">{value}</p>
    </div>
  )
}
