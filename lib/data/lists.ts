import 'server-only'

import { getCurrentUser } from '../auth/dal'
import { getItems, getPublicItemsByUserId } from './items'
import { toMediaItem, type MediaItem } from '../media'
import { createSupabaseServerClient } from '../supabase/server'

const listSelectFieldsWithSharing =
  'id, name, description, is_public, slug, created_at, updated_at'
const listSelectFields = 'id, name, description, created_at, updated_at'

export type CustomListSummary = {
  createdAt: string | null
  description: string | null
  id: string
  isPublic: boolean
  itemCount: number
  name: string
  slug: string | null
  updatedAt: string | null
}

export type CustomListDetail = CustomListSummary & {
  items: MediaItem[]
}

export type CustomListsResult = {
  error: string | null
  lists: CustomListSummary[]
  schemaReady: boolean
  sharingReady: boolean
}

export type CustomListDetailResult = {
  availableItems: MediaItem[]
  error: string | null
  list: CustomListDetail | null
  notFound: boolean
  schemaReady: boolean
  sharingReady: boolean
}

export type PublicListSummary = {
  createdAt: string | null
  description: string | null
  id: string
  itemCount: number
  name: string
  slug: string
  updatedAt: string | null
}

export type PublicListsResult = {
  error: string | null
  lists: PublicListSummary[]
}

export type PublicListDetail = PublicListSummary & {
  items: MediaItem[]
}

export type PublicListDetailResult = {
  error: string | null
  list: PublicListDetail | null
  notFound: boolean
}

type ListRow = {
  created_at?: string | null
  description?: string | null
  id: string
  is_public?: boolean | null
  name: string
  slug?: string | null
  updated_at?: string | null
}

type ListItemRow = {
  created_at?: string | null
  item_id: string
  list_id?: string | null
}

export function isMissingListSchemaError(error?: { code?: string; message?: string | null } | null) {
  const message = error?.message ?? ''

  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    message.includes('public.lists') ||
    message.includes('public.list_items') ||
    message.includes("Could not find the table 'public.lists'") ||
    message.includes("Could not find the table 'public.list_items'") ||
    message.includes("Could not find a relationship")
  )
}

export function isMissingListSharingSchemaError(
  error?: { code?: string; message?: string | null } | null
) {
  const message = (error?.message ?? '').toLowerCase()

  return (
    error?.code === '42703' ||
    message.includes("'is_public'") ||
    message.includes('"is_public"') ||
    message.includes('lists.is_public') ||
    message.includes("'slug'") ||
    message.includes('"slug"') ||
    message.includes('lists.slug')
  )
}

function toCustomListSummary(row: ListRow, itemCount: number): CustomListSummary {
  return {
    createdAt: row.created_at ?? null,
    description: row.description ?? null,
    id: row.id,
    isPublic: Boolean(row.is_public),
    itemCount,
    name: row.name,
    slug: row.slug ?? null,
    updatedAt: row.updated_at ?? row.created_at ?? null,
  }
}

function toPublicListSummary(row: ListRow, itemCount: number): PublicListSummary | null {
  const slug = row.slug?.trim() ?? ''

  if (!slug) {
    return null
  }

  return {
    createdAt: row.created_at ?? null,
    description: row.description ?? null,
    id: row.id,
    itemCount,
    name: row.name,
    slug,
    updatedAt: row.updated_at ?? row.created_at ?? null,
  }
}

async function selectListsWithSharingFallback(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string
) {
  const listsResult = await supabase
    .from('lists')
    .select(listSelectFieldsWithSharing)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (!listsResult.error) {
    return {
      error: null,
      rows: (listsResult.data ?? []) as ListRow[],
      sharingReady: true,
    }
  }

  if (!isMissingListSharingSchemaError(listsResult.error)) {
    return {
      error: listsResult.error,
      rows: [] as ListRow[],
      sharingReady: true,
    }
  }

  const fallbackResult = await supabase
    .from('lists')
    .select(listSelectFields)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  return {
    error: fallbackResult.error,
    rows: ((fallbackResult.data ?? []) as ListRow[]).map((row) => ({
      ...row,
      is_public: false,
      slug: null,
    })),
    sharingReady: false,
  }
}

async function selectListDetailWithSharingFallback(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  listId: string,
  userId: string
) {
  const listResult = await supabase
    .from('lists')
    .select(listSelectFieldsWithSharing)
    .eq('id', listId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!listResult.error) {
    return {
      error: null,
      row: (listResult.data ?? null) as ListRow | null,
      sharingReady: true,
    }
  }

  if (!isMissingListSharingSchemaError(listResult.error)) {
    return {
      error: listResult.error,
      row: null,
      sharingReady: true,
    }
  }

  const fallbackResult = await supabase
    .from('lists')
    .select(listSelectFields)
    .eq('id', listId)
    .eq('user_id', userId)
    .maybeSingle()

  return {
    error: fallbackResult.error,
    row: fallbackResult.data
      ? ({
          ...(fallbackResult.data as ListRow),
          is_public: false,
          slug: null,
        } satisfies ListRow)
      : null,
    sharingReady: false,
  }
}

export async function getCustomLists(): Promise<CustomListsResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      error: 'Sign in to manage custom lists.',
      lists: [],
      schemaReady: true,
      sharingReady: true,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const listsResult = await selectListsWithSharingFallback(supabase, user.id)

  if (listsResult.error) {
    if (isMissingListSchemaError(listsResult.error)) {
      return { error: null, lists: [], schemaReady: false, sharingReady: false }
    }

    return {
      error: 'Could not load custom lists right now.',
      lists: [],
      schemaReady: true,
      sharingReady: listsResult.sharingReady,
    }
  }

  const rows = listsResult.rows
  const listIds = rows.map((list) => list.id)
  const counts = new Map<string, number>()

  if (listIds.length > 0) {
    const itemsResult = await supabase
      .from('list_items')
      .select('list_id')
      .eq('user_id', user.id)
      .in('list_id', listIds)

    if (itemsResult.error) {
      if (isMissingListSchemaError(itemsResult.error)) {
        return { error: null, lists: [], schemaReady: false, sharingReady: false }
      }

      return {
        error: 'Could not load list item counts right now.',
        lists: [],
        schemaReady: true,
        sharingReady: listsResult.sharingReady,
      }
    }

    for (const item of (itemsResult.data ?? []) as ListItemRow[]) {
      if (item.list_id) {
        counts.set(item.list_id, (counts.get(item.list_id) ?? 0) + 1)
      }
    }
  }

  return {
    error: null,
    lists: rows.map((row) => toCustomListSummary(row, counts.get(row.id) ?? 0)),
    schemaReady: true,
    sharingReady: listsResult.sharingReady,
  }
}

export async function getCustomListDetail(listId: string): Promise<CustomListDetailResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      availableItems: [],
      error: 'Sign in to open custom lists.',
      list: null,
      notFound: false,
      schemaReady: true,
      sharingReady: true,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const listResult = await selectListDetailWithSharingFallback(supabase, listId, user.id)

  if (listResult.error) {
    if (isMissingListSchemaError(listResult.error)) {
      return {
        availableItems: [],
        error: null,
        list: null,
        notFound: false,
        schemaReady: false,
        sharingReady: false,
      }
    }

    return {
      availableItems: [],
      error: 'Could not load this list right now.',
      list: null,
      notFound: false,
      schemaReady: true,
      sharingReady: listResult.sharingReady,
    }
  }

  if (!listResult.row) {
    return {
      availableItems: [],
      error: null,
      list: null,
      notFound: true,
      schemaReady: true,
      sharingReady: listResult.sharingReady,
    }
  }

  const listRow = listResult.row
  const listItemsResult = await supabase
    .from('list_items')
    .select('item_id, created_at')
    .eq('list_id', listId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (listItemsResult.error) {
    if (isMissingListSchemaError(listItemsResult.error)) {
      return {
        availableItems: [],
        error: null,
        list: null,
        notFound: false,
        schemaReady: false,
        sharingReady: false,
      }
    }

    return {
      availableItems: [],
      error: 'Could not load items in this list right now.',
      list: null,
      notFound: false,
      schemaReady: true,
      sharingReady: listResult.sharingReady,
    }
  }

  const allItemsResult = await getItems()

  if (allItemsResult.error) {
    return {
      availableItems: [],
      error: 'Could not load your vault items right now.',
      list: null,
      notFound: false,
      schemaReady: true,
      sharingReady: listResult.sharingReady,
    }
  }

  const allItems = (allItemsResult.data ?? []).map(toMediaItem)
  const listItemRows = (listItemsResult.data ?? []) as ListItemRow[]
  const itemIds = listItemRows.map((item) => item.item_id)
  const itemIdSet = new Set(itemIds)
  const itemById = new Map(allItems.map((item) => [item.id, item]))
  const listItems = itemIds
    .map((id) => itemById.get(id))
    .filter((item): item is MediaItem => Boolean(item))

  return {
    availableItems: allItems.filter((item) => !itemIdSet.has(item.id)),
    error: null,
    list: {
      createdAt: listRow.created_at ?? null,
      description: listRow.description ?? null,
      id: listRow.id,
      isPublic: Boolean(listRow.is_public),
      itemCount: listItems.length,
      items: listItems,
      name: listRow.name,
      slug: listRow.slug ?? null,
      updatedAt: listRow.updated_at ?? listRow.created_at ?? null,
    },
    notFound: false,
    schemaReady: true,
    sharingReady: listResult.sharingReady,
  }
}

export async function getPublicListsForProfile(userId: string): Promise<PublicListsResult> {
  const supabase = createSupabaseServerClient()
  const listsResult = await supabase
    .from('lists')
    .select(listSelectFieldsWithSharing)
    .eq('user_id', userId)
    .eq('is_public', true)
    .not('slug', 'is', null)
    .order('updated_at', { ascending: false })

  if (listsResult.error) {
    return {
      error: isMissingListSchemaError(listsResult.error) ||
        isMissingListSharingSchemaError(listsResult.error)
        ? 'Public list sharing is not installed yet.'
        : 'Could not load public lists right now.',
      lists: [],
    }
  }

  const rows = (listsResult.data ?? []) as ListRow[]
  const listIds = rows.map((list) => list.id)
  const counts = new Map<string, number>()

  if (listIds.length > 0) {
    const itemsResult = await supabase
      .from('list_items')
      .select('list_id')
      .in('list_id', listIds)

    if (!itemsResult.error) {
      for (const item of (itemsResult.data ?? []) as ListItemRow[]) {
        if (item.list_id) {
          counts.set(item.list_id, (counts.get(item.list_id) ?? 0) + 1)
        }
      }
    }
  }

  return {
    error: null,
    lists: rows
      .map((row) => toPublicListSummary(row, counts.get(row.id) ?? 0))
      .filter((list): list is PublicListSummary => Boolean(list)),
  }
}

export async function getPublicListDetailBySlug(
  userId: string,
  slug: string
): Promise<PublicListDetailResult> {
  const supabase = createSupabaseServerClient()
  const normalizedSlug = slug.trim().toLowerCase()
  const listResult = await supabase
    .from('lists')
    .select(listSelectFieldsWithSharing)
    .eq('user_id', userId)
    .eq('slug', normalizedSlug)
    .eq('is_public', true)
    .maybeSingle()

  if (listResult.error) {
    return {
      error: isMissingListSchemaError(listResult.error) ||
        isMissingListSharingSchemaError(listResult.error)
        ? 'Public list sharing is not installed yet.'
        : 'Could not load this public list right now.',
      list: null,
      notFound: false,
    }
  }

  if (!listResult.data) {
    return { error: null, list: null, notFound: true }
  }

  const listRow = listResult.data as ListRow
  const listSummary = toPublicListSummary(listRow, 0)

  if (!listSummary) {
    return { error: null, list: null, notFound: true }
  }

  const listItemsResult = await supabase
    .from('list_items')
    .select('item_id, created_at')
    .eq('list_id', listRow.id)
    .order('created_at', { ascending: false })

  if (listItemsResult.error) {
    return {
      error: isMissingListSchemaError(listItemsResult.error)
        ? 'Public list sharing is not installed yet.'
        : 'Could not load items in this public list right now.',
      list: null,
      notFound: false,
    }
  }

  const listItemRows = (listItemsResult.data ?? []) as ListItemRow[]
  const itemIds = listItemRows.map((item) => item.item_id)

  if (itemIds.length === 0) {
    return {
      error: null,
      list: {
        ...listSummary,
        itemCount: 0,
        items: [],
      },
      notFound: false,
    }
  }

  const publicItemsResult = await getPublicItemsByUserId(userId)

  if (publicItemsResult.error) {
    return {
      error: 'Could not load public vault items right now.',
      list: null,
      notFound: false,
    }
  }

  const publicItems = (publicItemsResult.data ?? []).map(toMediaItem)
  const itemById = new Map(publicItems.map((item) => [item.id, item]))
  const items = itemIds
    .map((id) => itemById.get(id))
    .filter((item): item is MediaItem => Boolean(item))

  return {
    error: null,
    list: {
      ...listSummary,
      itemCount: items.length,
      items,
    },
    notFound: false,
  }
}
