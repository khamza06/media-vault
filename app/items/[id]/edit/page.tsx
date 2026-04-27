import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import EditItemPageForm from '../../../../components/EditItemPageForm'
import { getItemById } from '../../../../lib/data/items'
import { toMediaItem } from '../../../../lib/media'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export async function generateMetadata(
  props: PageProps<'/items/[id]/edit'>
): Promise<Metadata> {
  const { id } = await props.params
  const { data: item } = await getItemById(id)

  if (!item) {
    return {
      title: 'Edit Item | Media Vault',
    }
  }

  return {
    title: `Edit ${item.title} | Media Vault`,
    description: `Update ${item.title} in your media vault.`,
  }
}

export default async function EditItemPage(props: PageProps<'/items/[id]/edit'>) {
  const { id } = await props.params
  const searchParams = await props.searchParams
  const { data: item, error } = await getItemById(id)

  if (error || !item) {
    notFound()
  }

  const returnTo =
    typeof searchParams.returnTo === 'string' && searchParams.returnTo.startsWith('/')
      ? searchParams.returnTo
      : `/items/${id}`

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-6 pb-32 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={returnTo}
          className="glass-panel-soft inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400/40 hover:text-white"
        >
          Back
        </Link>
      </div>

      <EditItemPageForm item={toMediaItem(item)} returnTo={returnTo} />
    </main>
  )
}
