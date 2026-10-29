
import { ui } from '../../lib/ui-i18n'
import { getRequestLocale } from '../../lib/i18n-server'
import type { Metadata } from 'next'
import Link from 'next/link'

import CatalogDiscover from '../../components/catalog/CatalogDiscover'
import { requireCurrentUser } from '../../lib/auth/dal'
import { getItems } from '../../lib/data/items'
import { getCustomLists } from '../../lib/data/lists'
import { toMediaItem } from '../../lib/media'

export const dynamic = 'force-dynamic'
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return { title: ui(locale, "Discover"), description: ui(locale, "Search external catalogs and find your next title.") }
}

export default async function DiscoverPage() {
  const locale = await getRequestLocale()

  await requireCurrentUser()
  const [itemsResult, listsResult] = await Promise.all([getItems(), getCustomLists()])
  const ownedItems = (itemsResult.data ?? []).map(toMediaItem).map((item) => ({
    id: item.id, title: item.title, type: item.type,
    externalSource: item.externalSource, externalId: item.externalId,
  }))
  return (
    <main className="vault-page">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75"> {ui(locale, "Beyond your library")} </p>
          <h1 className="vault-title mt-2"> {ui(locale, "Discover")} </h1><p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base"> {ui(locale, "Browse external catalogs, compare sources, and preview your next anime, manga, movie, series or book.")} </p>
        </div>
        <Link href="/share/me" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 px-4 text-sm font-medium text-slate-300 hover:border-blue-400"> {ui(locale, "Search my library")} </Link>
      </header>
      {itemsResult.error ? <p role="status" className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100"> {ui(locale, "Your saved titles could not be checked. Review the add form carefully before saving.")} </p> : null}
      <CatalogDiscover ownedItems={ownedItems} lists={listsResult.schemaReady ? listsResult.lists : []} />
    </main>
  )
}
