'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '../../lib/auth/dal'
import { isMissingListSchemaError, isMissingListSharingSchemaError } from '../../lib/data/lists'
import { shelfDefinitions } from '../../lib/shelves'
import { createSupabaseServerClient } from '../../lib/supabase/server'

type ListActionResult = {
  error: string | null
  success: boolean
}

type CreateListResult = ListActionResult & {
  listId: string | null
}

type AddItemsResult = ListActionResult & {
  added: number
  skipped: number
}

type AddItemToListsResult = ListActionResult & {
  added: number
  failed: number
  skipped: number
}

type DeleteListResult = ListActionResult & {
  deleted: boolean
}

type UpdateListSharingResult = ListActionResult & {
  list: {
    id: string
    isPublic: boolean
    slug: string | null
  } | null
}

const MAX_LIST_NAME_LENGTH = 80
const MAX_LIST_DESCRIPTION_LENGTH = 500
const MAX_LIST_ITEMS_PER_ACTION = 500
const MAX_LIST_SLUG_LENGTH = 60
const MIN_LIST_SLUG_LENGTH = 3
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LIST_SLUG_PATTERN = /^[a-z0-9_-]{3,60}$/

function getSchemaSetupMessage() {
  return 'Custom lists need the SQL migration first: supabase/migrations/20260426_custom_lists.sql'
}

function getListSharingSetupMessage() {
  return 'Public list sharing needs the SQL migration first: supabase/migrations/20260427_public_profiles_lists.sql'
}

function normalizeListInput(input: { description?: string | null; name?: string | null }) {
  const name = (input.name ?? '').trim()
  const description = (input.description ?? '').trim()

  if (!name) {
    return { data: null, error: 'List name is required.' }
  }

  if (name.length > MAX_LIST_NAME_LENGTH) {
    return { data: null, error: `List name must be ${MAX_LIST_NAME_LENGTH} characters or less.` }
  }

  if (description.length > MAX_LIST_DESCRIPTION_LENGTH) {
    return {
      data: null,
      error: `Description must be ${MAX_LIST_DESCRIPTION_LENGTH} characters or less.`,
    }
  }

  return {
    data: {
      description: description || null,
      name,
    },
    error: null,
  }
}

function normalizeListSharingInput(input: { isPublic?: boolean; slug?: string | null }) {
  const isPublic = Boolean(input.isPublic)
  const slug = (input.slug ?? '').trim().toLowerCase()

  if (isPublic && !slug) {
    return { data: null, error: 'Choose a list slug before making this list public.' }
  }

  if (slug && !LIST_SLUG_PATTERN.test(slug)) {
    return {
      data: null,
      error: `List slug must be ${MIN_LIST_SLUG_LENGTH}-${MAX_LIST_SLUG_LENGTH} characters and use only lowercase letters, numbers, underscores, or hyphens.`,
    }
  }

  return {
    data: {
      isPublic,
      slug: slug || null,
    },
    error: null,
  }
}

function normalizeIds(values: unknown, maxCount = MAX_LIST_ITEMS_PER_ACTION) {
  if (!Array.isArray(values)) {
    return { error: 'Invalid item selection.', ids: [] as string[] }
  }

  const ids = [
    ...new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => UUID_PATTERN.test(value))
    ),
  ]

  if (ids.length === 0) {
    return { error: 'Select at least one item.', ids }
  }

  if (ids.length > maxCount) {
    return { error: `You can add up to ${maxCount} items at once.`, ids: [] as string[] }
  }

  return { error: null, ids }
}

function isValidId(value: string) {
  return UUID_PATTERN.test(value.trim())
}

function revalidateListPaths(listId?: string) {
  revalidatePath('/')
  revalidatePath('/backup')
  revalidatePath('/import')
  revalidatePath('/library')
  revalidatePath('/lists')
  revalidatePath('/stats')
  revalidatePath('/summary')

  if (listId) {
    revalidatePath(`/lists/${listId}`)
  }

  for (const shelf of shelfDefinitions) {
    revalidatePath(`/shelves/${shelf.slug}`)
  }
}

async function getCurrentProfileUsername(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string
) {
  const profileResult = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle()

  if (profileResult.error || !profileResult.data) {
    return null
  }

  return typeof profileResult.data.username === 'string' ? profileResult.data.username : null
}

export async function createListAction(input: {
  description?: string | null
  name?: string | null
}): Promise<CreateListResult> {
  const user = await getCurrentUser()

  if (!user) {
    return { error: 'You must be signed in to create lists.', listId: null, success: false }
  }

  const normalized = normalizeListInput(input)

  if (normalized.error || !normalized.data) {
    return { error: normalized.error ?? 'Invalid list input.', listId: null, success: false }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const result = await supabase
    .from('lists')
    .insert({
      description: normalized.data.description,
      name: normalized.data.name,
      user_id: user.id,
    })
    .select('id')
    .single()

  if (result.error) {
    return {
      error: isMissingListSchemaError(result.error)
        ? getSchemaSetupMessage()
        : 'Could not create this list right now.',
      listId: null,
      success: false,
    }
  }

  revalidateListPaths(result.data.id)
  return { error: null, listId: result.data.id, success: true }
}

export async function updateListAction(
  listId: string,
  input: {
    description?: string | null
    name?: string | null
  }
): Promise<ListActionResult> {
  const user = await getCurrentUser()

  if (!user) {
    return { error: 'You must be signed in to edit lists.', success: false }
  }

  if (!isValidId(listId)) {
    return { error: 'Invalid list id.', success: false }
  }

  const normalized = normalizeListInput(input)

  if (normalized.error || !normalized.data) {
    return { error: normalized.error ?? 'Invalid list input.', success: false }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const result = await supabase
    .from('lists')
    .update({
      description: normalized.data.description,
      name: normalized.data.name,
    })
    .eq('id', listId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (result.error) {
    return {
      error: isMissingListSchemaError(result.error)
        ? getSchemaSetupMessage()
        : 'Could not update this list right now.',
      success: false,
    }
  }

  if (!result.data) {
    return { error: 'List was not found in your account.', success: false }
  }

  revalidateListPaths(listId)
  return { error: null, success: true }
}

export async function updateListSharingAction(
  listId: string,
  input: {
    isPublic?: boolean
    slug?: string | null
  }
): Promise<UpdateListSharingResult> {
  const user = await getCurrentUser()

  if (!user) {
    return { error: 'You must be signed in to change list sharing.', list: null, success: false }
  }

  if (!isValidId(listId)) {
    return { error: 'Invalid list id.', list: null, success: false }
  }

  const normalized = normalizeListSharingInput(input)

  if (normalized.error || !normalized.data) {
    return {
      error: normalized.error ?? 'Invalid list sharing settings.',
      list: null,
      success: false,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const existingList = await supabase
    .from('lists')
    .select('id, slug')
    .eq('id', listId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingList.error) {
    return {
      error: isMissingListSchemaError(existingList.error)
        ? getSchemaSetupMessage()
        : isMissingListSharingSchemaError(existingList.error)
          ? getListSharingSetupMessage()
          : 'Could not load this list right now.',
      list: null,
      success: false,
    }
  }

  if (!existingList.data) {
    return { error: 'List was not found in your account.', list: null, success: false }
  }

  const oldSlug = typeof existingList.data.slug === 'string' ? existingList.data.slug : null

  if (normalized.data.slug) {
    const duplicateSlug = await supabase
      .from('lists')
      .select('id')
      .eq('user_id', user.id)
      .eq('slug', normalized.data.slug)
      .maybeSingle()

    if (duplicateSlug.error) {
      return {
        error: isMissingListSharingSchemaError(duplicateSlug.error)
          ? getListSharingSetupMessage()
          : 'Could not check list slug availability.',
        list: null,
        success: false,
      }
    }

    if (duplicateSlug.data && duplicateSlug.data.id !== listId) {
      return {
        error: 'That list slug is already used by one of your lists.',
        list: null,
        success: false,
      }
    }
  }

  const updateResult = await supabase
    .from('lists')
    .update({
      is_public: normalized.data.isPublic,
      slug: normalized.data.slug,
    })
    .eq('id', listId)
    .eq('user_id', user.id)
    .select('id, is_public, slug')
    .maybeSingle()

  if (updateResult.error) {
    const duplicateSlug =
      updateResult.error.code === '23505' ||
      updateResult.error.message?.toLowerCase().includes('duplicate') === true

    return {
      error: duplicateSlug
        ? 'That list slug is already used by one of your lists.'
        : isMissingListSharingSchemaError(updateResult.error)
          ? getListSharingSetupMessage()
          : 'Could not save list sharing settings.',
      list: null,
      success: false,
    }
  }

  if (!updateResult.data) {
    return { error: 'List was not found in your account.', list: null, success: false }
  }

  const profileUsername = await getCurrentProfileUsername(supabase, user.id)
  const nextSlug = typeof updateResult.data.slug === 'string' ? updateResult.data.slug : null

  revalidateListPaths(listId)

  if (profileUsername) {
    revalidatePath(`/u/${profileUsername}`)

    if (oldSlug) {
      revalidatePath(`/u/${profileUsername}/lists/${oldSlug}`)
    }

    if (nextSlug) {
      revalidatePath(`/u/${profileUsername}/lists/${nextSlug}`)
    }
  }

  return {
    error: null,
    list: {
      id: updateResult.data.id,
      isPublic: Boolean(updateResult.data.is_public),
      slug: nextSlug,
    },
    success: true,
  }
}

export async function deleteListAction(listId: string): Promise<DeleteListResult> {
  const user = await getCurrentUser()

  if (!user) {
    return { deleted: false, error: 'You must be signed in to delete lists.', success: false }
  }

  if (!isValidId(listId)) {
    return { deleted: false, error: 'Invalid list id.', success: false }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const result = await supabase
    .from('lists')
    .delete()
    .eq('id', listId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (result.error) {
    return {
      deleted: false,
      error: isMissingListSchemaError(result.error)
        ? getSchemaSetupMessage()
        : 'Could not delete this list right now.',
      success: false,
    }
  }

  if (!result.data) {
    return { deleted: false, error: 'List was not found in your account.', success: false }
  }

  revalidateListPaths(listId)
  return { deleted: true, error: null, success: true }
}

export async function addItemsToListAction(
  listId: string,
  itemIds: string[]
): Promise<AddItemsResult> {
  const user = await getCurrentUser()

  if (!user) {
    return { added: 0, error: 'You must be signed in to add items to lists.', skipped: 0, success: false }
  }

  if (!isValidId(listId)) {
    return { added: 0, error: 'Invalid list id.', skipped: 0, success: false }
  }

  const normalizedIds = normalizeIds(itemIds)

  if (normalizedIds.error) {
    return { added: 0, error: normalizedIds.error, skipped: 0, success: false }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const listResult = await supabase
    .from('lists')
    .select('id')
    .eq('id', listId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (listResult.error) {
    return {
      added: 0,
      error: isMissingListSchemaError(listResult.error)
        ? getSchemaSetupMessage()
        : 'Could not open this list right now.',
      skipped: normalizedIds.ids.length,
      success: false,
    }
  }

  if (!listResult.data) {
    return {
      added: 0,
      error: 'List was not found in your account.',
      skipped: normalizedIds.ids.length,
      success: false,
    }
  }

  const ownedItemsResult = await supabase
    .from('items')
    .select('id')
    .eq('user_id', user.id)
    .in('id', normalizedIds.ids)

  if (ownedItemsResult.error) {
    return {
      added: 0,
      error: 'Could not verify selected vault items.',
      skipped: normalizedIds.ids.length,
      success: false,
    }
  }

  const ownedIds = (ownedItemsResult.data ?? [])
    .map((item) => item.id)
    .filter((id): id is string => typeof id === 'string')

  if (ownedIds.length === 0) {
    return {
      added: 0,
      error: 'No selected items belong to your account.',
      skipped: normalizedIds.ids.length,
      success: false,
    }
  }

  const existingResult = await supabase
    .from('list_items')
    .select('item_id')
    .eq('list_id', listId)
    .eq('user_id', user.id)
    .in('item_id', ownedIds)

  if (existingResult.error) {
    return {
      added: 0,
      error: isMissingListSchemaError(existingResult.error)
        ? getSchemaSetupMessage()
        : 'Could not check existing list items right now.',
      skipped: normalizedIds.ids.length,
      success: false,
    }
  }

  const existingIds = new Set(
    (existingResult.data ?? [])
      .map((item) => item.item_id)
      .filter((id): id is string => typeof id === 'string')
  )
  const rows = ownedIds
    .filter((itemId) => !existingIds.has(itemId))
    .map((itemId) => ({
      item_id: itemId,
      list_id: listId,
      user_id: user.id,
    }))

  if (rows.length === 0) {
    return {
      added: 0,
      error: null,
      skipped: normalizedIds.ids.length,
      success: true,
    }
  }

  const insertResult = await supabase.from('list_items').insert(rows).select('id')

  if (insertResult.error) {
    return {
      added: 0,
      error: isMissingListSchemaError(insertResult.error)
        ? getSchemaSetupMessage()
        : 'Could not add selected items to this list.',
      skipped: normalizedIds.ids.length,
      success: false,
    }
  }

  const added = insertResult.data?.length ?? 0
  revalidateListPaths(listId)

  return {
    added,
    error: null,
    skipped: normalizedIds.ids.length - added,
    success: true,
  }
}

export async function addItemToListAction(
  listId: string,
  itemId: string
): Promise<AddItemsResult> {
  return addItemsToListAction(listId, [itemId])
}

export async function addItemToListsAction(
  itemId: string,
  listIds: string[]
): Promise<AddItemToListsResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      added: 0,
      error: 'You must be signed in to add items to lists.',
      failed: 0,
      skipped: 0,
      success: false,
    }
  }

  if (!isValidId(itemId)) {
    return {
      added: 0,
      error: 'Invalid vault item.',
      failed: 0,
      skipped: 0,
      success: false,
    }
  }

  const normalizedListIds = normalizeIds(listIds, 100)

  if (normalizedListIds.error) {
    return {
      added: 0,
      error: normalizedListIds.error,
      failed: 0,
      skipped: 0,
      success: false,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const itemResult = await supabase
    .from('items')
    .select('id')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (itemResult.error) {
    return {
      added: 0,
      error: 'Could not verify this vault item.',
      failed: normalizedListIds.ids.length,
      skipped: 0,
      success: false,
    }
  }

  if (!itemResult.data) {
    return {
      added: 0,
      error: 'This item was not found in your vault.',
      failed: 0,
      skipped: normalizedListIds.ids.length,
      success: false,
    }
  }

  const listsResult = await supabase
    .from('lists')
    .select('id')
    .eq('user_id', user.id)
    .in('id', normalizedListIds.ids)

  if (listsResult.error) {
    return {
      added: 0,
      error: isMissingListSchemaError(listsResult.error)
        ? getSchemaSetupMessage()
        : 'Could not verify your custom lists.',
      failed: normalizedListIds.ids.length,
      skipped: 0,
      success: false,
    }
  }

  const ownedListIds = (listsResult.data ?? [])
    .map((list) => list.id)
    .filter((id): id is string => typeof id === 'string')
  const ownedListIdSet = new Set(ownedListIds)

  if (ownedListIds.length === 0) {
    return {
      added: 0,
      error: 'No selected lists belong to your account.',
      failed: 0,
      skipped: normalizedListIds.ids.length,
      success: false,
    }
  }

  const existingResult = await supabase
    .from('list_items')
    .select('list_id')
    .eq('item_id', itemId)
    .eq('user_id', user.id)
    .in('list_id', ownedListIds)

  if (existingResult.error) {
    return {
      added: 0,
      error: isMissingListSchemaError(existingResult.error)
        ? getSchemaSetupMessage()
        : 'Could not check existing list memberships.',
      failed: normalizedListIds.ids.length,
      skipped: 0,
      success: false,
    }
  }

  const existingListIds = new Set(
    (existingResult.data ?? [])
      .map((entry) => entry.list_id)
      .filter((id): id is string => typeof id === 'string')
  )
  const rows = ownedListIds
    .filter((listId) => !existingListIds.has(listId))
    .map((listId) => ({
      item_id: itemId,
      list_id: listId,
      user_id: user.id,
    }))

  if (rows.length === 0) {
    for (const listId of ownedListIds) {
      revalidateListPaths(listId)
    }

    return {
      added: 0,
      error: null,
      failed: 0,
      skipped: normalizedListIds.ids.length,
      success: true,
    }
  }

  const insertResult = await supabase.from('list_items').insert(rows).select('list_id')

  if (insertResult.error) {
    return {
      added: 0,
      error: isMissingListSchemaError(insertResult.error)
        ? getSchemaSetupMessage()
        : 'Could not add this item to the selected lists.',
      failed: rows.length,
      skipped: normalizedListIds.ids.length - rows.length,
      success: false,
    }
  }

  const addedListIds = (insertResult.data ?? [])
    .map((entry) => entry.list_id)
    .filter((id): id is string => typeof id === 'string')
  const added = addedListIds.length
  const skipped =
    normalizedListIds.ids.filter((listId) => !ownedListIdSet.has(listId)).length +
    ownedListIds.length -
      added

  revalidateListPaths()
  for (const listId of [...new Set([...ownedListIds, ...addedListIds])]) {
    revalidateListPaths(listId)
  }

  return {
    added,
    error: null,
    failed: 0,
    skipped,
    success: true,
  }
}

export async function removeItemFromListAction(
  listId: string,
  itemId: string
): Promise<ListActionResult> {
  const user = await getCurrentUser()

  if (!user) {
    return { error: 'You must be signed in to remove items from lists.', success: false }
  }

  if (!isValidId(listId) || !isValidId(itemId)) {
    return { error: 'Invalid list item request.', success: false }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const result = await supabase
    .from('list_items')
    .delete()
    .eq('list_id', listId)
    .eq('item_id', itemId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (result.error) {
    return {
      error: isMissingListSchemaError(result.error)
        ? getSchemaSetupMessage()
        : 'Could not remove this item from the list right now.',
      success: false,
    }
  }

  if (!result.data) {
    return { error: 'This item is not in the list anymore.', success: false }
  }

  revalidateListPaths(listId)
  return { error: null, success: true }
}
