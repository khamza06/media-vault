import { translateMessage } from '../../../lib/ui-i18n'

import { ui } from '../../../lib/ui-i18n'
import { getRequestLocale } from '../../../lib/i18n-server'
import Link from 'next/link'
import type { Metadata } from 'next'

import ListDetailManager from '../../../components/lists/ListDetailManager'
import { getCustomListDetail } from '../../../lib/data/lists'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return {
  title: ui(locale, "List Detail | Media Vault"),
  description: ui(locale, "Manage a private custom Media Vault list."),
}
}

export default async function ListDetailPage(props: {
  params: Promise<{
    id: string
  }>
}) {
  const locale = await getRequestLocale()

  const { id } = await props.params
  const result = await getCustomListDetail(id)

  return (
    <main className="vault-page">
      {!result.schemaReady ? <ListsSetupCard /> : null}

      {result.error ? (
        <MessageCard title={ui(locale, "List is private")} message={translateMessage(locale, result.error)} actionHref="/login" actionLabel={ui(locale, "Sign in")} />
      ) : result.notFound ? (
        <MessageCard
          title={ui(locale, "List not found")}
          message={ui(locale, "This list does not exist, or it does not belong to your account.")}
          actionHref="/lists"
          actionLabel={ui(locale, "Back to lists")}
        />
      ) : result.list ? (
        <ListDetailManager availableItems={result.availableItems} list={result.list} />
      ) : result.schemaReady ? (
        <MessageCard
          title={ui(locale, "Could not open this list")}
          message={ui(locale, "Please refresh the page and try again.")}
          actionHref="/lists"
          actionLabel={ui(locale, "Back to lists")}
        />
      ) : null}
    </main>
  )
}

async function ListsSetupCard() {
  const locale = await getRequestLocale()

  return (
    <section className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-5 text-amber-100">
      <h1 className="text-lg font-bold"> {ui(locale, "One SQL setup step is needed")} </h1>
      <p className="mt-2 text-sm leading-6 text-amber-50/85"> {ui(locale, "Custom list tables are not available in Supabase yet. Run this file once in Supabase SQL Editor, then refresh this page:")} </p>
      <p className="mt-3 rounded-xl border border-amber-400/20 bg-slate-950 px-4 py-3 text-sm text-amber-100">
        supabase/README.md
      </p>
    </section>
  )
}

async function MessageCard({
  actionHref,
  actionLabel,
  message,
  title,
}: {
  actionHref: string
  actionLabel: string
  message: string
  title: string
}) {
  const locale = await getRequestLocale()

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
      <h1 className="text-xl font-bold text-slate-100">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">{translateMessage(locale, message)}</p>
      <Link
        href={actionHref}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400"
      >
        {actionLabel}
      </Link>
    </section>
  )
}
