import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

import AppHeader from '../components/AppHeader'
import { getOrCreateProfile } from './actions/profile'
import { LocaleProvider } from '../components/LocaleProvider'
import MobileTabBar from '../components/MobileTabBar'
import PwaShell from '../components/PwaShell'
import { ToastProvider } from '../components/ToastProvider'
import VaultPreferencesProvider from '../components/VaultPreferencesProvider'
import { getCurrentUser } from '../lib/auth/dal'
import { getConfiguredSiteUrl } from '../lib/auth/site-url'
import { getRequestLocale } from '../lib/i18n-server'
import { t } from '../lib/i18n'
import './globals.css'

const manrope = localFont({
  src: './fonts/Manrope-Variable.ttf',
  display: 'swap',
  weight: '200 800',
  variable: '--font-body',
})

const geistMono = localFont({
  src: [
    {
      path: '../node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2',
      style: 'normal',
      weight: '100 900',
    },
    {
      path: '../node_modules/next/dist/next-devtools/server/font/geist-mono-latin-ext.woff2',
      style: 'normal',
      weight: '100 900',
    },
  ],
  variable: '--font-mono',
})

export const dynamic = 'force-dynamic'

const siteUrl = getConfiguredSiteUrl() ?? 'https://media-vault.app'
const siteDescription =
  'Track anime, manga, movies, series, and books in one personal media vault.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Media Vault',
    template: '%s | Media Vault',
  },
  description: siteDescription,
  applicationName: 'Media Vault',
  authors: [{ name: 'Media Vault' }],
  category: 'Entertainment',
  keywords: [
    'media tracker',
    'anime tracker',
    'manga tracker',
    'movie tracker',
    'book tracker',
    'personal media vault',
  ],
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: '/',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Media Vault',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Media Vault',
    description: siteDescription,
    url: siteUrl,
    siteName: 'Media Vault',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Media Vault app preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Media Vault',
    description: siteDescription,
    images: ['/opengraph-image'],
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0f172a',
  interactiveWidget: 'resizes-content',
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()
  const locale = await getRequestLocale()
  const profileResult = user ? await getOrCreateProfile() : null
  const displayName = profileResult?.profile?.displayName?.trim()
  const username = profileResult?.profile?.username?.trim()
  const accountLabel =
    displayName || (username ? `@${username}` : undefined) || user?.email?.split('@')[0] || 'Account'

  return (
    <html
      lang={locale}
      className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-slate-950 text-slate-100"
        suppressHydrationWarning
      >
        <LocaleProvider locale={locale}>
          <a href="#main-content" className="vault-skip-link">{t(locale, 'nav.skipToContent')}</a>
          <ToastProvider>
            <VaultPreferencesProvider userId={user?.id ?? null}>
              <PwaShell />
              <AppHeader accountLabel={accountLabel} userId={user?.id ?? null} />
              <div id="main-content" tabIndex={-1} className="outline-none">{children}</div>
              <MobileTabBar userId={user?.id ?? null} />
            </VaultPreferencesProvider>
          </ToastProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
