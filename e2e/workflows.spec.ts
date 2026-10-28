import { test, expect } from '@playwright/test'
import { addManual, authenticate, choose, fixture, loginUI, prefix } from './helpers'

test.beforeEach(() => { fixture() })
test.afterEach(async ({ page }, info) => {
  // Password fields must not enter Playwright's automatic failure context.
  if (info.status !== info.expectedStatus) await page.locator('input[type="password"]').evaluateAll(inputs => inputs.forEach(input => { (input as HTMLInputElement).value = '' })).catch(() => {})
})

test('desktop login, reload, logout and cross-account isolation', async ({ page, browser }) => {
  await loginUI(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible()
  const cookies = await page.context().cookies()
  expect(cookies.filter(c => c.name.startsWith('media-vault-') && c.httpOnly)).toHaveLength(2)
  const other = await browser.newContext()
  await authenticate(other, 'b')
  const otherPage = await other.newPage()
  await otherPage.goto(process.env.MEDIA_VAULT_E2E_URL ?? 'http://localhost:3000')
  await expect(otherPage.getByRole('heading', { name: 'Library', exact: true })).toBeVisible()
  await other.close()
  await page.getByRole('button', { name: 'Open utility menu' }).click()
  await page.getByRole('button', { name: 'Logout', exact: true }).filter({ visible: true }).click()
  await expect(page).toHaveURL(/\/login/)
  expect((await page.context().cookies()).filter(c => c.name.startsWith('media-vault-'))).toHaveLength(0)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Sign in required', exact: true })).toBeVisible()
})

test('add all five media types and edit tracking without losing notes', async ({ page }) => {
  const client = await authenticate(page.context())
  await page.goto('/')
  for (const type of ['Anime', 'Manga', 'Movie', 'TV Series', 'Book']) {
    await test.step(`Add ${type}`, async () => {
      expect((await client.from('items').delete().eq('user_id', fixture().a).eq('title', `${prefix()} manual ${type}`)).error).toBeNull()
      const title = await addManual(page, type, `manual ${type}`)
      await expect.poll(async () => (await client.from('items').select('id').eq('user_id', fixture().a).eq('title', title)).data?.length).toBe(1)
    })
  }
  const result = await client.from('items').select('id,notes').eq('user_id', fixture().a).eq('title', `${prefix()} manual Anime`).single()
  expect(result.error).toBeNull()
  await page.goto(`/items/${result.data!.id}/edit?returnTo=/items/${result.data!.id}`)
  await page.getByLabel('My Rating', { exact: true }).fill('9')
  await page.getByLabel('Current Episode', { exact: true }).fill('3')
  await choose(page, 'Status', 'Watching')
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page).toHaveURL(url => url.pathname === `/items/${result.data!.id}`)
  const saved = await client.from('items').select('notes,rating,progress,status,last_progress_at').eq('id', result.data!.id).single()
  expect(saved.data).toMatchObject({ notes: result.data!.notes, rating: 9, progress: 3, status: 'Watching' })
  expect(saved.data!.last_progress_at).toBeTruthy()
})

test('catalog live search, preview, provider outage and retry', async ({ page }) => {
  await authenticate(page.context())
  await page.goto('/discover')
  const input = page.getByRole('textbox', { name: 'Search titles', exact: true })
  await input.fill('My Hero Academia')
  const preview = page.getByRole('button', { name: /^Preview / }).first()
  await expect(preview).toBeVisible({ timeout: 40_000 })
  await preview.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.route('**/api/catalog-search', route => route.abort('failed'))
  await input.fill('Re')
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await page.unroute('**/api/catalog-search')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Preview / }).first()).toBeVisible({ timeout: 40_000 })
})

test('offline shell contains no account information and works with network disabled', async ({ page }) => {
  const origin = new URL(process.env.MEDIA_VAULT_E2E_URL ?? 'http://localhost:3000')
  test.skip(origin.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(origin.hostname), 'App intentionally disables service workers on local hosts; exercise on the deployed HTTPS origin.')
  await authenticate(page.context())
  await page.goto('/manifest.webmanifest')
  await page.evaluate(async () => {
    const old = await caches.open('media-vault-shell-v2')
    await old.put('/offline', new Response('PRIVATE OLD ACCOUNT'))
    await caches.open('unrelated-qa-cache')
  })
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes('media-vault-shell-v2'))).toBe(false)
  expect(await page.evaluate(async () => (await caches.keys()).includes('unrelated-qa-cache'))).toBe(true)
  // Inspect only the installed application shell, never another user's cache.
  const shell = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('media-vault-shell'))
    const texts: string[] = []
    for (const name of names) {
      const cache = await caches.open(name)
      for (const req of await cache.keys()) if (new URL(req.url).pathname.startsWith('/offline')) texts.push(await (await cache.match(req))!.text())
    }
    return texts.join('\n')
  })
  expect(shell.includes(`qa-${fixture().a}@example.invalid`)).toBe(false)
  expect(shell.includes(fixture().a)).toBe(false)
  await page.context().setOffline(true)
  try {
    await page.goto('/summary')
    await expect(page.getByRole('heading', { name: /Media Vault is temporarily offline/ })).toBeVisible()
  } finally { await page.context().setOffline(false) }
})

test('large library search includes the oldest record beyond the API row cap', async ({ page }) => {
  const client = await authenticate(page.context(), 'b')
  const title = `${prefix()} oldest sentinel`
  const found = await client.from('items').select('id').eq('user_id', fixture().b).eq('title', title)
  if (!found.data?.length) {
    const rows = Array.from({ length: 1002 }, (_, index) => ({ user_id: fixture().b,
      title: index === 1001 ? title : `${prefix()} large ${index}`,
      type: 'Anime', status: 'Planning', progress: 0, notes: 'Synthetic large-library test',
      created_at: index === 1001 ? '2000-01-01T00:00:00Z' : '2020-01-01T00:00:00Z',
    }))
    for (let i = 0; i < rows.length; i += 250) expect((await client.from('items').insert(rows.slice(i, i + 250))).error).toBeNull()
  }
  await page.goto('/')
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(title)
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
})
