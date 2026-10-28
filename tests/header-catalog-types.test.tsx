// @vitest-environment jsdom
import type { ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HeaderCatalogSearch from '../components/HeaderCatalogSearch'
import type AppSelect from '../components/ui/AppSelect'
import { OPEN_ADD_MODAL_EVENT } from '../lib/add-modal-events'

vi.mock('../components/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en' }) }))
vi.mock('../components/ui/AppSelect', () => ({ default: ({ ariaLabel, options, onValueChange, value }: ComponentProps<typeof AppSelect>) => <select aria-label={ariaLabel} value={value} onChange={event => onValueChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> }))
beforeEach(() => vi.useFakeTimers())
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('header catalog types', () => {
  it.each([['manhwa', 'Manhwa'], ['manhua', 'Manhua']])('searches %s, links to matching Discover results and passes its identity to capture', async (type, label) => {
    const candidate = { id: 'anilist:1234', title: 'Fixture work', type: label, provider: 'AniList' }
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ data: [candidate] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<HeaderCatalogSearch />)
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Select type', 'Anime', 'Manga', 'Manhwa', 'Manhua', 'Movie', 'Series', 'Book'])
    fireEvent.change(screen.getByRole('combobox', { name: 'Search media type' }), { target: { value: type } })
    const input = screen.getByPlaceholderText('Search global databases...')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Fixture' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(401) })
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(request).toMatchObject({ query: 'Fixture', type })
    expect(screen.getByRole('link', { name: 'View all results' }).getAttribute('href')).toContain(`type=${type}`)
    const open = vi.fn()
    window.addEventListener(OPEN_ADD_MODAL_EVENT, open)
    try {
      fireEvent.click(screen.getByRole('button', { name: /Fixture work/ }))
      expect((open.mock.calls[0][0] as CustomEvent).detail.candidate).toEqual(candidate)
    } finally { window.removeEventListener(OPEN_ADD_MODAL_EVENT, open) }
  })
})
