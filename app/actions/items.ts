'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentUser, requireCurrentUser } from '../../lib/auth/dal'
import {
  createItem,
  deleteItem,
  incrementItemProgress,
  updateItem,
  updateItemFavorite,
} from '../../lib/data/items'
import { deleteOwnedCoverByPublicUrl } from '../../lib/data/storage'
import {
  getAllowedStatuses,
  isMovieType,
  normalizeMediaItemInput,
  usesPageProgress,
  type MediaItemInput,
} from '../../lib/media'
import { shelfDefinitions } from '../../lib/shelves'
import { createSupabaseServerClient } from '../../lib/supabase/server'

type ActionResult = {
  error: string | null
  success: boolean
}

type BulkDeleteActionResult = ActionResult & {
  deleted: number
  failed: number
}

const MAX_BULK_DELETE_ITEMS = 500

type QuickUpdateItemInput = {
  notes?: string
  progress?: number | null
  rating?: number | null
  status?: string
}

type QuickUpdatePayload = {
  last_progress_at?: string | null
  notes?: string | null
  progress?: number
  rating?: number | null
  status?: string
}

async function revalidateVaultPaths(itemId?: string) {
  const user = await requireCurrentUser()

  revalidatePath('/')
  revalidatePath('/backup')
  revalidatePath('/import')
  revalidatePath('/library')
  revalidatePath('/lists')
  revalidatePath('/stats')
  revalidatePath('/summary')
  revalidatePath(`/share/${user.id}`)

  for (const shelf of shelfDefinitions) {
    revalidatePath(`/shelves/${shelf.slug}`)
  }

  if (itemId) {
    revalidatePath(`/items/${itemId}`)
    revalidatePath(`/items/${itemId}/edit`)
  }
}

export async function createItemAction(input: MediaItemInput): Promise<ActionResult> {
  const normalized = normalizeMediaItemInput(input)
  if (normalized.error || !normalized.data) {
    return { error: normalized.error ?? 'Invalid input.', success: false }
  }

  const result = await createItem(normalized.data)
  if (result.error) {
    return { error: result.error.message, success: false }
  }

  await revalidateVaultPaths()
  return { error: null, success: true }
}

export async function updateItemAction(
  id: string,
  input: MediaItemInput,
  previousImageUrl?: string | null
): Promise<ActionResult> {
  const normalized = normalizeMediaItemInput(input)
  if (normalized.error || !normalized.data) {
    return { error: normalized.error ?? 'Invalid input.', success: false }
  }

  const result = await updateItem(id, normalized.data)
  if (result.error) {
    return { error: result.error.message, success: false }
  }

  if (!result.data) {
    return { error: 'Item was not updated. Check that it belongs to your account.', success: false }
  }

  const nextImageUrl = normalized.data.image_url

  if (previousImageUrl && previousImageUrl !== nextImageUrl) {
    await deleteOwnedCoverByPublicUrl(previousImageUrl)
  }

  await revalidateVaultPaths(id)
  return { error: null, success: true }
}

export async function deleteItemAction(
  id: string,
  imageUrl?: string | null
): Promise<ActionResult> {
  const result = await deleteItem(id)
  if (result.error) {
    return { error: result.error.message, success: false }
  }

  if (!result.data) {
    return { error: 'Item was not deleted. Check that it belongs to your account.', success: false }
  }

  await deleteOwnedCoverByPublicUrl(imageUrl)

  await revalidateVaultPaths(id)
  return { error: null, success: true }
}

export async function deleteItemsBulkAction(itemIds: string[]): Promise<BulkDeleteActionResult> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      deleted: 0,
      error: 'You must be signed in to delete items.',
      failed: Array.isArray(itemIds) ? itemIds.length : 0,
      success: false,
    }
  }

  if (!Array.isArray(itemIds)) {
    return { deleted: 0, error: 'Invalid bulk delete request.', failed: 0, success: false }
  }

  const ids = [...new Set(itemIds.filter((id) => typeof id === 'string' && id.trim().length > 0))]

  if (ids.length === 0) {
    return { deleted: 0, error: 'Select at least one item to delete.', failed: 0, success: false }
  }

  if (ids.length > MAX_BULK_DELETE_ITEMS) {
    return {
      deleted: 0,
      error: `You can delete up to ${MAX_BULK_DELETE_ITEMS} items at once.`,
      failed: ids.length,
      success: false,
    }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const ownedItems = await supabase
    .from('items')
    .select('id, image_url')
    .eq('user_id', user.id)
    .in('id', ids)

  if (ownedItems.error) {
    return {
      deleted: 0,
      error: ownedItems.error.message,
      failed: ids.length,
      success: false,
    }
  }

  const ownedRows = ownedItems.data ?? []
  const ownedIds = ownedRows.map((item) => item.id).filter((id): id is string => typeof id === 'string')

  if (ownedIds.length === 0) {
    return {
      deleted: 0,
      error: 'No selected items belong to your account.',
      failed: ids.length,
      success: false,
    }
  }

  const deleteResult = await supabase
    .from('items')
    .delete()
    .eq('user_id', user.id)
    .in('id', ownedIds)
    .select('id')

  if (deleteResult.error) {
    return {
      deleted: 0,
      error: deleteResult.error.message,
      failed: ids.length,
      success: false,
    }
  }

  const deletedIds = new Set((deleteResult.data ?? []).map((item) => item.id))
  const deleted = deletedIds.size
  const coverUrls = ownedRows
    .filter((item) => deletedIds.has(item.id))
    .map((item) => item.image_url)
    .filter((url): url is string => typeof url === 'string' && url.length > 0)

  for (const url of coverUrls) {
    try {
      await deleteOwnedCoverByPublicUrl(url)
    } catch {
      // Storage cleanup should never roll back the database delete.
    }
  }

  await revalidateVaultPaths()

  return {
    deleted,
    error: deleted > 0 ? null : 'No items were deleted.',
    failed: ids.length - deleted,
    success: deleted > 0,
  }
}

export async function toggleFavoriteAction(
  id: string,
  favorite: boolean
): Promise<ActionResult> {
  const result = await updateItemFavorite(id, favorite)
  if (result.error) {
    return { error: result.error.message, success: false }
  }

  if (!result.data) {
    return {
      error: 'Favorite status was not updated. Check that the item belongs to your account.',
      success: false,
    }
  }

  await revalidateVaultPaths(id)
  return { error: null, success: true }
}

export async function incrementProgressAction(id: string): Promise<ActionResult> {
  const result = await incrementItemProgress(id)

  if (result.error) {
    return { error: result.error.message, success: false }
  }

  if (!result.data) {
    return {
      error: 'Progress was not updated. Check that the item belongs to your account.',
      success: false,
    }
  }

  await revalidateVaultPaths(id)
  return { error: null, success: true }
}

export async function quickUpdateItemAction(
  id: string,
  input: QuickUpdateItemInput
): Promise<ActionResult> {
  const itemId = typeof id === 'string' ? id.trim() : ''

  if (!itemId) {
    return { error: 'Invalid item id.', success: false }
  }

  const user = await getCurrentUser()

  if (!user) {
    return { error: 'You must be signed in to update items.', success: false }
  }

  const supabase = createSupabaseServerClient(user.accessToken)
  const currentResult = await supabase
    .from('items')
    .select('id, type, status, progress, total_progress')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (currentResult.error) {
    return { error: currentResult.error.message, success: false }
  }

  const currentItem = currentResult.data

  if (!currentItem) {
    return {
      error: 'Item was not updated. Check that it belongs to your account.',
      success: false,
    }
  }

  const payload: QuickUpdatePayload = {}

  if (input.status !== undefined) {
    const status = input.status.trim()
    const allowedStatuses = getAllowedStatuses(currentItem.type ?? '')

    if (!allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
      return { error: `Status "${status}" is not allowed for ${currentItem.type}.`, success: false }
    }

    payload.status = status
  }

  if (input.rating !== undefined) {
    if (input.rating === null) {
      payload.rating = null
    } else if (Number.isInteger(input.rating) && input.rating >= 1 && input.rating <= 10) {
      payload.rating = input.rating
    } else {
      return { error: 'Rating must be a whole number from 1 to 10.', success: false }
    }
  }

  if (input.progress !== undefined) {
    const progress = input.progress === null ? 0 : input.progress

    if (!Number.isInteger(progress) || progress < 0) {
      return { error: 'Progress must be a whole number of 0 or more.', success: false }
    }

    const totalProgress =
      isMovieType(currentItem.type ?? '') && !currentItem.total_progress
        ? 1
        : currentItem.total_progress ?? null
    const nextProgress =
      typeof totalProgress === 'number' && totalProgress > 0
        ? Math.min(progress, totalProgress)
        : progress

    payload.progress = nextProgress
    payload.last_progress_at = nextProgress > 0 ? new Date().toISOString() : null

    if (!payload.status) {
      if (isMovieType(currentItem.type ?? '') && nextProgress >= 1) {
        payload.status = 'Completed'
      } else if (nextProgress > 0 && currentItem.status === 'Planning') {
        payload.status = usesPageProgress(currentItem.type ?? '') ? 'Reading' : 'Watching'
      }
    }
  }

  if (input.notes !== undefined) {
    payload.notes = input.notes.trim().length > 0 ? input.notes : null
  }

  if (Object.keys(payload).length === 0) {
    return { error: null, success: true }
  }

  let updateResult = await supabase
    .from('items')
    .update(payload)
    .eq('id', itemId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (updateResult.error && 'last_progress_at' in payload) {
    const compatibilityPayload = { ...payload }
    delete compatibilityPayload.last_progress_at

    updateResult = await supabase
      .from('items')
      .update(compatibilityPayload)
      .eq('id', itemId)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle()
  }

  if (updateResult.error) {
    return { error: updateResult.error.message, success: false }
  }

  if (!updateResult.data) {
    return {
      error: 'Item was not updated. Check that it belongs to your account.',
      success: false,
    }
  }

  await revalidateVaultPaths(itemId)
  return { error: null, success: true }
}
