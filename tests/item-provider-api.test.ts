import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), getAniListProviderDetails: vi.fn(), getTmdbProviderDetails: vi.fn() }))
vi.mock('../lib/auth/dal', () => mocks)
vi.mock('../lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ from: mocks.from }) }))
vi.mock('../lib/anilist-import-enrichment', () => mocks)
vi.mock('../lib/catalog-search', () => mocks)
import { GET } from '../app/api/items/[id]/provider/route'
const id = '11111111-1111-4111-8111-111111111111'
const request = new Request(`https://media-vault.app/api/items/${id}/provider`)
beforeEach(() => {
  mocks.getCurrentUser.mockResolvedValue({ id: 'owner', accessToken: 'fixture-not-a-token' })
  const query = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle }
  mocks.from.mockReturnValue(query); mocks.select.mockReturnValue(query); mocks.eq.mockReturnValue(query)
  mocks.maybeSingle.mockResolvedValue({ data: { id, type: 'Anime', external_source: 'anilist', external_id: '20' }, error: null })
  mocks.getAniListProviderDetails.mockResolvedValue({ provider: 'AniList', description: 'Synopsis' })
})
describe('owned item provider endpoint', () => {
  it('requires authentication before reading or calling providers', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    expect((await GET(request, { params: Promise.resolve({ id }) })).status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.getAniListProviderDetails).not.toHaveBeenCalled()
  })
  it('scopes to the current owner and never selects private notes/email', async () => {
    const response = await GET(request, { params: Promise.resolve({ id }) })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'owner')
    expect(mocks.select).toHaveBeenCalledWith('id, type, external_source, external_id')
    expect(mocks.getAniListProviderDetails).toHaveBeenCalledWith(20, 'Anime', false)
  })
  it('does not call the provider for another owner or invalid IDs', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect((await GET(request, { params: Promise.resolve({ id }) })).status).toBe(404)
    expect((await GET(request, { params: Promise.resolve({ id: '../bad' }) })).status).toBe(400)
    expect(mocks.getAniListProviderDetails).not.toHaveBeenCalled()
  })
  it('keeps unsupported identity and provider failures explicit', async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: { type: 'Anime' }, error: null })
    expect((await GET(request, { params: Promise.resolve({ id }) })).status).toBe(422)
    mocks.getAniListProviderDetails.mockResolvedValueOnce(null)
    expect((await GET(request, { params: Promise.resolve({ id }) })).status).toBe(502)
  })
  it('does not return raw database or thrown errors', async () => {
    mocks.maybeSingle.mockRejectedValueOnce(new Error('private database detail'))
    const response = await GET(request, { params: Promise.resolve({ id }) })
    expect(response.status).toBe(502)
    expect(JSON.stringify(await response.json())).not.toContain('private database detail')
  })
})
