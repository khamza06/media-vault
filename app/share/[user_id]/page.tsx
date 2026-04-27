import type { Metadata } from 'next'
import Link from 'next/link'
import { Compass } from 'lucide-react'

import DiscoveryHubView from '../../../components/DiscoveryHubView'
import { getCurrentUser } from '../../../lib/auth/dal'
import {
  getDiscoveryHubGenresByUserId,
  getDiscoveryHubItemsByUserId,
  type DiscoveryHubFilters,
} from '../../../lib/data/items'
import { toMediaItem, type MediaItem, type MediaItemRecord } from '../../../lib/media'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Advanced Library Search | Media Vault',
  description: "Explore, filter, and sort through this user's entire media collection.",
}

type PageProps = {
  params: Promise<{
    user_id: string
  }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function ShareDiscoveryPage(props: PageProps) {
  const { user_id: userId } = await props.params
  const resolvedSearchParams = await props.searchParams
  const currentUser = await getCurrentUser()
  const isMeAlias = userId === 'me'
  const resolvedUserId = isMeAlias ? currentUser?.id ?? null : userId
  const isOwnerView = Boolean(currentUser?.id && resolvedUserId && currentUser.id === resolvedUserId)
  const isValidShareId = Boolean(resolvedUserId && uuidPattern.test(resolvedUserId))

  let items: MediaItem[] = []
  let totalCount = 0
  let availableGenres: string[] = []
  let errorMessage: string | null = null

  if (isMeAlias && !currentUser) {
    errorMessage = 'Sign in first to open your private library hub.'
  } else if (!isValidShareId) {
    errorMessage = 'Invalid share link. Please ask the owner for a correct one.'
  } else {
    const filters = getDiscoveryFiltersFromSearchParams(resolvedSearchParams)
    const [itemsResult, genres] = await Promise.all([
      getDiscoveryHubItemsByUserId(resolvedUserId!, filters, currentUser),
      getDiscoveryHubGenresByUserId(resolvedUserId!, currentUser),
    ])

    if (itemsResult.error) {
      errorMessage = isOwnerView
        ? itemsResult.error.message ?? 'Could not load your library hub.'
        : 'This share link is not active yet. Ask the owner to enable shared discovery.'
    } else {
      items = ((itemsResult.data ?? []) as MediaItemRecord[]).map(toMediaItem)
      totalCount = itemsResult.totalCount
      availableGenres = genres
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 pb-32 sm:px-6 lg:px-8">
      <header className="mb-8 mt-6 max-w-4xl min-w-0">
        <div className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">
          <Compass className="h-4 w-4" />
          Discover
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Advanced Library Search
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
          Explore, filter, and sort through this user&apos;s entire media collection.
        </p>
      </header>

      {errorMessage ? (
        <section className="glass-panel-soft min-w-0 rounded-xl border border-amber-500/20 px-6 py-8 text-center text-slate-200">
          <p className="text-base font-semibold text-white">{errorMessage}</p>
          {isMeAlias && !currentUser ? (
            <div className="mt-5 flex justify-center">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-xl border border-blue-400/30 bg-blue-500/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500/30"
              >
                Open login
              </Link>
            </div>
          ) : null}
        </section>
      ) : (
        <DiscoveryHubView
          items={items}
          totalCount={totalCount}
          availableGenres={availableGenres}
        />
      )}
    </main>
  )
}

function getStringParam(
  value: string | string[] | undefined,
  fallback = ''
) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback
  }

  return value ?? fallback
}

function getCsvParam(value: string | string[] | undefined) {
  return getStringParam(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function getNumberParam(value: string | string[] | undefined, fallback: number | null) {
  if (value === undefined) {
    return fallback
  }

  const parsed = Number(getStringParam(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

function getDiscoveryFiltersFromSearchParams(
  searchParams: { [key: string]: string | string[] | undefined }
): DiscoveryHubFilters {
  const sortByParam = getStringParam(searchParams.sortBy || searchParams.sort, 'recent')
  const dateAddedParam = getStringParam(searchParams.dateAdded || searchParams.date, 'all')
  const presetParam = getStringParam(searchParams.preset, 'all')

  return {
    dateAdded:
      dateAddedParam === '7d' || dateAddedParam === '30d' || dateAddedParam === 'year'
        ? dateAddedParam
        : 'all',
    genres: getCsvParam(searchParams.genres),
    preset:
      presetParam === 'masters' || presetParam === 'consuming' || presetParam === 'recent'
        ? presetParam
        : 'all',
    query: getStringParam(searchParams.q),
    ratingMax: getNumberParam(searchParams.ratingMax, null),
    ratingMin: getNumberParam(searchParams.ratingMin, null),
    sortBy:
      sortByParam === 'title' || sortByParam === 'rating' || sortByParam === 'year'
        ? sortByParam
        : 'recent',
    status: getStringParam(searchParams.status) || null,
    types: getCsvParam(searchParams.types),
  }
}
