// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ShelfItemCard from '../components/ShelfItemCard'
import { toMediaItem } from '../lib/media'
import { getMediaCardGridClassName, mediaCardGridClassName } from '../lib/media-card-grid'
import { t, type MessageKey } from '../lib/i18n'
vi.mock('../components/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: MessageKey, vars?: Record<string, string | number>) => t('en', key, vars) }) }))

vi.mock('../components/lists/AddToListButton', () => ({ default: () => <button type="button">List</button> }))
const item = toMediaItem({ id: 'fixture', title: 'A long manga title', status: 'Reading', type: 'Manga', progress: 12, total_progress: 24 })
afterEach(cleanup)

describe('shared card layouts', () => {
  it('shows confirmation/pending/retry states with a bounded completed button', () => {
    const onIncrement = vi.fn()
    const view = render(<ShelfItemCard item={item} onIncrement={onIncrement} progressBusy />)
    const button = screen.getByRole('button', { name: `Increase progress for ${item.title}` }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    view.rerender(<ShelfItemCard item={item} onIncrement={onIncrement} progressBusy={false} progressError />)
    expect(screen.getByRole('alert').textContent).toContain('same update will not be counted twice')
    view.rerender(<ShelfItemCard item={{ ...item, progress: 24 }} onIncrement={onIncrement} progressBusy={false} />)
    expect((screen.getByRole('button', { name: `Increase progress for ${item.title}` }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('At total')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: `Increase progress for ${item.title}` }))
    expect(onIncrement).not.toHaveBeenCalled()
  })
  it.each(['grid', 'rail', 'row'] as const)('keeps progress, list and return navigation in %s mode', (layout) => {
    const onIncrement = vi.fn()
    render(<ShelfItemCard item={item} layout={layout} onIncrement={onIncrement} progressBusy={false} returnTo="/shelves/manga?status=Reading" />)
    fireEvent.click(screen.getByRole('button', { name: `Increase progress for ${item.title}` }))
    expect(onIncrement).toHaveBeenCalledExactlyOnceWith(item)
    expect(screen.getByRole('button', { name: 'List' })).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toContain('returnTo=%2Fshelves%2Fmanga%3Fstatus%3DReading')
    expect(screen.getByText(/ch\. 12/)).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('12')
  })
  it('keeps row selection separate from progress and list actions', () => {
    const onToggleSelection = vi.fn()
    render(<ShelfItemCard item={item} layout="row" isSelectionMode isSelected onToggleSelection={onToggleSelection} onIncrement={vi.fn()} progressBusy={false} />)
    fireEvent.click(screen.getByRole('button', { name: `Deselect ${item.title}` }))
    expect(onToggleSelection).toHaveBeenCalledExactlyOnceWith(item)
    expect(screen.queryByRole('button', { name: 'List' })).toBeNull()
    expect(screen.queryByRole('button', { name: `Increase progress for ${item.title}` })).toBeNull()
  })
  it('does not invent percentages for unknown totals; clamps display without changing saved progress', () => {
    const input = { ...item, totalProgress: null }
    const view = render(<ShelfItemCard item={input} onIncrement={vi.fn()} progressBusy={false} />)
    expect(screen.queryByRole('progressbar')).toBeNull()
    const over = { ...item, progress: 40 }
    view.rerender(<ShelfItemCard item={over} onIncrement={vi.fn()} progressBusy={false} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('24')
    expect(over.progress).toBe(40)
  })
  it('keeps the default public grid unchanged and uses normal gaps for compact mode', () => {
    expect(getMediaCardGridClassName('comfortable')).toBe(mediaCardGridClassName)
    expect(getMediaCardGridClassName('compact')).toContain('xl:grid-cols-7')
    expect(getMediaCardGridClassName('table')).toContain('grid-cols-1')
    expect(getMediaCardGridClassName('compact')).not.toContain('justify-between')
  })
})
