'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { getMessages, localeCookieName, t, type Locale, type MessageKey } from '../lib/i18n'
import { metadataLanguageCookieName, type MetadataLanguage } from '../lib/metadata-language'

type LocaleContextValue = {
  locale: Locale
  metadataLanguage: MetadataLanguage
  setMetadataLanguage: (language: MetadataLanguage) => void
  setLocale: (locale: Locale) => void
  isChangingLocale: boolean
  localeError: string
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
  children,
  locale,
  metadataLanguage = 'en',
}: {
  children: React.ReactNode
  locale: Locale
  metadataLanguage?: MetadataLanguage
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [currentLocale, setCurrentLocale] = useState(locale)
  const [currentMetadataLanguage, setCurrentMetadataLanguage] = useState(metadataLanguage)
  const [isChangingLocale, setIsChangingLocale] = useState(false)
  const [localeError, setLocaleError] = useState('')
  const pending = useRef(false)

  useEffect(() => {
    setCurrentLocale(locale)
  }, [locale])
  useEffect(() => { document.documentElement.lang = currentLocale }, [currentLocale])
  useEffect(() => { setCurrentMetadataLanguage(metadataLanguage) }, [metadataLanguage])

  const value = useMemo<LocaleContextValue>(() => {
    const currentMessages = getMessages(currentLocale)

    return {
      locale: currentLocale,
      metadataLanguage: currentMetadataLanguage,
      setMetadataLanguage(nextLanguage) {
        if (pending.current || (nextLanguage === currentMetadataLanguage && !localeError)) return
        setCurrentMetadataLanguage(nextLanguage)
        setLocaleError('')
        setIsChangingLocale(true)
        pending.current = true
        try { window.localStorage.setItem(metadataLanguageCookieName, nextLanguage) } catch { /* Cookie persistence remains available. */ }
        try { document.cookie = `${metadataLanguageCookieName}=${nextLanguage}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax` } catch { /* Confirm through the route. */ }
        startTransition(async () => {
          try {
            const response = await fetch('/api/locale', { method: 'POST', signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metadataLanguage: nextLanguage }) })
            if (!response.ok) throw new Error('Preference not confirmed')
            router.refresh()
          } catch { setLocaleError(t(currentLocale, 'language.saveError')) }
          finally { pending.current = false; setIsChangingLocale(false) }
        })
      },
      isChangingLocale,
      localeError,
      setLocale(nextLocale) {
        if (pending.current || (nextLocale === currentLocale && !localeError)) {
          return
        }

        setCurrentLocale(nextLocale)
        setLocaleError('')
        setIsChangingLocale(true)
        pending.current = true
        try { window.localStorage.setItem(localeCookieName, nextLocale) } catch { /* Cookies can still persist the preference. */ }
        try { document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax` } catch { /* The API can still set the cookie. */ }

        startTransition(async () => {
          try {
            const response = await fetch('/api/locale', {
              method: 'POST', signal: AbortSignal.timeout(8000),
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ locale: nextLocale }),
            })
            if (!response.ok) throw new Error('Language preference was not confirmed')
            router.refresh()
          } catch { setLocaleError(t(nextLocale, 'language.saveError')) }
          finally { pending.current = false; setIsChangingLocale(false) }
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
  }, [currentLocale, currentMetadataLanguage, isChangingLocale, localeError, router])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const context = useContext(LocaleContext)

  if (!context) {
    throw new Error('useLocale must be used inside LocaleProvider.')
  }

  return context
}
