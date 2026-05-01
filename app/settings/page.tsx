import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  Database,
  Import,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'

import { getOrCreateProfile } from '../actions/profile'
import MetadataRefreshButton from '../../components/MetadataRefreshButton'
import ProfileSettingsPanel from '../../components/ProfileSettingsPanel'
import SetupChecklist from '../../components/onboarding/SetupChecklist'
import { getCurrentUser } from '../../lib/auth/dal'
import { getItems } from '../../lib/data/items'
import { getCustomLists } from '../../lib/data/lists'
import { toMediaItem } from '../../lib/media'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Settings | Media Vault',
  description: 'Manage account, profile, public vault, and Media Vault preferences.',
}

export default async function SettingsPage() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 pb-32 text-slate-100 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-200">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
            Sign in required
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Settings are private to your account. Sign in to manage your vault preferences and
            public sharing options.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-xl border border-blue-400/30 bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
            >
              Open login
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/30 hover:bg-slate-900"
            >
              Back to vault
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const [profileResult, itemsResult, listsResult] = await Promise.all([
    getOrCreateProfile(),
    getItems(),
    getCustomLists(),
  ])
  const mediaItems = (itemsResult.data ?? []).map(toMediaItem)
  const shouldShowSetupChecklist =
    mediaItems.length < 3 ||
    !profileResult.profile?.username ||
    !profileResult.profile?.isPublic
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
    <main className="min-h-screen bg-slate-950 px-4 py-8 pb-32 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl min-w-0">
        <header className="mb-8 max-w-3xl min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">
            Account Controls
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Settings
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-400">
            Manage the safe foundation for your profile, sharing links, and vault tools.
            Configure your public identity, vault visibility, and safe backup/import tools.
          </p>
        </header>

        {shouldShowSetupChecklist ? (
          <SetupChecklist
            className="mb-4"
            state={onboardingState}
            storageKey="media-vault-settings-onboarding-dismissed"
            variant="compact"
          />
        ) : null}

        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
          <SettingsCard
            icon={<ShieldCheck className="h-5 w-5" />}
            kicker="Account"
            title="Signed-in account"
          >
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Email
                </dt>
                <dd className="mt-1 break-all text-sm font-medium text-slate-100">
                  {user.email ?? 'No email available'}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                Your raw user id is not shown here. Public sharing now uses a username-based
                profile URL instead of exposing your owner id.
              </div>
            </dl>
          </SettingsCard>

          <ProfileSettingsPanel
            initialError={profileResult.error}
            initialProfile={profileResult.profile}
          />

          <SettingsCard
            icon={<SlidersHorizontal className="h-5 w-5" />}
            kicker="Preferences"
            title="Vault defaults"
          >
            <div className="grid gap-4">
              <DisabledField label="Default landing page" value="Settings schema required" />
              <DisabledField label="Default sort/filter" value="Settings schema required" />
              <p className="text-sm leading-6 text-slate-400">
                Preferences are intentionally read-only until there is a dedicated preferences
                schema. Profile visibility now lives in the durable profiles table.
              </p>
            </div>
          </SettingsCard>
        </section>

        <section className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
          <SettingsCard
            icon={<Database className="h-5 w-5" />}
            kicker="Tools"
            title="Backup and import"
          >
            <div className="flex flex-wrap gap-3">
              <ToolLink href="/backup">Open Backup</ToolLink>
              <ToolLink href="/import">Open Import Center</ToolLink>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Use Backup before large imports, cleanup runs, or schema changes. Tiny seatbelt,
              big relief.
            </p>
            <div className="mt-4">
              <MetadataRefreshButton />
            </div>
          </SettingsCard>

          <SettingsCard
            icon={<AlertTriangle className="h-5 w-5" />}
            kicker="Danger Zone"
            title="Destructive actions"
          >
            <p className="text-sm leading-6 text-slate-400">
              No destructive controls live on Settings yet. MyAnimeList cleanup remains in Import
              Center, and normal item deletion stays inside Library selection mode.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ToolLink href="/import">Manage import cleanup</ToolLink>
              <ToolLink href="/">Return to Library</ToolLink>
            </div>
          </SettingsCard>
        </section>

        <section className="mt-4 min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <Import className="mt-1 h-5 w-5 shrink-0 text-blue-200" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white">Public profile status</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Public profile sharing is username-based at `/u/[username]`. Visitors only see
                read-only vault items when your profile is public.
              </p>
              <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-300">
                Developer note: run the public profiles migration before using these controls in
                Supabase production.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function SettingsCard({
  children,
  icon,
  kicker,
  title,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  kicker: string
  title: string
}) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-200">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {kicker}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  )
}

function DisabledField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      <input
        disabled
        value={value}
        className="mt-2 min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-500"
        readOnly
      />
    </label>
  )
}

function ToolLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/30 hover:bg-slate-900"
    >
      {children}
    </Link>
  )
}
