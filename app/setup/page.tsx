
import { ui } from '../../lib/ui-i18n'
import { getRequestLocale } from '../../lib/i18n-server'
import Link from 'next/link'
import type { Metadata } from 'next'

import { requireCurrentUser } from '../../lib/auth/dal'
import { getOwnershipMode } from '../../lib/data/ownership'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return {
  title: ui(locale, "Setup | Media Vault"),
  description: ui(locale, "Finish Supabase setup for auth callbacks and per-user privacy."),
}
}
export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const locale = await getRequestLocale()

  await requireCurrentUser()
  const ownershipMode = await getOwnershipMode()
  const isReady = ownershipMode === 'enforced'

  return (
    <main className="vault-page">
      <header className="mb-8 min-w-0 space-y-3">
        <p className="text-sm uppercase tracking-[0.25em] text-slate-500"> {ui(locale, "Project Setup")} </p>
        <h1 className="vault-title"> {ui(locale, "Supabase checklist")} </h1>
        <p className="max-w-3xl text-sm text-slate-400"> {ui(locale, "This page helps finish the last manual setup that cannot be applied from the app itself.")} </p>
      </header>

      <section className="mb-8 min-w-0 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20 sm:p-6">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-400"> {ui(locale, "Ownership status")} </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {isReady ? ui(locale, "Ownership column available") : ui(locale, "Ownership column missing")}
            </p>
          </div>
          <span
            className={`rounded-xl border px-3 py-1 text-sm ${
              isReady
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100'
                : 'border-amber-500/30 bg-amber-500/15 text-amber-100'
            }`}
          >
            {isReady ? ui(locale, "Authorization tests required") : ui(locale, "Schema review required")}
          </span>
        </div>
      </section>

      <section className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card title={ui(locale, "1. Database setup")}>
          <p className="text-sm text-slate-300"> {ui(locale, "Follow the verified operator workflow in the repository. Existing databases need only unapplied forward migrations. Never replay archived SQL.")} </p>
          <CodeBlock>supabase/README.md</CodeBlock>
          <p className="mt-4 text-sm text-slate-400"> {ui(locale, "Column availability alone does not verify RLS. Check access using separate owner, other-user, and anonymous sessions after a schema change.")} </p>
        </Card>

        <Card title={ui(locale, "2. Add the auth callback URLs")}>
          <p className="text-sm text-slate-300"> {ui(locale, "In Supabase Auth URL Configuration, set the Site URL to `https://media-vault.app` and add these redirect URLs:")} </p>
          <CodeBlock>{`https://media-vault.app/auth/callback
https://media-vault.app/auth/reset-password
https://media-vault.app/auth/confirm`}</CodeBlock>
          <p className="mt-4 text-sm text-slate-400"> {ui(locale, "For local development, also allow `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/reset-password`.")} </p>
        </Card>

        <Card title={ui(locale, "3. Required production site URL")}>
          <p className="text-sm text-slate-300"> {ui(locale, "In Vercel Environment Variables, add:")} </p>
          <CodeBlock>NEXT_PUBLIC_SITE_URL=https://media-vault.app</CodeBlock>
          <p className="mt-4 text-sm text-slate-400"> {ui(locale, "This keeps email confirmation and password reset links pointed at production instead of a local development URL.")} </p>
        </Card>

        <Card title={ui(locale, "4. Verify the full flow")}>
          <ul className="mt-1 space-y-3 text-sm text-slate-300">
            <li> {ui(locale, "Create a new account from the login page.")} </li>
            <li> {ui(locale, "Confirm it from email and return through `/auth/callback`.")} </li>
            <li> {ui(locale, "Add, edit, and delete an item.")} </li>
            <li> {ui(locale, "Sign in with another account and confirm records stay isolated.")} </li>
          </ul>
        </Card>

        <Card title={ui(locale, "5. Covers and tracking")}>
          <p className="text-sm text-slate-300"> {ui(locale, "The verified schema includes private notes, progress dates, favorites, genres, and the media-covers bucket. Covers support JPG, PNG, WEBP, and GIF up to 5 MB. Upload permissions are limited to the signed-in owner&apos;s folder.")} </p>
        </Card>
      </section>

      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-200 transition hover:border-blue-500 hover:text-white"
        > {ui(locale, "Back to library")} </Link>
      </div>
    </main>
  )
}

function Card({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20 sm:p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-4 min-w-0 break-words">{children}</div>
    </section>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="mt-4 max-w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
      <code className="block min-w-max whitespace-pre px-4 py-3 text-sm text-slate-200">
        {children}
      </code>
    </div>
  )
}
