// @vitest-environment jsdom

import type { ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ContinueShelf from '../components/ContinueShelf'
import type ShelfItemCard from '../components/ShelfItemCard'
import { toMediaItem } from '../lib/media'
import { t, type MessageKey } from '../lib/i18n'
vi.mock('../components/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: (key: MessageKey) => t('en', key) }) }))

const { card } = vi.hoisted(() => ({ card: vi.fn() }))
vi.mock('../components/ShelfItemCard', () => ({ default: card }))

const saved = toMediaItem({
  id: 'owned-item', title: 'Reading fixture', type: 'Manga', status: 'Reading', progress: 12,
})

function props(): ComponentProps<typeof ContinueShelf> {
  return {
    items: [saved], listOptions: [], busyIds: {}, isSelectionMode: false,
    onIncrement: vi.fn(), accentHandler: vi.fn(), returnTo: '/?status=Reading',
  }
}

beforeEach(() => {
  card.mockImplementation(({ item, onIncrement, progressBusy }: ComponentProps<typeof ShelfItemCard>) => (
    <button type="button" onClick={() => onIncrement(item)} disabled={progressBusy}>
      {item.title}: {item.progress}
    </button>
  ))
})
afterEach(cleanup)

describe('Continue shelf UI', () => {
  it('reuses the owner card and existing progress/list/return navigation props', () => {
    const input = props()
    render(<ContinueShelf {...input} />)
    expect(screen.getByRole('region', { name: 'Continue' })).toBeTruthy()
    expect(card.mock.calls[0][0]).toMatchObject({
      item: saved, listOptions: input.listOptions, returnTo: '/?status=Reading',
      onIncrement: input.onIncrement, layout: 'rail', progressBusy: false,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reading fixture: 12' }))
    expect(input.onIncrement).toHaveBeenCalledExactlyOnceWith(saved)
  })

  it('hides during bulk selection and when no filtered in-progress items remain', () => {
    const input = props()
    const view = render(<ContinueShelf {...input} isSelectionMode />)
    expect(screen.queryByRole('region')).toBeNull()
    view.rerender(<ContinueShelf {...input} items={[]} />)
    expect(screen.queryByRole('region')).toBeNull()
    view.rerender(<ContinueShelf {...input} items={[{ ...saved, status: 'Completed' }]} />)
    expect(screen.queryByRole('region')).toBeNull()
    expect(card).not.toHaveBeenCalled()
  })

  it('reflects parent progress updates and disables the same busy item', () => {
    const input = props()
    const view = render(<ContinueShelf {...input} />)
    view.rerender(<ContinueShelf {...input} items={[{ ...saved, progress: 13 }]}
      busyIds={{ [saved.id]: true }} />)
    const button = screen.getByRole('button', { name: 'Reading fixture: 13' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(button)
    expect(input.onIncrement).not.toHaveBeenCalled()
  })
})
