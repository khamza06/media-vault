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
    <main className="vault-page">
      <header className="mb-6 flex max-w-3xl min-w-0 flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75">
          Your collection
        </p>
        <h1 className="vault-title">
          Library
        </h1>
        <p className="text-sm leading-6 text-slate-300 sm:text-lg sm:leading-7">
          Track your titles, pick up where you left off, and find your next favorite.
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
