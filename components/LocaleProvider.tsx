'use client'

import { createContext, useContext, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { getMessages, localeCookieName, type Locale, type MessageKey } from '../lib/i18n'

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
  children,
  locale,
}: {
  children: React.ReactNode
  locale: Locale
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [currentLocale, setCurrentLocale] = useState(locale)

  useEffect(() => {
    setCurrentLocale(locale)
  }, [locale])

  const value = useMemo<LocaleContextValue>(() => {
    const currentMessages = getMessages(currentLocale)

    return {
      locale: currentLocale,
      setLocale(nextLocale) {
        if (nextLocale === currentLocale) {
          return
        }

        setCurrentLocale(nextLocale)
        window.localStorage.setItem(localeCookieName, nextLocale)
        document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`

        startTransition(async () => {
          await fetch('/api/locale', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ locale: nextLocale }),
          })

          router.refresh()
        })
      },
      t(key, vars) {
        const template = currentMessages[key] ?? key

        if (!vars) {
          return template
        }

        return template.replace(/\{(\w+)\}/g, (_, token) => String(vars[token] ?? `{${token}}`))
      },
    }
  }, [currentLocale, router])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const context = useContext(LocaleContext)

  if (!context) {
    throw new Error('useLocale must be used inside LocaleProvider.')
  }

  return context
}
