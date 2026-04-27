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
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-5 pb-24 sm:px-6 md:py-6 md:pb-6 lg:px-8">
      <header className="mb-10 mt-6">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.25em] text-slate-500">{copy.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
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
