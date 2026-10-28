'use client'

import { Menu, MoreVertical, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { isPublicVaultRoute } from '../lib/public-routes'
import { dispatchOpenAddModal } from '../lib/add-modal-events'

import AddModal from './AddModal'
import HeaderCatalogSearch from './HeaderCatalogSearch'
import LogoutButton from './LogoutButton'
import { useLocale } from './LocaleProvider'

export default function AppHeader({
  accountLabel,
  userId,
}: {
  accountLabel: string
  userId: string | null
}) {
  const pathname = usePathname()
  const { t } = useLocale()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false)
  const [menuContext, setMenuContext] = useState({ pathname, userId })
  const utilityMenuRef = useRef<HTMLDivElement | null>(null)
  const utilityTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const mobileMenuId = useId()
  const utilityMenuId = useId()
  const isPublicRoute = isPublicVaultRoute(pathname)
  const isAuthRoute =
    pathname === '/login' || pathname === '/register' || pathname === '/welcome'
  const profileHref = '/discover'

  useEffect(() => {
    if (!isMobileMenuOpen && !isUtilityMenuOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (isMobileMenuOpen) mobileTriggerRef.current?.focus()
        else utilityTriggerRef.current?.focus()
        setIsMobileMenuOpen(false)
        setIsUtilityMenuOpen(false)
      }
    }

    function handlePointerDown(event: MouseEvent) {
      if (!utilityMenuRef.current?.contains(event.target as Node)) {
        setIsUtilityMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isMobileMenuOpen, isUtilityMenuOpen])

  useEffect(() => {
    if (!isMobileMenuOpen) return
    const trigger = mobileTriggerRef.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => mobileMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus())
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const controls = [...(mobileMenuRef.current?.querySelectorAll<HTMLElement>('*') ?? [])]
        .filter(element => element.matches('a[href],button:not(:disabled)') && element.tabIndex >= 0)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && (document.activeElement === first || !mobileMenuRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !mobileMenuRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first?.focus()
      }
    }
    const desktop = window.matchMedia?.('(min-width: 768px)')
    const closeOnDesktop = () => { if (desktop?.matches) setIsMobileMenuOpen(false) }
    desktop?.addEventListener('change', closeOnDesktop)
    document.addEventListener('keydown', trapFocus)
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', trapFocus)
      desktop?.removeEventListener('change', closeOnDesktop)
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [isMobileMenuOpen])

  // The shared layout survives history navigation and session changes.
  // Reset before committing the new route so hidden menus release their effects.
  if (menuContext.pathname !== pathname || menuContext.userId !== userId) {
    setMenuContext({ pathname, userId })
    setIsMobileMenuOpen(false)
    setIsUtilityMenuOpen(false)
  }

  if (isAuthRoute) {
    return null
  }

  if (isPublicRoute || !userId) {
    return (
      <header className="vault-container safe-top sticky top-0 z-40 pt-3">
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/95 px-3 py-3 shadow-lg shadow-slate-950/20 sm:px-5">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-white transition hover:text-blue-300 sm:gap-3 sm:text-2xl"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-sm font-semibold text-blue-200 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
              MV
            </span>
            <span>
              Vault
              <span className="text-blue-400">.</span>
            </span>
          </Link>

          <Link
            href={userId ? '/' : '/login'}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-blue-400/30 hover:bg-slate-900 hover:text-white"
          >
            {userId ? t('nav.backToVault') : t('nav.openVault')}
          </Link>
        </div>
      </header>
    )
  }

  return (
    <>
      <header className="vault-container safe-top sticky top-0 z-40 pt-3">
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/95 px-3 py-3 shadow-lg shadow-slate-950/20 sm:px-5 md:py-4">
          <div className="relative z-20 flex min-w-0 items-center gap-2 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-4">
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-white transition hover:text-blue-300 sm:gap-3 sm:text-2xl"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-sm font-semibold text-blue-200 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                MV
              </span>
              <span>
                Vault
                <span className="text-blue-400">.</span>
              </span>
            </Link>

            <div className="ml-auto min-w-0 md:ml-0">
              <HeaderCatalogSearch />
            </div>

            <div className="hidden items-center justify-end gap-2 md:flex">
              <span title={accountLabel} className="hidden max-w-36 truncate rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 lg:inline">
                {accountLabel}
              </span>
              <AddModal
                listenForExternalOpen
                triggerClassName="min-h-11 rounded-xl border border-blue-300/20 bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(59,130,246,0.28)] transition-all duration-300 hover:bg-blue-400"
                triggerContent={t('common.addNew')}
              />
              <div ref={utilityMenuRef} className="relative">
                <button
                  ref={utilityTriggerRef}
                  type="button"
                  onClick={() => setIsUtilityMenuOpen((current) => !current)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-100 transition hover:border-blue-400/30 hover:bg-slate-900 hover:text-white"
                  aria-label={t('nav.utilityMenu')}
                  aria-expanded={isUtilityMenuOpen}
                  aria-controls={utilityMenuId}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      setIsUtilityMenuOpen(true)
                      requestAnimationFrame(() => utilityMenuRef.current?.querySelector<HTMLAnchorElement>('a')?.focus())
                    }
                  }}
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                {isUtilityMenuOpen ? (
                  <div id={utilityMenuId} className="absolute right-0 top-full z-[150] mt-2 w-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl">
                    <Link
                      href="/import"
                      onClick={() => setIsUtilityMenuOpen(false)}
                      className="flex min-h-11 items-center rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                    >
                      {t('nav.import')}
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setIsUtilityMenuOpen(false)}
                      className="mt-1 flex min-h-11 items-center rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                    >
                      {t('nav.settings')}
                    </Link>
                    <Link
                      href="/backup"
                      onClick={() => setIsUtilityMenuOpen(false)}
                      className="mt-1 flex min-h-11 items-center rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                    >
                      {t('nav.backup')}
                    </Link>
                    <Link
                      href="/setup"
                      onClick={() => setIsUtilityMenuOpen(false)}
                      className="mt-1 flex min-h-11 items-center rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                    >
                      {t('nav.setup')}
                    </Link>
                    <div className="mt-1">
                      <LogoutButton className="w-full justify-start rounded-xl border-transparent bg-transparent px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5 hover:text-white" />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <button
              ref={mobileTriggerRef}
              type="button"
              onClick={() => { setIsUtilityMenuOpen(false); setIsMobileMenuOpen(true) }}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-white shadow-[0_12px_30px_rgba(2,6,23,0.35)] transition hover:border-blue-400/40 hover:bg-slate-900 md:hidden"
              aria-label={t('nav.openMenu')}
              aria-expanded={isMobileMenuOpen}
              aria-controls={mobileMenuId}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <nav aria-label={t('nav.navigation')} className="scrollbar-hide relative z-10 hidden items-center gap-2 overflow-x-auto pb-1 md:flex">
            <NavLink
              href="/"
              isActive={
                pathname === '/' ||
                pathname.startsWith('/items/') ||
                pathname.startsWith('/shelves/')
              }
            >
              {t('nav.library')}
            </NavLink>
            <NavLink href="/summary" isActive={pathname === '/summary'}>
              {t('nav.summary')}
            </NavLink>
            <NavLink href={profileHref} isActive={pathname === '/discover'}>
              {t('nav.discover')}
            </NavLink>
            <NavLink href="/lists" isActive={pathname === '/lists' || pathname.startsWith('/lists/')}>
              {t('nav.lists')}
            </NavLink>
            <NavLink href="/stats" isActive={pathname === '/stats'}>
              {t('nav.stats')}
            </NavLink>
          </nav>
        </div>
      </header>

      {isMobileMenuOpen ? (
        <div ref={mobileMenuRef} id={mobileMenuId} role="dialog" aria-modal="true" aria-label={t('nav.navigation')} className="fixed inset-0 z-[999] bg-slate-950/98 backdrop-blur-xl md:hidden">
          <div className="vault-mobile-menu flex h-[100dvh] min-h-0 flex-col px-5">
            <div className="flex shrink-0 items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {t('nav.navigation')}
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  {t('nav.openVault')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-white shadow-[0_12px_30px_rgba(2,6,23,0.35)] transition hover:border-blue-400/40 hover:bg-slate-900"
                aria-label={t('nav.closeMenu')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 pb-4">
              {userId ? (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t('nav.signedIn')}
                  </p>
                  <p className="mt-1 break-words text-sm text-slate-200">{accountLabel}</p>
                </div>
              ) : null}

              <div className="grid gap-3">
                <MobileMenuLink
                  href="/"
                  isActive={
                    pathname === '/' ||
                    pathname.startsWith('/items/') ||
                    pathname.startsWith('/shelves/')
                  }
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  {t('nav.library')}
                </MobileMenuLink>
                <MobileMenuLink
                  href="/summary"
                  isActive={pathname === '/summary'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  {t('nav.summary')}
                </MobileMenuLink>
                <MobileMenuLink
                  href={profileHref}
                  isActive={pathname === '/discover'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  {t('nav.discover')}
                </MobileMenuLink>
                <MobileMenuLink
                  href="/stats"
                  isActive={pathname === '/stats'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  {t('nav.stats')}
                </MobileMenuLink>
                <MobileMenuLink
                  href="/lists"
                  isActive={pathname === '/lists' || pathname.startsWith('/lists/')}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  {t('nav.lists')}
                </MobileMenuLink>
                <MobileMenuLink
                  href="/import"
                  isActive={pathname === '/import'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  {t('nav.import')}
                </MobileMenuLink>
                <MobileMenuLink
                  href="/settings"
                  isActive={pathname === '/settings'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  {t('nav.settings')}
                </MobileMenuLink>
                <MobileMenuLink
                  href="/backup"
                  isActive={pathname === '/backup'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  {t('nav.backup')}
                </MobileMenuLink>
                <MobileMenuLink
                  href="/setup"
                  isActive={pathname === '/setup'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  {t('nav.setup')}
                </MobileMenuLink>
              </div>
            </div>

            <div className="shrink-0 space-y-3 border-t border-white/10 bg-slate-950 pt-4">
              <button type="button" onClick={() => {
                setIsMobileMenuOpen(false)
                requestAnimationFrame(() => dispatchOpenAddModal())
              }} className="w-full min-h-12 rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(59,130,246,0.28)] transition hover:bg-blue-400">
                {t('common.addNew')}
              </button>

              <LogoutButton className="w-full min-h-12 rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-blue-400/30 hover:bg-white/10 hover:text-white" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function MobileMenuLink({
  children,
  href,
  isActive,
  onNavigate,
}: {
  children: React.ReactNode
  href: string
  isActive: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl border px-4 py-3 text-base font-medium transition ${
        isActive
          ? 'border-blue-400/30 bg-blue-500/20 text-white shadow-[0_0_20px_rgba(59,130,246,0.22)]'
          : 'border-white/8 bg-white/5 text-slate-300 hover:border-blue-400/20 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </Link>
  )
}

function NavLink({
  children,
  href,
  isActive,
}: {
  children: React.ReactNode
  href: string
  isActive: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-medium transition ${
        isActive
          ? 'border-blue-400/30 bg-blue-500/20 text-white shadow-[0_0_20px_rgba(59,130,246,0.22)]'
          : 'border-white/8 bg-white/5 text-slate-300 hover:border-blue-400/20 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </Link>
  )
}
