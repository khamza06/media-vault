import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

import AppHeader from '../components/AppHeader'
import { LocaleProvider } from '../components/LocaleProvider'
import MobileTabBar from '../components/MobileTabBar'
import PwaShell from '../components/PwaShell'
import { ToastProvider } from '../components/ToastProvider'
import { getCurrentUser } from '../lib/auth/dal'
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

export const metadata: Metadata = {
  title: {
    default: 'Media Vault',
    template: '%s | Media Vault',
  },
  description: 'A private media vault for anime, manga, manhwa, movies, series, and books.',
  applicationName: 'Media Vault',
  manifest: '/manifest.json',
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
