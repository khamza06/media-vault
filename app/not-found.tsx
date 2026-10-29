import Link from 'next/link'
import { getRequestLocale } from '../lib/i18n-server'
import { ui } from '../lib/ui-i18n'

export default async function NotFound() {
  const locale = await getRequestLocale()
  return <main className="vault-page">
    <section className="mx-auto max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
      <h1 className="text-3xl font-bold text-white">{ui(locale, 'Page not found')}</h1>
      <p className="mt-3 text-slate-400">{ui(locale, 'This page does not exist or the link is no longer valid.')}</p>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-blue-500 px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">{ui(locale, 'Back to vault')}</Link>
    </section>
  </main>
}
