import ChartsDashboard from '../../components/ChartsDashboard'
import SetupNotice from '../../components/SetupNotice'
import VaultInsights from '../../components/VaultInsights'
import { getItems } from '../../lib/data/items'
import { getOwnershipMode } from '../../lib/data/ownership'
import { getRequestLocale } from '../../lib/i18n-server'
import { toMediaItem } from '../../lib/media'

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
  const copy = getCopy()

  return (
    <main className="vault-page">
      <header className="mb-8">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.25em] text-slate-500">{copy.eyebrow}</p>
          <h1 className="vault-title mt-3">
            {copy.title}
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
            {copy.description}
          </p>
        </div>
      </header>

      {ownershipMode === 'legacy' ? <SetupNotice /> : null}
      <VaultInsights items={mediaItems} locale={locale} />
      <ChartsDashboard items={mediaItems} />
    </main>
  )
}

function getCopy() {
  return {
    eyebrow: 'Summary',
    title: 'Summary',
    description:
      'A dedicated BI section with your key metrics, collection mix, and total tracked progress.',
  }
}
