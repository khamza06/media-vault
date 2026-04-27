import { notFound } from 'next/navigation'

import ShelfGridView from '../../../components/ShelfGridView'
import { getItems } from '../../../lib/data/items'
import { getCustomLists } from '../../../lib/data/lists'
import { toMediaItem } from '../../../lib/media'
import { filterItemsForShelf, getShelfDefinitionBySlug } from '../../../lib/shelves'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function ShelfPage(props: {
  params: Promise<{
    type: string
  }>
}) {
  const { type } = await props.params
  const shelf = getShelfDefinitionBySlug(type)

  if (!shelf) {
    notFound()
  }

  const [itemsResult, listsResult] = await Promise.all([getItems(), getCustomLists()])
  const { data: items, error } = itemsResult

  if (error) {
    console.error(`Error loading shelf "${type}":`, error)
  }

  const mediaItems = (items ?? []).map(toMediaItem)
  const shelfItems = filterItemsForShelf(mediaItems, shelf.slug)
  const listOptions = listsResult.schemaReady ? listsResult.lists : []

  return (
    <ShelfGridView
      description={shelf.description}
      items={shelfItems}
      listOptions={listOptions}
      title={shelf.label}
    />
  )
}
