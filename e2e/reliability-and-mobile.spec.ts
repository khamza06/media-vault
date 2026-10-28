import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { authenticate, choose, fixture, prefix } from './helpers'

test.beforeEach(() => { fixture() })

test('library filters, Continue progress, saved views and bulk recovery', async ({ page }) => {
  const client = await authenticate(page.context())
  const title = `${prefix()} continue ${randomUUID().slice(0, 5)}`
  const row = await client.from('items').insert({ user_id: fixture().a, title, type: 'Anime', status: 'Watching', progress: 1, total_progress: 12, notes: 'PRIVATE CONTINUE', last_progress_at: new Date().toISOString() }).select('id').single()
  expect(row.error).toBeNull()
  await page.goto('/')
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(title)
  await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible()
  const increase = page.getByRole('button', { name: new RegExp(`Increase.*${title}`) }).first()
  await increase.click()
  await expect.poll(async () => (await client.from('items').select('progress').eq('id', row.data!.id).single()).data?.progress).toBe(2)
  await page.getByText(/^Saved views \(/).click()
  await page.getByRole('textbox', { name: 'Saved view name', exact: true }).fill('Synthetic saved filters')
  await page.getByRole('button', { name: 'Save current view', exact: true }).click()
  await page.reload()
  await page.getByText(/^Saved views \(/).click()
  await expect(page.getByRole('link', { name: /Synthetic saved filters/ })).toBeVisible()
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('button', { name: 'Select all visible', exact: true }).click()
  await page.getByRole('button', { name: 'Favorite settings', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await page.route('**/*', async route => {
    if (route.request().method() === 'POST' && route.request().headers()['next-action']) await route.abort('failed')
    else await route.continue()
  })
  await dialog.getByRole('button', { name: 'Apply changes', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  expect((await client.from('items').select('notes,progress').eq('id', row.data!.id).single()).data).toEqual({ notes: 'PRIVATE CONTINUE', progress: 2 })
  await page.unroute('**/*')
  await dialog.getByRole('button', { name: 'Apply changes', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect((await client.from('items').select('favorite').eq('id', row.data!.id).single()).data?.favorite).toBe(true)
})

test('mobile navigation, Russian persistence and dashboard rendering without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await authenticate(page.context())
  await page.goto('/')
  for (const path of ['/', '/discover', '/lists', '/summary', '/stats', '/settings']) {
    await page.goto(path)
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.locator('main h1')).not.toHaveText('The vault hit an unexpected error')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  }
  await page.getByRole('button', { name: 'Русский (beta)', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Библиотека', exact: true })).toBeVisible()
  await page.locator('nav a[href="/discover"]').filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/discover/)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Поиск тайтлов', exact: true })).toBeVisible()
  await page.goto('/settings')
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('expired access is refreshed and persisted across real browser navigation', async ({ page, context }) => {
  await authenticate(context)
  const old = (await context.cookies()).find(cookie => cookie.name === 'media-vault-refresh-token')!.value
  const origin = new URL(process.env.MEDIA_VAULT_E2E_URL ?? 'http://localhost:3000')
  await context.addCookies([{ name: 'media-vault-access-token', value: 'expired-synthetic', url: origin.origin, httpOnly: true, secure: origin.protocol === 'https:', sameSite: 'Lax' }])
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible()
  const current = await context.cookies()
  expect(current.find(cookie => cookie.name === 'media-vault-access-token')?.value).not.toBe('expired-synthetic')
  expect(current.find(cookie => cookie.name === 'media-vault-refresh-token')?.value).not.toBe(old)
  await page.goto('/backup')
  expect((await page.request.get('/api/backup')).status()).toBe(200)
})

test('failed item creation keeps the draft, and the same draft saves once after retry', async ({ page }) => {
  const client = await authenticate(page.context())
  const title = `${prefix()} retry ${randomUUID().slice(0, 5)}`
  await page.goto('/')
  await page.getByRole('button', { name: '+ Add New', exact: true }).filter({ visible: true }).click()
  const dialog = page.getByRole('dialog')
  await choose(page, 'Media type', 'Anime', dialog)
  await dialog.getByRole('searchbox', { name: 'Title', exact: true }).fill(title)
  await dialog.getByRole('textbox', { name: /^Notes/ }).fill('PRIVATE RETRY DRAFT')
  await page.route('**/*', async route => {
    if (route.request().method() === 'POST' && route.request().headers()['next-action']) await route.abort('failed')
    else await route.continue()
  })
  await dialog.getByRole('button', { name: 'Save Item', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: /^Notes/ })).toHaveValue('PRIVATE RETRY DRAFT')
  await page.unroute('**/*')
  await dialog.getByRole('button', { name: 'Save Item', exact: true }).dblclick()
  await expect(dialog).not.toBeVisible()
  expect((await client.from('items').select('notes').eq('user_id', fixture().a).eq('title', title)).data).toEqual([{ notes: 'PRIVATE RETRY DRAFT' }])
})

test('bulk deletion keeps selection after a transport failure and confirms the retry', async ({ page }) => {
  const client = await authenticate(page.context())
  const title = `${prefix()} bulk delete ${randomUUID().slice(0, 5)}`
  const rows = await client.from('items').insert([0, 1].map(index => ({ user_id: fixture().a,
    title: `${title} ${index}`, type: 'Movie', status: 'Planning', progress: 0, notes: 'DISPOSABLE BULK',
  }))).select('id')
  expect(rows.error).toBeNull()
  await page.goto('/')
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(title)
  await expect(page).toHaveURL(url => url.searchParams.get('q') === title)
  await expect(page.getByRole('heading', { name: `${title} 1`, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('button', { name: 'Select all visible', exact: true }).click()
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await page.route('**/*', async route => {
    if (route.request().method() === 'POST' && route.request().headers()['next-action']) await route.abort('failed')
    else await route.continue()
  })
  await dialog.getByRole('button', { name: 'Delete 2 items', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  expect((await client.from('items').select('id').eq('user_id', fixture().a).in('id', rows.data!.map(row => row.id))).data).toHaveLength(2)
  await page.unroute('**/*')
  await dialog.getByRole('button', { name: 'Delete 2 items', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect((await client.from('items').select('id').eq('user_id', fixture().a).in('id', rows.data!.map(row => row.id))).data).toHaveLength(0)
})
