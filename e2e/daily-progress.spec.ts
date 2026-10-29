import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { test, expect } from '@playwright/test'
import { authenticate, fixture, prefix } from './helpers'

test('desktop repeated clicks and a lost committed response never double-count progress', async ({ page }) => {
  const client = await authenticate(page.context())
  const title = `${prefix()} daily retry ${randomUUID().slice(0, 5)}`
  const item = await client.from('items').insert({ user_id: fixture().a, title, type: 'Anime', status: 'Watching', progress: 0, total_progress: 3, notes: 'PRIVATE DAILY NOTES', rating: 9 }).select('id').single()
  expect(item.error).toBeNull()
  const id = item.data!.id
  await page.goto(`/?q=${encodeURIComponent(title)}`)
  const buttons = page.getByRole('button', { name: `Increase progress for ${title}`, exact: true })
  let calls = 0
  await page.route(`**/api/items/${id}/progress`, async route => {
    calls++
    const response = await route.fetch()
    expect(response.status()).toBe(200)
    await route.abort('failed') // The database committed; only its acknowledgement is lost.
  })
  await expect(buttons.first()).toBeVisible()
  await buttons.evaluateAll(nodes => { (nodes[0] as HTMLButtonElement).click(); (nodes.at(-1) as HTMLButtonElement).click() })
  await expect(page.getByText(/Not confirmed\. Retry safely/).first()).toBeVisible()
  expect(calls).toBe(1)
  expect((await client.from('items').select('progress,notes,rating').eq('id', id).single()).data).toEqual({ progress: 1, notes: 'PRIVATE DAILY NOTES', rating: 9 })
  expect((await client.from('progress_events').select('id').eq('item_id', id)).data).toHaveLength(1)
  await page.unroute(`**/api/items/${id}/progress`)
  await buttons.first().click()
  await expect(page.getByText(/This item already changed/).first()).toBeVisible()
  expect((await client.from('items').select('progress').eq('id', id).single()).data?.progress).toBe(1)
  expect((await client.from('progress_events').select('id').eq('item_id', id)).data).toHaveLength(1)
  await buttons.first().click()
  await expect.poll(async () => (await client.from('items').select('progress').eq('id', id).single()).data?.progress).toBe(2)
  await expect(buttons.first()).toBeEnabled()
  await buttons.first().click()
  await expect(page.getByRole('region', { name: 'Continue', exact: true })).toHaveCount(0)
  await expect(buttons.first()).toBeDisabled()
  expect((await client.from('progress_events').select('id').eq('item_id', id)).data).toHaveLength(3)
})

test('two real sessions reconcile stale versions; public sharing never exposes private activity', async ({ page, browser }) => {
  const client = await authenticate(page.context())
  const second = await browser.newContext()
  const guest = await browser.newContext()
  const other = await browser.newContext()
  const beforeProfile = await client.from('profiles').select('is_public').eq('id', fixture().a).single()
  try {
    await authenticate(second)
    const otherClient = await authenticate(other, 'b')
    const item = await client.from('items').insert({ user_id: fixture().a, title: `${prefix()} two devices ${randomUUID().slice(0, 5)}`, type: 'Manhua', status: 'Planning', progress: 0, total_progress: 2, notes: 'PRIVATE TWO DEVICES', rating: 8 }).select('id').single()
    expect(item.error).toBeNull()
    const id = item.data!.id
    const path = `/api/items/${id}/progress`
    const results = await Promise.all([page.request.post(path, { data: { progress: 0, lastProgressAt: null } }), second.request.post(path, { data: { progress: 0, lastProgressAt: null } })])
    expect(results.map(row => row.status()).sort()).toEqual([200, 409])
    expect((await client.from('items').select('progress,status,notes,rating').eq('id', id).single()).data).toEqual({ progress: 1, status: 'Reading', notes: 'PRIVATE TWO DEVICES', rating: 8 })
    expect((await client.from('progress_events').select('id').eq('item_id', id)).data).toHaveLength(1)
    expect((await other.request.post(path, { data: { progress: 1, lastProgressAt: null } })).status()).toBe(404)
    expect((await guest.request.post(path, { data: { progress: 0, lastProgressAt: null } })).status()).toBe(401)
    expect((await guest.request.get('/api/progress-activity')).status()).toBe(401)
    expect((await otherClient.from('progress_events').select('id').eq('item_id', id)).data).toEqual([])
    expect((await otherClient.rpc('advance_item_progress', { p_item_id: id, p_expected_progress: 1, p_expected_last_progress_at: null })).data).toBeNull()
    expect((await client.from('progress_events').insert({ user_id: fixture().a, item_id: id, media_type: 'Anime', from_progress: 0, to_progress: 100 })).error).toBeTruthy()
    const anonymous = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    expect((await anonymous.from('progress_events').select('id').eq('item_id', id)).error).toBeTruthy()
    expect((await anonymous.rpc('advance_item_progress', { p_item_id: id, p_expected_progress: 0, p_expected_last_progress_at: null })).error).toBeTruthy()
    expect((await client.from('profiles').update({ is_public: true }).eq('id', fixture().a)).error).toBeNull()
    expect((await anonymous.from('public_items').select('id').eq('id', id)).data).toEqual([{ id }])
    expect((await anonymous.from('public_items').select('notes').eq('id', id)).error).toBeTruthy()
    const list = await client.from('lists').insert({ user_id: fixture().a, name: 'Synthetic daily public list', is_public: true, slug: `daily-${randomUUID()}` }).select('id').single()
    expect(list.error).toBeNull()
    const membership = await client.from('list_items').insert({ user_id: fixture().a, list_id: list.data!.id, item_id: id }).select('id').single()
    expect(membership.error).toBeNull()
    expect((await anonymous.from('list_items').select('id').eq('id', membership.data!.id)).data).toEqual([{ id: membership.data!.id }])
    expect((await anonymous.from('progress_events').select('id').eq('item_id', id)).error).toBeTruthy()
    expect((await client.from('lists').update({ is_public: false }).eq('id', list.data!.id)).error).toBeNull()
    expect((await anonymous.from('list_items').select('id').eq('id', membership.data!.id)).data).toEqual([])
  } finally {
    await client.from('profiles').update({ is_public: beforeProfile.data?.is_public ?? false }).eq('id', fixture().a)
    await second.close(); await guest.close(); await other.close()
  }
})

test('mobile keyboard progress and private recent history retain exact notes and ratings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const client = await authenticate(page.context())
  const title = `${prefix()} mobile chapters ${randomUUID().slice(0, 5)}`
  const item = await client.from('items').insert({ user_id: fixture().a, title, type: 'Manga', status: 'Reading', progress: 3, total_progress: 12, notes: '  PRIVATE MOBILE **notes**\n', rating: 9 }).select('id').single()
  expect(item.error).toBeNull()
  await page.goto(`/?q=${encodeURIComponent(title)}`)
  const button = page.getByRole('button', { name: `Increase progress for ${title}`, exact: true }).first()
  await button.focus(); await button.press('Enter')
  await expect.poll(async () => (await client.from('items').select('progress').eq('id', item.data!.id).single()).data?.progress).toBe(4)
  await page.locator('summary').filter({ hasText: 'Recent progress' }).click()
  await expect(page.locator('details').filter({ has: page.locator('summary', { hasText: 'Recent progress' }) }).getByRole('link', { name: title, exact: true })).toBeVisible()
  const event = page.locator('li').filter({ has: page.getByRole('link', { name: title, exact: true }) })
  await expect(event.getByText('ch.: 3 → 4', { exact: true })).toBeVisible()
  expect((await page.request.get('/api/progress-activity')).headers()['cache-control']).toBe('private, no-store')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect((await client.from('items').select('notes,rating').eq('id', item.data!.id).single()).data).toEqual({ notes: '  PRIVATE MOBILE **notes**\n', rating: 9 })
})

test('narrow progress controls contain pending feedback in English and Russian', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  const client = await authenticate(context)
  const title = `${prefix()} pending layout ${randomUUID().slice(0, 5)}`
  const item = await client.from('items').insert({ user_id: fixture().a, title, type: 'Manga', status: 'Reading', progress: 1, total_progress: 12 }).select('id').single()
  expect(item.error).toBeNull()
  const origin = new URL(process.env.MEDIA_VAULT_E2E_URL ?? 'http://localhost:3000').origin
  for (const locale of ['en', 'ru']) {
    await context.addCookies([{ name: 'media-vault-locale', value: locale, url: origin }])
    await page.goto(`/shelves/manga-family?q=${encodeURIComponent(title)}`)
    let release!: () => void
    const gate = new Promise<void>(done => { release = done })
    await page.route(`**/api/items/${item.data!.id}/progress`, async route => { await gate; await route.fulfill({ status: 503, json: { error: 'Synthetic unavailable' } }) })
    try {
      const button = page.locator('button[aria-busy]').first()
      await button.click()
      await expect(button).toHaveAttribute('aria-busy', 'true')
      expect(await button.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    } finally {
      release()
      await expect(page.locator('button[aria-busy]').first()).toHaveAttribute('aria-busy', 'false')
      await page.unroute(`**/api/items/${item.data!.id}/progress`)
    }
  }
})
