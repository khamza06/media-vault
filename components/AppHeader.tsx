'use client'

import { Menu, MoreVertical, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import AddModal from './AddModal'
import HeaderCatalogSearch from './HeaderCatalogSearch'
import LogoutButton from './LogoutButton'

export default function AppHeader({
  userEmail,
  userId,
}: {
  userEmail: string | null
  userId: string | null
}) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false)
  const utilityMenuRef = useRef<HTMLDivElement | null>(null)
  const isPublicRoute = pathname.startsWith('/public/') || pathname.startsWith('/u/')
  const isAuthRoute =
    pathname === '/login' || pathname === '/register' || pathname === '/welcome'
  const profileHref = userId ? '/share/me' : '/summary'

  useEffect(() => {
    if (!isMobileMenuOpen && !isUtilityMenuOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
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

  if (isAuthRoute) {
    return null
  }

  if (isPublicRoute) {
    return (
      <header className="safe-top sticky top-0 z-40 px-4 pt-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 shadow-[0_20px_60px_rgba(2,6,23,0.5)] sm:px-5">
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
            {userId ? 'Back to vault' : 'Open your vault'}
          </Link>
        </div>
      </header>
    )
  }

  return (
    <>
      <header className="safe-top sticky top-0 z-40 px-4 pt-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 shadow-[0_20px_60px_rgba(2,6,23,0.5)] sm:px-5 md:gap-4 md:px-5 md:py-4">
          <div className="relative z-20 flex items-center gap-2 md:flex-wrap md:gap-4">
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

            <div className="ml-auto md:ml-0 md:flex-1">
              <HeaderCatalogSearch />
            </div>

            <div className="ml-auto hidden flex-wrap items-center justify-end gap-3 md:flex">
              {userEmail ? (
                <span className="hidden rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 lg:inline">
                  {userEmail}
                </span>
              ) : null}
              <AddModal
                listenForExternalOpen
                triggerClassName="min-h-11 rounded-xl border border-blue-300/20 bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(59,130,246,0.28)] transition-all duration-300 hover:bg-blue-400"
                triggerContent="+ Add New"
              />
              <div ref={utilityMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsUtilityMenuOpen((current) => !current)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-100 transition hover:border-blue-400/30 hover:bg-slate-900 hover:text-white"
                  aria-label="Open utility menu"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                {isUtilityMenuOpen ? (
                  <div className="absolute right-0 top-full z-[150] mt-2 w-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl">
                    <Link
                      href="/import"
                      onClick={() => setIsUtilityMenuOpen(false)}
                      className="flex min-h-11 items-center rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                    >
                      Import
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setIsUtilityMenuOpen(false)}
                      className="mt-1 flex min-h-11 items-center rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                    >
                      Settings
                    </Link>
                    <Link
                      href="/backup"
                      onClick={() => setIsUtilityMenuOpen(false)}
                      className="mt-1 flex min-h-11 items-center rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                    >
                      Backup
                    </Link>
                    <Link
                      href="/setup"
                      onClick={() => setIsUtilityMenuOpen(false)}
                      className="mt-1 flex min-h-11 items-center rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
                    >
                      Setup
                    </Link>
                    <div className="mt-1">
                      <LogoutButton className="w-full justify-start rounded-xl border-transparent bg-transparent px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/5 hover:text-white" />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-white shadow-[0_12px_30px_rgba(2,6,23,0.35)] transition hover:border-blue-400/40 hover:bg-slate-900 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <nav className="scrollbar-hide relative z-10 hidden items-center gap-2 overflow-x-auto pb-1 md:flex">
            <NavLink
              href="/"
              isActive={
                pathname === '/' ||
                pathname.startsWith('/items/') ||
                pathname.startsWith('/shelves/')
              }
            >
              Library
            </NavLink>
            <NavLink href="/summary" isActive={pathname === '/summary'}>
              Summary
            </NavLink>
            <NavLink href={profileHref} isActive={pathname.startsWith('/share/')}>
              Discover
            </NavLink>
            <NavLink href="/lists" isActive={pathname === '/lists'}>
              Lists
            </NavLink>
            <NavLink href="/stats" isActive={pathname === '/stats'}>
              Stats
            </NavLink>
          </nav>
        </div>
      </header>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-[999] bg-slate-950/98 backdrop-blur-xl md:hidden">
          <div className="safe-top safe-bottom flex h-[100dvh] min-h-0 flex-col px-5 pb-4 pt-5">
            <div className="flex shrink-0 items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Navigation
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  Open your vault
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-white shadow-[0_12px_30px_rgba(2,6,23,0.35)] transition hover:border-blue-400/40 hover:bg-slate-900"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 pb-4">
              {userEmail ? (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Signed in
                  </p>
                  <p className="mt-1 break-all text-sm text-slate-200">{userEmail}</p>
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
                  Library
                </MobileMenuLink>
                <MobileMenuLink
                  href="/summary"
                  isActive={pathname === '/summary'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  Summary
                </MobileMenuLink>
                <MobileMenuLink
                  href={profileHref}
                  isActive={pathname.startsWith('/share/')}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  Discover
                </MobileMenuLink>
                <MobileMenuLink
                  href="/stats"
                  isActive={pathname === '/stats'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  Stats
                </MobileMenuLink>
                <MobileMenuLink
                  href="/lists"
                  isActive={pathname === '/lists'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  Lists
                </MobileMenuLink>
                <MobileMenuLink
                  href="/import"
                  isActive={pathname === '/import'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  Import
                </MobileMenuLink>
                <MobileMenuLink
                  href="/settings"
                  isActive={pathname === '/settings'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  Settings
                </MobileMenuLink>
                <MobileMenuLink
                  href="/backup"
                  isActive={pathname === '/backup'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  Backup
                </MobileMenuLink>
                <MobileMenuLink
                  href="/setup"
                  isActive={pathname === '/setup'}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                >
                  Setup
                </MobileMenuLink>
              </div>
            </div>

            <div className="shrink-0 space-y-3 border-t border-white/10 bg-slate-950 pt-4">
              <AddModal
                listenForExternalOpen
                triggerClassName="w-full min-h-12 rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(59,130,246,0.28)] transition-all duration-300 hover:bg-blue-400"
                triggerContent="+ Add New"
              />

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
