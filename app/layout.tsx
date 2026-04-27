import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

import AppHeader from '../components/AppHeader'
import { LocaleProvider } from '../components/LocaleProvider'
import MobileTabBar from '../components/MobileTabBar'
import PwaShell from '../components/PwaShell'
import { ToastProvider } from '../components/ToastProvider'
import { getCurrentUser } from '../lib/auth/dal'
import { getConfiguredSiteUrl } from '../lib/auth/site-url'
import { getRequestLocale } from '../lib/i18n-server'
import './globals.css'

const geistSans = localFont({
  src: [
    {
      path: '../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2',
      style: 'normal',
      weight: '100 900',
    },
    {
      path: '../node_modules/next/dist/next-devtools/server/font/geist-latin-ext.woff2',
      style: 'normal',
      weight: '100 900',
    },
  ],
  variable: '--font-sans',
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

const siteUrl = getConfiguredSiteUrl() ?? 'https://media-vault-seven.vercel.app'
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

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_32%),linear-gradient(180deg,_#111827_0%,_#0f172a_24%,_#111827_100%)] pb-24 text-slate-50 md:pb-0"
        suppressHydrationWarning
      >
        <LocaleProvider locale={locale}>
          <ToastProvider>
            <PwaShell />
            <AppHeader userEmail={user?.email ?? null} userId={user?.id ?? null} />
            {children}
            <MobileTabBar userId={user?.id ?? null} />
          </ToastProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
