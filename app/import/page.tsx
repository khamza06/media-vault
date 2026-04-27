import type { Metadata } from 'next'

import AniListImporter from '@/components/import/AniListImporter'
import CsvImporter from '@/components/import/CsvImporter'
import MalXmlImporter from '@/components/import/MalXmlImporter'
import { getCurrentUser } from '@/lib/auth/dal'

export const metadata: Metadata = {
  title: 'Import Center | Media Vault',
  description: 'Import your existing anime and manga lists into Media Vault.',
}

export default async function ImportPage() {
  const user = await getCurrentUser()

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 pb-32 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl min-w-0">
        <header className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Import tools
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
            Import Center
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Import your existing anime and manga lists into Media Vault.
          </p>
        </header>

        <section className="mb-6 min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-100">AniList Import</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Enter an AniList username to preview and import public anime and manga lists.
            </p>
          </div>

          <AniListImporter canImport={Boolean(user)} />
        </section>

        <section className="mb-6 min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-100">CSV Import</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Upload a spreadsheet-friendly CSV file, map its columns, preview rows, and import
              selected items into your vault.
            </p>
          </div>

          <CsvImporter canImport={Boolean(user)} />
        </section>

        <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-100">MyAnimeList XML Import</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Upload a MyAnimeList XML export, preview your titles, then import selected items into
              your vault.
            </p>
          </div>

          <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-400">
            Your XML file is parsed locally in your browser for preview. Selected items are only
            saved when you click Import selected items.
          </div>

          <MalXmlImporter canDeleteMalImports={Boolean(user)} />
        </section>
      </div>
    </main>
  )
}
