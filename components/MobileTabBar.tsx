'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { BarChart3, House, Settings as SettingsIcon, Sparkles } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { dispatchOpenAddModal } from '../lib/add-modal-events'
import { useLocale } from './LocaleProvider'

export default function MobileTabBar({
  userId,
}: {
  userId: string | null
}) {
  const pathname = usePathname()
  const { t } = useLocale()
  const isPublicRoute = pathname.startsWith('/public/') || pathname.startsWith('/u/')
  const isAuthRoute =
    pathname === '/login' || pathname === '/register' || pathname === '/welcome'

  if (isAuthRoute || !userId || isPublicRoute) {
    return null
  }

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-4 z-[100] px-4 pb-2 md:hidden">
      <div className="mx-auto flex w-[min(22rem,calc(100vw-2rem))] items-center justify-between rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 shadow-[0_22px_60px_rgba(2,6,23,0.58)] backdrop-blur-xl">
        <TabLink href="/" icon={<House className="h-5 w-5" />} isActive={pathname === '/'} label={t('nav.library')} />
        <TabLink href="/summary" icon={<BarChart3 className="h-5 w-5" />} isActive={pathname === '/summary'} label={t('nav.summary')} />

        <button
          type="button"
          onClick={() => dispatchOpenAddModal()}
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-blue-500 px-4 py-3 text-white shadow-[0_18px_44px_rgba(59,130,246,0.42)]"
          aria-label="Add new item"
        >
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </button>

        <TabLink
          href="/stats"
          icon={<BarChart3 className="h-5 w-5" />}
          isActive={pathname === '/stats'}
          label={t('nav.stats')}
        />
        <TabLink
          href="/settings"
          icon={<SettingsIcon className="h-5 w-5" />}
          isActive={pathname === '/settings'}
          label="Settings"
        />
      </div>
    </nav>
  )
}

function TabLink({
  href,
  icon,
  isActive,
  label,
}: {
  href: string
  icon: ReactNode
  isActive: boolean
  label: string
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium transition ${
        isActive
          ? 'border border-blue-400/30 bg-blue-500/18 text-white shadow-[0_0_28px_rgba(59,130,246,0.32)]'
          : 'text-slate-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}
