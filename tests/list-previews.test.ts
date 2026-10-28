import { describe, expect, it } from 'vitest'
import { getListCoverPreviews } from '../lib/list-cover-previews'

describe('private list cover previews', () => {
  it('keeps at most four distinct owned covers without mutating memberships', () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({ list_id: 'list', items: { image_url: `https://example.com/${index}.png`, user_id: 'owner' } }))
    const before = structuredClone(rows)
    expect(getListCoverPreviews([rows[0], ...rows], 'owner').get('list')).toHaveLength(4)
    expect(rows).toEqual(before)
  })
  it('ignores foreign/missing items, malformed URLs and unavailable covers', () => {
    const result = getListCoverPreviews([
      { list_id: 'list', items: { image_url: 'https://example.com/private.png', user_id: 'someone-else' } },
      { list_id: 'list', items: null },
      { list_id: 'list', items: { image_url: 'javascript:bad', user_id: 'owner' } },
      { list_id: 'list', items: [{ image_url: '/cover.png', user_id: 'owner' }] },
    ], 'owner')
    expect(result.get('list')).toEqual(['/cover.png'])
  })
})
