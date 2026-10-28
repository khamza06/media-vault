import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { authenticate, fixture, prefix } from './helpers'

test('AniList fixture preview imports only selected entries through the real save action', async ({ page }) => {
  const client = await authenticate(page.context())
  const username = `qa-${randomUUID()}`
  const title = `${prefix()} AniList ${randomUUID().slice(0, 6)}`
  const firstId = String(1_600_000_000 + Math.floor(Math.random() * 100_000_000))
  const candidates = [0, 1].map(index => ({ title: `${title} ${index}`, type: 'anime', external_source: 'anilist',
    external_id: String(Number(firstId) + index), status: 'Watching', progress: 2, total_progress: 12, notes: 'PRIVATE ANILIST', rating: 7,
  }))
  // A disposable AniList provider account/mailbox is unavailable. Stub ONLY
  // the provider preview, never the import/save, auth, or database requests.
  await page.route('**/import', async route => {
    const req = route.request()
    if (req.method() === 'POST' && req.headers()['next-action'] && req.postData()?.includes(username)) {
      await route.fulfill({ status: 200, contentType: 'text/x-component', body:
        `0:{"a":"$@1","f":[],"b":"qa"}\n1:${JSON.stringify({ candidates, error: null, warning: null })}\n` })
    } else await route.continue()
  })
  await page.goto('/import')
  await page.getByLabel('AniList username', { exact: true }).fill(username)
  await page.getByRole('button', { name: 'Fetch AniList Library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'AniList preview', exact: true })).toBeVisible()
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'AniList preview', exact: true }) })
  const boxes = section.locator('input[type=checkbox]')
  await expect(boxes).toHaveCount(2)
  await boxes.nth(1).press('Space')
  await page.getByRole('button', { name: 'Import selected AniList items', exact: true }).click()
  await expect.poll(async () => (await client.from('items').select('external_id,notes').eq('user_id', fixture().a)
    .in('external_id', candidates.map(item => item.external_id))).data).toEqual([{ external_id: firstId, notes: 'PRIVATE ANILIST' }])
})
