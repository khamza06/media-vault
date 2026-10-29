// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toMediaItem } from '../lib/media'
import { useProgressUpdates } from '../components/useProgressUpdates'
import { t, type MessageKey } from '../lib/i18n'
const mocks = vi.hoisted(() => ({ showToast: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('../components/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: MessageKey, vars?: Record<string, string | number>) => t('en', key, vars) }) }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => mocks }))
const item = toMediaItem({ id: 'fixture', title: 'Fixture', type: 'Manga', status: 'Reading', progress: 4, notes: 'PRIVATE exact **notes**', rating: 9 })
const snapshot = { id: item.id, progress: 5, total_progress: null, status: 'Reading', last_progress_at: '2026-10-29T08:00:00.123456Z', outcome: 'updated' }
const mount = () => renderHook(() => { const [items, setItems] = useState([item]); return { items, ...useProgressUpdates(setItems) } })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('confirmed quick progress', () => {
  it('synchronously deduplicates repeated clicks, waits for confirmation and preserves personal fields', async () => {
    let resolve!: (value: Response) => void
    const fetcher = vi.fn(() => new Promise<Response>(done => { resolve = done }))
    vi.stubGlobal('fetch', fetcher)
    const { result } = mount()
    act(() => { void result.current.handleIncrement(item); void result.current.handleIncrement(item) })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result.current.items[0].progress).toBe(4)
    expect(result.current.busyIds[item.id]).toBe(true)
    await act(async () => { resolve(Response.json({ data: snapshot })) })
    expect(result.current.items[0]).toMatchObject({ progress: 5, notes: item.notes, rating: 9, lastProgressAt: snapshot.last_progress_at })
    expect(result.current.busyIds[item.id]).not.toBe(true)
  })
  it('reuses the original expectation after a lost response and reconciles a committed update without incrementing twice', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('Reply lost')).mockResolvedValueOnce(Response.json({ data: { ...snapshot, outcome: 'conflict' } }, { status: 409 }))
    vi.stubGlobal('fetch', fetcher)
    const { result } = mount()
    await act(async () => { await result.current.handleIncrement(item) })
    expect(result.current.errorIds[item.id]).toBe(true)
    expect(result.current.items[0].progress).toBe(4)
    await act(async () => { await result.current.handleIncrement(item) })
    expect(fetcher.mock.calls.map(call => JSON.parse(call[1].body))).toEqual([{ progress: 4, lastProgressAt: null }, { progress: 4, lastProgressAt: null }])
    expect(result.current.items[0].progress).toBe(5)
    expect(result.current.errorIds[item.id]).toBe(false)
  })
  it('uses the new server version for a subsequent deliberate step and refreshes after another device gains focus', async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ data: snapshot }))
    vi.stubGlobal('fetch', fetcher)
    const { result } = mount()
    await act(async () => { await result.current.handleIncrement(item) })
    await act(async () => { await result.current.handleIncrement(result.current.items[0]) })
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ progress: 5, lastProgressAt: snapshot.last_progress_at })
    act(() => window.dispatchEvent(new Event('focus')))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
  })
})
