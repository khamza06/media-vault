import HomeShelvesView from '../components/HomeShelvesView'
import SetupNotice from '../components/SetupNotice'
import { getOrCreateProfile } from './actions/profile'
import { getItems } from '../lib/data/items'
import { getCustomLists } from '../lib/data/lists'
import { getOwnershipMode } from '../lib/data/ownership'
import { getDiscoverRecommendations } from '../lib/home-signals'
import { toMediaItem } from '../lib/media'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [itemsResult, ownershipMode, listsResult, profileResult] = await Promise.all([
    getItems(),
    getOwnershipMode(),
    getCustomLists(),
    getOrCreateProfile(),
  ])
  const { data: items, error } = itemsResult

  if (error) {
    console.error('Error loading focus shelves:', error)
  }

  const mediaItems = (items ?? []).map(toMediaItem)
  const recommendations = await getDiscoverRecommendations(mediaItems)

  const listOptions = listsResult.schemaReady ? listsResult.lists : []
  const onboardingState = {
    importedItemCount: mediaItems.filter((item) => Boolean(item.externalSource?.trim())).length,
    isProfilePublic: Boolean(profileResult.profile?.isPublic),
    itemCount: mediaItems.length,
    listCount: listsResult.schemaReady ? listsResult.lists.length : null,
    listsReady: listsResult.schemaReady,
    profileReady: Boolean(profileResult.profile),
    username: profileResult.profile?.username ?? null,
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-5 pb-24 sm:px-6 md:py-6 md:pb-6 lg:px-8">
      <header className="mb-6 mt-2 flex max-w-3xl flex-col gap-4 md:mb-8 md:mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75">
          Focus Shelves
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-5xl">
          Your Library, reorganized.
        </h1>
        <p className="text-sm leading-6 text-slate-300 sm:text-lg sm:leading-7">
          Jump between media families, keep active titles close, and browse your completed universe
          without scrolling through one endless grid.
        </p>
      </header>

      {ownershipMode === 'legacy' ? <SetupNotice /> : null}

      <HomeShelvesView
        items={mediaItems}
        listOptions={listOptions}
        onboardingState={onboardingState}
        recommendations={recommendations}
      />
    </main>
  )
}
