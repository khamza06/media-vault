// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import RelatedTitles from '../components/catalog/RelatedTitles'
import type { RelatedTitle } from '../lib/related-titles'
const titles: RelatedTitle[] = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, title: `Sequel ${index + 1}`, type: 'Anime', relation: 'Sequel', coverUrl: null, url: `https://anilist.co/anime/${index + 1}` }))
afterEach(cleanup)
describe('read-only related title cards', () => {
  it('shows six initially, expands and preserves safe links without private mutation controls', () => {
    render(<RelatedTitles titles={titles} />)
    expect(screen.getAllByRole('article')).toHaveLength(6)
    expect(screen.getAllByRole('link', { name: 'Search in Discover' })[0].getAttribute('href')).toBe('/discover?q=Sequel+1&type=anime')
    expect(screen.getByRole('link', { name: 'Sequel 1' }).getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.queryByRole('button', { name: /Add|Delete|Remove/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show all 8 related titles' }))
    expect(screen.getAllByRole('article')).toHaveLength(8)
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer related titles' }))
    expect(screen.getAllByRole('article')).toHaveLength(6)
  })
  it('handles no relations without a blank grid', () => {
    render(<RelatedTitles titles={[]} />)
    expect(screen.getByText('No linked titles were returned for this title.')).toBeTruthy()
    expect(screen.queryByRole('article')).toBeNull()
  })
})
