'use client'

import { ui } from '../../lib/ui-i18n'
import { useLocale } from '../LocaleProvider'

import Link from 'next/link'
import {
  Archive,
  Check,
  Compass,
  Download,
  Eye,
  Import,
  ListPlus,
  Plus,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { dispatchOpenAddModal } from '../../lib/add-modal-events'

export type SetupChecklistState = {
  importedItemCount: number
  isProfilePublic: boolean
  itemCount: number
  listCount: number | null
  listsReady: boolean
  profileReady: boolean
  username: string | null
}

type SetupChecklistProps = {
  className?: string
  showDismiss?: boolean
  state: SetupChecklistState
  storageKey?: string
  variant?: 'empty' | 'compact'
}

type ChecklistItem = {
  actionHref?: string
  actionLabel: string
  description: string
  isComplete: boolean
  isOptional?: boolean
  isTrackable: boolean
  label: string
}

const defaultStorageKey = 'media-vault-onboarding-dismissed'

export default function SetupChecklist({
  className = '',
  showDismiss = true,
  state,
  storageKey = defaultStorageKey,
  variant = 'empty',
}: SetupChecklistProps) {
  const { locale } = useLocale()

  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    setIsDismissed(window.localStorage.getItem(storageKey) === 'true')
  }, [storageKey])

  const checklistItems = useMemo(() => buildChecklistItems(state, locale), [state, locale])
  const trackableItems = checklistItems.filter((item) => item.isTrackable && !item.isOptional)
  const completedCount = trackableItems.filter((item) => item.isComplete).length
  const totalCount = trackableItems.length
  const compact = variant === 'compact'

  function handleDismiss() {
    window.localStorage.setItem(storageKey, 'true')
    setIsDismissed(true)
  }

  if (isDismissed) {
    return null
  }

  return (
    <section
      className={`min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-xl shadow-slate-950/20 sm:p-6 ${className}`}
    >
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
            <Compass className="h-4 w-4" /> {ui(locale, "First-time setup")} </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {compact ? ui(locale, "Setup checklist") : ui(locale, "Welcome to Media Vault")}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            {compact
              ? ui(locale, "A quick path through the most useful vault setup steps.")
              : ui(locale, "Start by adding a title, importing an existing list, or setting up your public profile.")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100">
            {completedCount} / {totalCount} {ui(locale, "complete")} </span>
          {showDismiss ? (
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-blue-400/40 hover:text-white"
            >
              <X className="h-4 w-4" /> {ui(locale, "Hide")} </button>
          ) : null}
        </div>
      </div>

      {!compact ? (
        <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <button
            type="button"
            onClick={() => dispatchOpenAddModal()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-400"
          >
            <Plus className="h-4 w-4" /> {ui(locale, "Add your first title")} </button>
          <OnboardingLink href="/import" icon={<Import className="h-4 w-4" />}> {ui(locale, "Import a library")} </OnboardingLink>
          <OnboardingLink href="/discover" icon={<Compass className="h-4 w-4" />}> {ui(locale, "Explore Discover")} </OnboardingLink>
          <OnboardingLink href="/lists" icon={<ListPlus className="h-4 w-4" />}> {ui(locale, "Create a custom list")} </OnboardingLink>
          <OnboardingLink href="/settings" icon={<UserRound className="h-4 w-4" />}> {ui(locale, "Set up public profile")} </OnboardingLink>
        </div>
      ) : null}

      <div className="mt-5 grid min-w-0 gap-3 lg:grid-cols-2">
        {checklistItems.map((item) => (
          <ChecklistRow key={item.label} item={item} />
        ))}
      </div>
    </section>
  )
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const { locale } = useLocale()

  const statusLabel = getStatusLabel(item, locale)

  return (
    <article className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
          item.isComplete
            ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
            : 'border-slate-700 bg-slate-900 text-slate-400'
        }`}
      >
        {item.isComplete ? <Check className="h-4 w-4" /> : getItemIcon(item.label)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100">{item.label}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
          </div>
          <span
            className={`w-fit shrink-0 rounded-xl border px-2.5 py-1 text-xs font-semibold ${
              item.isComplete
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                : item.isOptional || !item.isTrackable
                  ? 'border-slate-700 bg-slate-900 text-slate-300'
                  : 'border-blue-400/25 bg-blue-500/10 text-blue-100'
            }`}
          >
            {statusLabel}
          </span>
        </div>
        {item.actionHref ? (
          <Link
            href={item.actionHref}
            className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
          >
            {item.actionLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => dispatchOpenAddModal()}
            className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40"
          >
            {item.actionLabel}
          </button>
        )}
      </div>
    </article>
  )
}

function OnboardingLink({
  children,
  href,
  icon,
}: {
  children: React.ReactNode
  href: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-blue-400/40 hover:bg-slate-800"
    >
      {icon}
      {children}
    </Link>
  )
}

function buildChecklistItems(state: SetupChecklistState, locale: import('../../lib/i18n').Locale = 'en'): ChecklistItem[] {
  const hasItems = state.itemCount > 0
  const hasImportedItems = state.importedItemCount > 0
  const listsAvailable = state.listsReady && state.listCount !== null
  const hasUsername = state.profileReady && Boolean(state.username)

  return [
    {
      actionLabel: ui(locale, "Add title"),
      description: hasItems
        ? ui(locale, "{value0} title{value1} in your vault.", { value0: state.itemCount, value1: state.itemCount === 1 ? '' : 's' })
        : ui(locale, "Add one title manually to make your vault feel alive."),
      isComplete: hasItems,
      isTrackable: true,
      label: ui(locale, "Add your first item"),
    },
    {
      actionHref: '/import',
      actionLabel: ui(locale, "Open Import"),
      description: hasImportedItems
        ? ui(locale, "{value0} imported title{value1} detected.", { value0: state.importedItemCount, value1: state.importedItemCount === 1 ? '' : 's' })
        : hasItems
          ? ui(locale, "Optional if you prefer adding titles manually.")
          : ui(locale, "Bring in MyAnimeList, AniList, or CSV data when you have an existing library."),
      isComplete: hasImportedItems,
      isOptional: !hasImportedItems && hasItems,
      isTrackable: true,
      label: ui(locale, "Import your existing library"),
    },
    {
      actionHref: '/lists',
      actionLabel: ui(locale, "Open Lists"),
      description: listsAvailable
        ? state.listCount && state.listCount > 0
          ? ui(locale, "{value0} custom list{value1} created.", { value0: state.listCount ?? 0, value1: state.listCount === 1 ? '' : 's' })
          : ui(locale, "Create a list for favorites, watch queues, or themed shelves.")
        : ui(locale, "Custom lists need the lists setup migration before this can be tracked."),
      isComplete: listsAvailable && Boolean(state.listCount && state.listCount > 0),
      isTrackable: listsAvailable,
      label: ui(locale, "Create a custom list"),
    },
    {
      actionHref: '/settings',
      actionLabel: ui(locale, "Open Settings"),
      description: hasUsername
        ? ui(locale, "Your public username is @{value0}.", { value0: state.username ?? '' })
        : state.profileReady
          ? ui(locale, "Choose a username before sharing your public vault.")
          : ui(locale, "Profile settings need the public profile migration before this can be tracked."),
      isComplete: hasUsername,
      isTrackable: state.profileReady,
      label: ui(locale, "Set your username"),
    },
    {
      actionHref: '/settings',
      actionLabel: ui(locale, "Public settings"),
      description:
        state.profileReady && state.isProfilePublic
          ? ui(locale, "Your read-only public vault can be shared.")
          : ui(locale, "Turn this on only when you are ready for visitors to browse your public vault."),
      isComplete: state.profileReady && state.isProfilePublic,
      isTrackable: state.profileReady,
      label: ui(locale, "Enable public profile"),
    },
    {
      actionHref: '/backup',
      actionLabel: ui(locale, "Open Backup"),
      description: ui(locale, "Download a JSON backup before major imports or cleanup sessions."),
      isComplete: false,
      isOptional: true,
      isTrackable: false,
      label: ui(locale, "Create a backup"),
    },
  ]
}

function getStatusLabel(item: ChecklistItem, locale: import('../../lib/i18n').Locale = 'en') {
  if (item.isComplete) {
    return 'Done'
  }

  if (!item.isTrackable) {
    return item.isOptional ? 'Optional' : ui(locale, "Setup needed")
  }

  return item.isOptional ? 'Optional' : 'Next'
}

function getItemIcon(label: string) {
  if (label.includes('Import')) {
    return <Download className="h-4 w-4" />
  }

  if (label.includes('list') || label.includes('спис')) {
    return <ListPlus className="h-4 w-4" />
  }

  if (label.includes('username')) {
    return <UserRound className="h-4 w-4" />
  }

  if (label.includes('public')) {
    return <Eye className="h-4 w-4" />
  }

  if (label.includes('backup')) {
    return <Archive className="h-4 w-4" />
  }

  return <Plus className="h-4 w-4" />
}
