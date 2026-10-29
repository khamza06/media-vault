import { render } from './render-with-locale'
// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ importMyAnimeListItems: vi.fn() }))
vi.mock('../app/actions/import', () => ({ ...mocks, deleteMyAnimeListImports: vi.fn(), enrichMissingAnimeMangaCovers: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import MalXmlImporter from '../components/import/MalXmlImporter'
afterEach(cleanup)
describe('MAL XML notes preservation', () => {
  it.each(['anime', 'manga'])('passes exact %s comments through selected import', async (type) => {
    const notes = '  **Private**\nKeep whitespace  '
    mocks.importMyAnimeListItems.mockResolvedValue({ imported: 1, skipped: 0, failed: 0, error: null, usedExternalIdColumns: true })
    render(<MalXmlImporter />)
    const xml = `<myanimelist><${type}><series_title>Fixture</series_title><${type === 'anime' ? 'series_animedb_id' : 'series_mangadb_id'}>20</${type === 'anime' ? 'series_animedb_id' : 'series_mangadb_id'}><my_comments><![CDATA[${notes}]]></my_comments></${type}></myanimelist>`
    const file = { name: 'synthetic.xml', text: async () => xml }
    fireEvent.change(screen.getByLabelText('MyAnimeList XML export'), { target: { files: { 0: file, length: 1, item: () => file } } })
    const button = await screen.findByRole('button', { name: 'Import selected items' })
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(button)
    await waitFor(() => expect(mocks.importMyAnimeListItems).toHaveBeenLastCalledWith([expect.objectContaining({ notes, type })]))
  })
})
