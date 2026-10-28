import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), requireCurrentUser: vi.fn(), createItem: vi.fn(), revalidatePath: vi.fn(), eq: vi.fn(), in: vi.fn(), maybeSingle: vi.fn() }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/data/items', () => ({ createItem: mocks.createItem, deleteItem: vi.fn(), incrementItemProgress: vi.fn(), updateItem: vi.fn(), updateItemFavorite: vi.fn() }))
vi.mock('../lib/data/storage', () => ({ deleteOwnedCoverByPublicUrl: vi.fn() }))
vi.mock('next/cache', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from: () => ({ select: () => query }) }) }))
import { createItemAction } from '../app/actions/items'
import type { MediaItemInput } from '../lib/media'

const query = { eq: mocks.eq, in: mocks.in, limit: () => query, maybeSingle: mocks.maybeSingle }
const form: MediaItemInput = { title: 'Fixture', type: 'Anime', status: 'Planning', progress: '', totalProgress: '', rating: '', externalRatingValue: '', externalRatingLabel: '', favorite: false, genres: '', imageUrl: '', startedAt: '', completedAt: '', notes: '  **Notes**\n' }
beforeEach(() => {
  mocks.getCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'fixture-not-a-token' })
  mocks.requireCurrentUser.mockResolvedValue({ id: 'owner' })
  mocks.eq.mockReturnValue(query)
  mocks.in.mockReturnValue(query)
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
  mocks.createItem.mockResolvedValue({ data: { id: 'new-item' }, error: null })
})

describe('catalog item creation', () => {
  it('reports committed creation as saved even if view invalidation fails', async () => {
    mocks.revalidatePath.mockImplementationOnce(() => { throw new Error('cache unavailable') })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await createItemAction(form)).toMatchObject({ success: true, itemId: 'new-item' })
    expect(mocks.createItem).toHaveBeenCalledTimes(1)
  })
  it('passes validated identity and exact notes into the owner insert', async () => {
    expect(await createItemAction(form, 'anilist:20')).toMatchObject({ success: true, itemId: 'new-item' })
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(mocks.createItem).toHaveBeenCalledWith(expect.objectContaining({ notes: form.notes, progress: 0 }), { source: 'anilist', id: '20' })
  })
  it('keeps manual creation untagged and Jikan separate from MAL XML cleanup', async () => {
    await createItemAction(form)
    expect(mocks.createItem).toHaveBeenCalledWith(expect.anything(), null)
    await createItemAction(form, 'jikan:anime:1')
    expect(mocks.createItem).toHaveBeenLastCalledWith(expect.anything(), { source: 'jikan', id: '1' })
  })
  it('returns the existing owned item without inserting or overwriting', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'existing' }, error: null })
    expect(await createItemAction(form, 'anilist:20')).toMatchObject({ alreadyExists: true, itemId: 'existing' })
    expect(mocks.createItem).not.toHaveBeenCalled()
  })
  it('recognizes the same MAL identity from Jikan without overwriting an XML-imported item', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'existing-mal' }, error: null })
    expect(await createItemAction({ ...form, progress: '10', notes: 'A new draft must not replace stored notes' }, 'jikan:anime:20')).toMatchObject({ alreadyExists: true, itemId: 'existing-mal' })
    expect(mocks.in).toHaveBeenCalledWith('external_source', ['jikan', 'myanimelist'])
    expect(mocks.createItem).not.toHaveBeenCalled()
  })
  it('does not insert when duplicate lookup fails', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Private database detail' } })
    expect(await createItemAction(form, 'anilist:20')).toMatchObject({ success: false })
    expect(mocks.createItem).not.toHaveBeenCalled()
  })
  it('rejects guests and type/source mismatches', async () => {
    expect(await createItemAction(form, 'tmdb:movie:1')).toMatchObject({ success: false })
    mocks.getCurrentUser.mockResolvedValue(null)
    expect(await createItemAction(form, 'anilist:20')).toMatchObject({ success: false })
    expect(mocks.createItem).not.toHaveBeenCalled()
  })
})
