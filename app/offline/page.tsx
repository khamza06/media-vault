import type { Metadata } from 'next'

import { ui } from '../../lib/ui-i18n'
import { getRequestLocale } from '../../lib/i18n-server'
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return {
  title: ui(locale, "Offline | Media Vault"),
}
}

export default async function OfflinePage() {
  const locale = await getRequestLocale()

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10 pb-32 sm:px-6 lg:px-8">
      <section className="glass-panel surface-highlight w-full rounded-xl p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.45)]">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-blue-300/70"> {ui(locale, "Offline")} </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl"> {ui(locale, "Media Vault is temporarily offline")} </h1>
        <p className="mt-4 text-base leading-7 text-slate-300"> {ui(locale, "Reconnect to the internet and open the app again to sync your library, quick imports, and Supabase data.")} </p>
      </section>
    </main>
  )
}
