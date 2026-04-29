'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

const DISMISS_KEY = 'media-vault-install-dismissed'

function isLocalLikeHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  )
}

export default function PwaShell() {
  const pathname = usePathname()
  const [clientState, setClientState] = useState({
    dismissed: true,
    isIOS: false,
    isStandalone: true,
  })
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const shouldRegister =
      process.env.NODE_ENV === 'production' &&
      window.location.protocol === 'https:' &&
      !isLocalLikeHost(window.location.hostname)

    if (!shouldRegister) {
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(registrations.map((registration) => registration.unregister()))
          )
          .then(async () => {
            if (!('caches' in window)) {
              return
            }

            const keys = await caches.keys()
            await Promise.all(
              keys
                .filter((key) => key.startsWith('media-vault-shell-'))
                .map((key) => caches.delete(key))
            )
          })
          .catch(() => {})
      }

      return
    }

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
      const ios = /iPad|iPhone|iPod/.test(window.navigator.userAgent)
      const wasDismissed = window.localStorage.getItem(DISMISS_KEY) === '1'

      setClientState({
        dismissed: wasDismissed,
        isIOS: ios,
        isStandalone: standalone,
      })
    })

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const shouldShow = useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      return false
    }

    if (pathname === '/login') {
      return false
    }

    if (clientState.isStandalone || clientState.dismissed) {
      return false
    }

    return Boolean(deferredPrompt) || clientState.isIOS
  }, [
    clientState.dismissed,
    clientState.isIOS,
    clientState.isStandalone,
    deferredPrompt,
    pathname,
  ])

  function dismissPrompt() {
    window.localStorage.setItem(DISMISS_KEY, '1')
    setClientState((current) => ({
      ...current,
      dismissed: true,
    }))
  }

  async function handleInstall() {
    if (!deferredPrompt) {
      return
    }

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice

    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null)
      window.localStorage.setItem(DISMISS_KEY, '1')
      setClientState((current) => ({
        ...current,
        dismissed: true,
      }))
    }
  }

  if (!shouldShow) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-50 px-3 md:bottom-4 md:px-4 md:pb-4">
      <div className="glass-panel surface-highlight pointer-events-auto mx-auto flex max-h-[calc(100dvh-9rem)] max-w-md flex-col gap-4 overflow-y-auto rounded-xl p-4 sm:p-5 md:max-h-[calc(100dvh-2rem)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-blue-300/70">
              Install App
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
              Use Media Vault like an app
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Keep the vault on your Home Screen for faster access on iPhone, iPad,
              and laptop.
            </p>
          </div>

          <button
            type="button"
            onClick={dismissPrompt}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Not now
          </button>
        </div>

        {deferredPrompt ? (
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="min-h-12 rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(59,130,246,0.32)] transition hover:bg-blue-400"
          >
            Install Media Vault
          </button>
        ) : null}

        {clientState.isIOS ? (
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">
            On iPhone or iPad, tap Share in Safari and choose Add to Home Screen.
          </p>
        ) : null}
      </div>
    </div>
  )
}
