import ChartsDashboard from '../../components/ChartsDashboard'
import Link from 'next/link'
import SetupNotice from '../../components/SetupNotice'
import VaultInsights from '../../components/VaultInsights'
import { getItems } from '../../lib/data/items'
import { getOwnershipMode } from '../../lib/data/ownership'
import { getRequestLocale } from '../../lib/i18n-server'
import { toMediaItem } from '../../lib/media'
import { t } from '../../lib/i18n'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function SummaryPage() {
  const locale = await getRequestLocale()
  const [itemsResult, ownershipMode] = await Promise.all([getItems(), getOwnershipMode()])
  const { data: items, error } = itemsResult

  if (error) {
    console.error('Error loading items:', error)
  }

  const mediaItems = (items ?? []).map(toMediaItem)

  return (
    <main className="vault-page">
      <header className="mb-8">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.25em] text-slate-500">{t(locale, 'common.overview')}</p>
          <h1 className="vault-title mt-3">
            {t(locale, 'nav.summary')}
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
            {t(locale, 'summary.description')}
          </p>
          <Link href="/stats" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-blue-200 hover:border-blue-400 hover:text-white">{t(locale, 'nav.stats')} →</Link>
        </div>
      </header>

      {ownershipMode === 'legacy' ? <SetupNotice /> : null}
      <VaultInsights items={mediaItems} locale={locale} />
      <ChartsDashboard items={mediaItems} />
    </main>
  )
}
