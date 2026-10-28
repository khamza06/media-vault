import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { getDiscoverRecommendations, getUpcomingEpisodes } from '../lib/home-signals'
import { toMediaItem } from '../lib/media'
const item = toMediaItem({ id: 'synthetic', title: 'Fixture', type: 'Anime', status: 'Watching', rating: 9 })
afterEach(() => vi.unstubAllGlobals())
describe('optional dashboard providers', () => {
  it.each(['network', 'json'])('keeps the vault usable on optional %s failure and bounds the wait', async (failure) => {
    const fetcher = vi.fn(async (_url: unknown, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal)
      if (failure === 'network') throw new Error('provider offline')
      return new Response('not json')
    })
    vi.stubGlobal('fetch', fetcher)
    await expect(getDiscoverRecommendations([item])).resolves.toEqual([])
    await expect(getUpcomingEpisodes([item], 'en')).resolves.toEqual([])
  })
  it('keeps successful optional results when another recommendation request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(Response.json({ data: { Media: { recommendations: { nodes: [{ mediaRecommendation: { id: 20, type: 'ANIME', title: { english: 'Other work' } } }] } } } })))
    expect(await getDiscoverRecommendations([item, { ...item, id: 'two', title: 'Second' }])).toHaveLength(1)
  })
})
