import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { authenticate, choose, fixture, prefix } from './helpers'

test.beforeEach(() => { fixture() })

test('custom list CRUD, membership and explicit public sharing preserve private notes', async ({ page, browser }) => {
  const client = await authenticate(page.context())
  const title = `${prefix()} list item ${randomUUID().slice(0, 6)}`
  const seeded = await client.from('items').insert({ user_id: fixture().a, title, type: 'Book', status: 'Reading', progress: 2, notes: `PRIVATE ${title}` }).select('id').single()
  expect(seeded.error).toBeNull()
  const name = `${prefix()} list ${randomUUID().slice(0, 6)}`
  await page.goto('/lists')
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name)
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Synthetic collection')
  await page.getByRole('button', { name: 'Create list', exact: true }).click()
  await expect(page.getByRole('button', { name: `Edit ${name}`, exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click()
  const edit = page.getByRole('dialog')
  await edit.getByRole('textbox', { name: 'Name', exact: true }).fill(`${name} edited`)
  await edit.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(edit).not.toBeVisible()
  await page.getByRole('link', { name: `Preview ${name} edited`, exact: true }).click()
  await page.getByRole('button', { name: 'Add items', exact: true }).click()
  await page.getByPlaceholder('Search title, type, status, genres...').fill(title)
  await page.getByRole('button', { name: new RegExp(title) }).click()
  await page.getByRole('button', { name: 'Add 1', exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  const listId = new URL(page.url()).pathname.split('/').at(-1)!
  expect((await client.from('list_items').select('id').eq('list_id', listId).eq('user_id', fixture().a)).data).toHaveLength(1)
  await page.goto('/settings')
  await page.getByRole('checkbox', { name: /Make my vault public/ }).check()
  await page.getByRole('button', { name: 'Save profile settings', exact: true }).click()
  await expect.poll(async () => (await client.from('profiles').select('is_public').eq('id', fixture().a).single()).data?.is_public).toBe(true)
  await page.goto('/lists')
  await page.getByRole('button', { name: `Sharing settings for ${name} edited`, exact: true }).click()
  const sharing = page.getByRole('dialog')
  await sharing.getByRole('checkbox', { name: /Make this list public/ }).check()
  const slug = `qa-${randomUUID().slice(0, 8)}`
  await sharing.getByRole('textbox', { name: /Public slug/ }).fill(slug)
  await sharing.getByRole('button', { name: 'Save sharing', exact: true }).click()
  await expect(sharing).not.toBeVisible()
  const guest = await browser.newContext()
  const guestPage = await guest.newPage()
  const origin = new URL(page.url()).origin
  const username = `qa-${fixture().run.slice(0, 8)}`
  for (const path of [`/u/${username}`, `/u/${username}/lists/${slug}`, `/public/${fixture().a}`, `/share/${fixture().a}`]) {
    const response = await guestPage.goto(`${origin}${path}`)
    expect(response?.status()).toBe(200)
    expect((await guestPage.content()).includes(`PRIVATE ${title}`)).toBe(false)
    await expect(guestPage.getByText(title, { exact: true }).first()).toBeVisible()
  }
  await guest.close()
  await page.goto(`/lists/${listId}`)
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect.poll(async () => (await client.from('list_items').select('id').eq('list_id', listId)).data?.length).toBe(0)
  expect((await client.from('items').select('notes').eq('id', seeded.data!.id).single()).data?.notes).toBe(`PRIVATE ${title}`)
  await page.goto('/lists')
  await page.getByRole('button', { name: `Delete ${name} edited`, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete list', exact: true }).click()
  await expect.poll(async () => (await client.from('lists').select('id').eq('id', listId)).data?.length).toBe(0)
  expect((await client.from('profiles').update({ is_public: false }).eq('id', fixture().a)).error).toBeNull()
})

test('CSV and MAL file previews import selected data and avoid duplicates on retry', async ({ page }) => {
  const client = await authenticate(page.context())
  await page.goto('/import')
  const title = `${prefix()} CSV ${randomUUID().slice(0, 6)}`
  const csv = `title,type,status,progress,rating,notes,external_source,external_id\n${title},book,Reading,3,8,PRIVATE CSV,csv,${randomUUID()}\n`
  await page.locator('#csv-import-file').setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: 'Import selected CSV rows', exact: true }).click()
  await expect.poll(async () => (await client.from('items').select('id').eq('user_id', fixture().a).eq('title', title)).data?.length).toBe(1)
  await page.getByRole('button', { name: 'Import selected CSV rows', exact: true }).click()
  await expect(page.getByText(/No CSV items imported/)).toBeVisible()
  expect((await client.from('items').select('id').eq('user_id', fixture().a).eq('title', title)).data).toHaveLength(1)
  const malTitle = `${prefix()} MAL ${randomUUID().slice(0, 6)}`
  const malId = String(1_800_000_000 + Math.floor(Math.random() * 100_000_000))
  const xml = `<myanimelist><anime><series_animedb_id>${malId}</series_animedb_id><series_title>${malTitle}</series_title><my_watched_episodes>2</my_watched_episodes><my_status>Watching</my_status><my_score>7</my_score><my_comments>PRIVATE MAL</my_comments></anime></myanimelist>`
  await page.locator('#mal-xml-file').setInputFiles({ name: 'synthetic.xml', mimeType: 'text/xml', buffer: Buffer.from(xml) })
  await page.getByRole('button', { name: 'Import selected items', exact: true }).click()
  // Metadata providers may time out before the import safely saves un-enriched rows.
  // Wait for the user-visible completion state before checking its persisted data.
  await expect(page.getByText(/^Imported 1 items\./).first()).toBeVisible({ timeout: 90_000 })
  await expect.poll(async () => (await client.from('items').select('notes,progress').eq('user_id', fixture().a).eq('title', malTitle)).data?.[0]).toEqual({ notes: 'PRIVATE MAL', progress: 2 })
  await page.getByRole('button', { name: 'Import selected items', exact: true }).click()
  expect((await client.from('items').select('id').eq('user_id', fixture().a).eq('title', malTitle)).data).toHaveLength(1)
})

test('JSON and CSV downloads, preview selection, selected restore and invalid file handling', async ({ page }) => {
  const client = await authenticate(page.context())
  await page.goto('/backup')
  const exported = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  const download = await exported
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const backup = JSON.parse(Buffer.concat(chunks).toString())
  expect(backup.app).toBe('Media Vault')
  expect(backup.items.length).toBeGreaterThan(0)
  const csv = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click()
  expect((await csv).suggestedFilename()).toMatch(/\.csv$/)
  const title = `${prefix()} selected restore ${randomUUID().slice(0, 6)}`
  const rows = [0, 1].map(index => ({ ...backup.items[0], id: randomUUID(), title: `${title} ${index}`, external_source: null, external_id: null, notes: 'PRIVATE RESTORE', progress: 0, rating: 8, status: 'Planning' }))
  const input = page.getByLabel('Media Vault backup file')
  await input.setInputFiles({ name: 'selection.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...backup, version: 1, items: rows, lists: undefined })) })
  const checks = page.locator('input[type=checkbox]')
  await expect(checks).toHaveCount(2)
  await checks.nth(1).press('Space')
  await expect(checks.nth(1)).not.toBeChecked()
  await page.getByRole('button', { name: 'Restore selected items', exact: true }).click()
  await expect(page.getByText(/Restored 1 items/).first()).toBeVisible()
  expect((await client.from('items').select('title,notes').eq('user_id', fixture().a).in('title', rows.map(row => row.title))).data).toEqual([{ title: rows[0].title, notes: 'PRIVATE RESTORE' }])
  await input.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{broken') })
  await expect(page.getByText('Backup file is not valid JSON.').first()).toBeVisible()
})

test('cover upload, failed save retry, shared reference, replacement and deletion', async ({ page }) => {
  const client = await authenticate(page.context())
  const title = `${prefix()} covers ${randomUUID().slice(0, 6)}`
  const item = await client.from('items').insert({ user_id: fixture().a, title, type: 'Movie', status: 'Planning', progress: 0, notes: 'PRIVATE COVER' }).select('id').single()
  expect(item.error).toBeNull()
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH1sAAAAASUVORK5CYII=', 'base64')
  const beforeObjects = await client.storage.from('media-covers').list(fixture().a)
  expect(beforeObjects.error).toBeNull()
  await page.goto(`/items/${item.data!.id}/edit`)
  // Exercise a hydrated control before sending a synthetic file-change event.
  await choose(page, 'Status', 'Planning')
  await page.getByLabel('Or Upload Cover', { exact: true }).setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByText('Selected file: cover.png', { exact: true })).toBeVisible()
  // Block only the item-save action after a successful direct Storage upload.
  await page.route('**/items/*/edit', async route => {
    const request = route.request()
    // The prepare-upload action only carries size/type. Identify the save payload
    // directly: a cross-origin response callback can arrive after this request.
    if (request.method() === 'POST' && request.headers()['next-action'] && request.postData()?.includes('"imageUrl"')) await route.abort('failed')
    else await route.continue()
  })
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: /Could not|Failed/ }).first()).toBeVisible()
  const firstObjects = await client.storage.from('media-covers').list(fixture().a)
  expect(firstObjects.error).toBeNull()
  expect(firstObjects.data?.filter(file => !beforeObjects.data?.some(previous => previous.name === file.name))).toHaveLength(1)
  await page.unroute('**/items/*/edit')
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page).not.toHaveURL(/\/edit/)
  const first = await client.from('items').select('image_url,notes').eq('id', item.data!.id).single()
  expect(first.data?.notes).toBe('PRIVATE COVER')
  expect((await client.storage.from('media-covers').list(fixture().a)).data?.length).toBe(firstObjects.data?.length)
  const shared = await client.from('items').insert({ user_id: fixture().a, title: `${title} shared`, type: 'Movie', status: 'Planning', image_url: first.data!.image_url }).select('id').single()
  expect(shared.error).toBeNull()
  await page.goto(`/items/${item.data!.id}/edit`)
  await choose(page, 'Status', 'Planning')
  await page.getByLabel('Or Upload Cover', { exact: true }).setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByText('Selected file: replacement.png', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page).not.toHaveURL(/\/edit/)
  expect((await page.request.get(first.data!.image_url)).status()).toBe(200)
  await page.goto(`/items/${item.data!.id}`)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: /Delete/i }).click()
  await expect.poll(async () => (await client.from('items').select('id').eq('id', item.data!.id)).data?.length).toBe(0)
})
