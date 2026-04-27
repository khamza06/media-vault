import Link from 'next/link'
import type { Metadata } from 'next'

import { requireCurrentUser } from '../../lib/auth/dal'
import { getOwnershipMode } from '../../lib/data/ownership'

export const metadata: Metadata = {
  title: 'Setup | Media Vault',
  description: 'Finish Supabase setup for auth callbacks and per-user privacy.',
}
export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  await requireCurrentUser()
  const ownershipMode = await getOwnershipMode()
  const isReady = ownershipMode === 'enforced'

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 pb-32 sm:px-6 lg:px-8">
      <header className="mt-4 mb-10 min-w-0 space-y-3">
        <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Project Setup</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Supabase checklist</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          This page helps finish the last manual setup that cannot be applied from the app
          itself.
        </p>
      </header>

      <section className="mb-8 min-w-0 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20 sm:p-6">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-400">Ownership status</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {isReady ? 'Ready' : 'Compatibility mode'}
            </p>
          </div>
          <span
            className={`rounded-xl border px-3 py-1 text-sm ${
              isReady
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100'
                : 'border-amber-500/30 bg-amber-500/15 text-amber-100'
            }`}
          >
            {isReady ? 'RLS active' : 'Migration still pending'}
          </span>
        </div>
      </section>

      <section className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card title="1. Apply the SQL migration">
          <p className="text-sm text-slate-300">
            Open the Supabase SQL editor and run the migration from:
          </p>
          <CodeBlock>supabase/migrations/20260326_auth_user_ownership.sql</CodeBlock>
          <p className="mt-4 text-sm text-slate-400">
            This adds `user_id`, creates an index, enables row-level security, and limits
            access to the signed-in user.
          </p>
        </Card>

        <Card title="2. Add the auth callback URLs">
          <p className="text-sm text-slate-300">
            In Supabase Auth URL Configuration, set the Site URL to
            `https://media-vault-seven.vercel.app` and add these redirect URLs:
          </p>
          <CodeBlock>{`https://media-vault-seven.vercel.app/auth/callback
https://media-vault-seven.vercel.app/auth/reset-password`}</CodeBlock>
          <p className="mt-4 text-sm text-slate-400">
            For local development, also allow `http://localhost:3000/auth/callback`
            and `http://localhost:3000/auth/reset-password`.
          </p>
        </Card>

        <Card title="3. Required production site URL">
          <p className="text-sm text-slate-300">
            In Vercel Environment Variables, add:
          </p>
          <CodeBlock>NEXT_PUBLIC_SITE_URL=https://media-vault-seven.vercel.app</CodeBlock>
          <p className="mt-4 text-sm text-slate-400">
            This keeps email confirmation and password reset links pointed at production
            instead of a local development URL.
          </p>
        </Card>

        <Card title="4. Verify the full flow">
          <ul className="mt-1 space-y-3 text-sm text-slate-300">
            <li>Create a new account from the login page.</li>
            <li>Confirm it from email and return through `/auth/callback`.</li>
            <li>Add, edit, and delete an item.</li>
            <li>Sign in with another account and confirm records stay isolated.</li>
          </ul>
        </Card>

        <Card title="5. Optional cover uploads">
          <p className="text-sm text-slate-300">
            If you want to upload cover files instead of pasting image URLs, also run:
          </p>
          <CodeBlock>supabase/migrations/20260326_storage_media_covers.sql</CodeBlock>
          <p className="mt-4 text-sm text-slate-400">
            This creates a public `media-covers` bucket and allows authenticated users to
            manage only files inside their own folder.
          </p>
        </Card>

        <Card title="6. Optional item metadata">
          <p className="text-sm text-slate-300">
            To unlock notes, total progress, and timeline fields in the UI, also run:
          </p>
          <CodeBlock>supabase/migrations/20260326_item_metadata.sql</CodeBlock>
          <p className="mt-4 text-sm text-slate-400">
            This adds `notes`, `total_progress`, `started_at`, and `completed_at` to the
            `items` table.
          </p>
        </Card>

        <Card title="7. Optional favorites">
          <p className="text-sm text-slate-300">
            To unlock favorites, quick starring, and favorites filters, also run:
          </p>
          <CodeBlock>supabase/migrations/20260326_item_favorites.sql</CodeBlock>
          <p className="mt-4 text-sm text-slate-400">
            This adds a `favorite` boolean to each item and powers the favorites UI.
          </p>
        </Card>

        <Card title="8. Optional genres">
          <p className="text-sm text-slate-300">
            To unlock genre tags, genre search, and genre stats, also run:
          </p>
          <CodeBlock>supabase/migrations/20260326_item_genres.sql</CodeBlock>
          <p className="mt-4 text-sm text-slate-400">
            This adds a `genres` text array to each item and powers genre chips, search,
            and stats panels.
          </p>
        </Card>
      </section>

      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-200 transition hover:border-blue-500 hover:text-white"
        >
          Back to library
        </Link>
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
