import Link from 'next/link'
import type { Metadata } from 'next'

import { getOrCreateProfile } from '../actions/profile'
import CustomListsManager from '../../components/lists/CustomListsManager'
import { getCustomLists } from '../../lib/data/lists'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Lists | Media Vault',
  description: 'Create custom collections from your Media Vault.',
}

export default async function ListsPage() {
  const [result, profileResult] = await Promise.all([getCustomLists(), getOrCreateProfile()])
  const profile = profileResult.profile
    ? {
        isPublic: profileResult.profile.isPublic,
        username: profileResult.profile.username,
      }
    : null

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 pb-32 sm:px-6 lg:px-8">
      <header className="mb-8 mt-4 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75">
          Lists
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Custom Lists
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
          Create custom collections from your Media Vault. Add existing titles, remove them from
          lists safely, and choose which lists are public.
        </p>
      </header>

      {!result.schemaReady ? <ListsSetupCard /> : null}

      {result.error ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h2 className="text-xl font-bold text-slate-100">Lists are private</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{result.error}</p>
          <Link
            href="/login"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400"
          >
            Sign in
          </Link>
        </section>
      ) : result.schemaReady ? (
        <CustomListsManager
          lists={result.lists}
          profile={profile}
          sharingReady={result.sharingReady}
        />
      ) : null}
    </main>
  )
}

function ListsSetupCard() {
  return (
    <section className="mb-8 rounded-xl border border-amber-400/30 bg-amber-500/10 p-5 text-amber-100">
      <h2 className="text-lg font-bold">One SQL setup step is needed</h2>
      <p className="mt-2 text-sm leading-6 text-amber-50/85">
        Custom list tables are not available in Supabase yet. Run this file once in Supabase SQL
        Editor, then refresh this page:
      </p>
      <p className="mt-3 rounded-xl border border-amber-400/20 bg-slate-950 px-4 py-3 text-sm text-amber-100">
        supabase/migrations/20260426_custom_lists.sql
      </p>
    </section>
  )
}
