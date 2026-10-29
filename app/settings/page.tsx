
import { ui } from '../../lib/ui-i18n'
import { getRequestLocale } from '../../lib/i18n-server'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  Database,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'

import { getOrCreateProfile } from '../actions/profile'
import MetadataRefreshButton from '../../components/MetadataRefreshButton'
import LanguageToggle from '../../components/LanguageToggle'
import ProfileSettingsPanel from '../../components/ProfileSettingsPanel'
import SetupChecklist from '../../components/onboarding/SetupChecklist'
import { getCurrentUser } from '../../lib/auth/dal'
import { getItems } from '../../lib/data/items'
import { getCustomLists } from '../../lib/data/lists'
import { toMediaItem } from '../../lib/media'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return {
  title: ui(locale, "Settings | Media Vault"),
  description: ui(locale, "Manage account, profile, public vault, and Media Vault preferences."),
}
}

export default async function SettingsPage() {
  const locale = await getRequestLocale()

  const user = await getCurrentUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 pb-32 text-slate-100 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-200">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white"> {ui(locale, "Sign in required")} </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400"> {ui(locale, "Settings are private to your account. Sign in to manage your vault preferences and public sharing options.")} </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-xl border border-blue-400/30 bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
            > {ui(locale, "Open login")} </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/30 hover:bg-slate-900"
            > {ui(locale, "Back to vault")} </Link>
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
    <main className="vault-page">
      <div className="min-w-0">
        <header className="mb-8 max-w-3xl min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-200"> {ui(locale, "Account Controls")} </p>
          <h1 className="vault-title mt-3"> {ui(locale, "Settings")} </h1>
          <p className="mt-4 text-base leading-7 text-slate-400"> {ui(locale, "Manage your profile, public sharing, and backup and import tools.")} </p>
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
            kicker={ui(locale, "Account")}
            title={ui(locale, "Signed-in account")}
          >
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"> {ui(locale, "Email")} </dt>
                <dd className="mt-1 break-all text-sm font-medium text-slate-100">
                  {user.email ?? 'No email available'}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400"> {ui(locale, "Manage your public name and sharing preferences below. Your account email is private.")} </div>
            </dl>
          </SettingsCard>

          <ProfileSettingsPanel
            initialError={profileResult.error}
            initialProfile={profileResult.profile}
          />

          <SettingsCard
            icon={<SlidersHorizontal className="h-5 w-5" />}
            kicker={ui(locale, "Preferences")}
            title={ui(locale, "Language and display")}
          >
            <div className="grid gap-4">
              <LanguageToggle />
              <p className="text-sm leading-6 text-slate-400"> {ui(locale, "Language, Library layout and saved views are remembered in this browser. Change the layout or save your current filters from Library.")} </p>
              <ToolLink href="/"> {ui(locale, "Open Library preferences")} </ToolLink>
            </div>
          </SettingsCard>
        </section>

        <section className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
          <SettingsCard
            icon={<Database className="h-5 w-5" />}
            kicker={ui(locale, "Tools")}
            title={ui(locale, "Backup and import")}
          >
            <div className="flex flex-wrap gap-3">
              <ToolLink href="/backup"> {ui(locale, "Open Backup")} </ToolLink>
              <ToolLink href="/import"> {ui(locale, "Open Import Center")} </ToolLink>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400"> {ui(locale, "Download a JSON backup before a large import or cleanup. You can preview and selectively restore its contents from Backup.")} </p>
            <div className="mt-4">
              <MetadataRefreshButton />
            </div>
          </SettingsCard>

          <SettingsCard
            icon={<AlertTriangle className="h-5 w-5" />}
            kicker={ui(locale, "Collection tools")}
            title={ui(locale, "Manage your collection")}
          >
            <p className="text-sm leading-6 text-slate-400"> {ui(locale, "Review MyAnimeList imports in Import Center. To delete individual titles or a selection, use Library. Deletions require confirmation.")} </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ToolLink href="/import"> {ui(locale, "Manage import cleanup")} </ToolLink>
              <ToolLink href="/"> {ui(locale, "Return to Library")} </ToolLink>
            </div>
          </SettingsCard>
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
