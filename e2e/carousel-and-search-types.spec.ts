import { test, expect, type Page } from '@playwright/test'
import { authenticate, fixture } from './helpers'

test.beforeEach(() => { fixture() })

async function carousel(page: Page) {
  await page.goto('/')
  const region = page.getByRole('region', { name: 'Recommended for you', exact: true })
  await expect(region).toBeVisible()
  const viewport = region.getByRole('group', { name: 'Recommended titles', exact: true })
  await viewport.scrollIntoViewIfNeeded()
  expect(await viewport.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
  return { region, viewport }
}

test('recommendations support mouse arrows, drag without accidental previews, horizontal wheel and keyboard boundaries', async ({ page }) => {
  await authenticate(page.context())
  const { region, viewport } = await carousel(page)
  const next = region.getByRole('button', { name: 'Next recommendations', exact: true })
  const previous = region.getByRole('button', { name: 'Previous recommendations', exact: true })
  await expect(previous).toBeDisabled()
  await next.click()
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(100)
  await expect(previous).toBeEnabled()
  await viewport.focus()
  await page.keyboard.press('End')
  await expect(next).toBeDisabled()
  await page.keyboard.press('Home')
  await expect(previous).toBeDisabled()
  const box = (await viewport.boundingBox())!
  const y = box.y + Math.min(100, box.height / 2)
  await page.mouse.move(box.x + Math.min(500, box.width - 20), y)
  await page.mouse.down()
  await page.mouse.move(box.x + 40, y, { steps: 12 })
  await page.mouse.up()
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(100)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await viewport.focus()
  await page.keyboard.press('Home')
  await expect(previous).toBeDisabled()
  await viewport.hover()
  await page.mouse.wheel(400, 0)
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(100)
  await region.getByRole('button', { name: /^Preview recommendation / }).filter({ visible: true }).nth(2).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close recommendation preview', exact: true }).click()
  await viewport.focus()
  await page.keyboard.press('Tab')
  await expect(region.getByRole('button', { name: /^Preview recommendation / }).first()).toBeFocused()
})

test('recommendations preserve native mobile swipes, taps and narrow-screen layout', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  try {
    await authenticate(context)
    const page = await context.newPage()
    const { region, viewport } = await carousel(page)
    const box = (await viewport.boundingBox())!
    const cdp = await context.newCDPSession(page)
    const y = box.y + 100
    const x = box.x + box.width - 25
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let step = 1; step <= 12; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - step * 22, y }] })
      // Dispatch an actual paced swipe; synthesizeScrollGesture does not emit touch events on every host.
      await page.waitForTimeout(20)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(50)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const firstVisible = region.getByRole('button', { name: /^Preview recommendation / }).nth(2)
    await firstVisible.scrollIntoViewIfNeeded()
    await firstVisible.tap()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Close recommendation preview', exact: true }).tap()
    await page.setViewportSize({ width: 320, height: 740 })
    await expect(region.getByRole('button', { name: 'Next recommendations', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  } finally { await context.close() }
})

for (const mobile of [false, true]) {
  test(`header ${mobile ? 'mobile' : 'desktop'} searches distinct Manhwa and Manhua and opens correctly typed capture`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
    await authenticate(page.context())
    await page.goto('/')
    for (const [type, query, label] of [['manhwa', 'Solo Leveling', 'Manhwa'], ['manhua', 'Soul Land', 'Manhua']]) {
      if (mobile) await page.getByRole('button', { name: 'Open search', exact: true }).click()
      const select = page.getByRole('combobox', { name: 'Search media type', exact: true }).filter({ visible: true })
      if (mobile) await select.click()
      else await select.press('Space')
      for (const option of ['Anime', 'Manga', 'Manhwa', 'Manhua', 'Movie', 'Series', 'Book']) await expect(page.getByRole('option', { name: option, exact: true })).toBeVisible()
      const option = page.getByRole('option', { name: label, exact: true })
      if (mobile) await option.click()
      else { await option.focus(); await page.keyboard.press('Enter') }
      const response = page.waitForResponse(response => response.url().endsWith('/api/catalog-search') && response.request().postDataJSON()?.type === type)
      await page.getByPlaceholder('Search global databases...', { exact: true }).filter({ visible: true }).fill(query)
      const result = await response
      expect(result.status()).toBe(200)
      const payload = await result.json()
      expect(payload.data.length).toBeGreaterThan(0)
      expect(payload.data.every((item: { type: string }) => item.type === label)).toBe(true)
      const all = page.getByRole('link', { name: 'View all results', exact: true }).filter({ visible: true })
      await expect(all).toHaveAttribute('href', new RegExp(`type=${type}`))
      await page.getByRole('button', { name: new RegExp(payload.data[0].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).filter({ visible: true }).first().click()
      const capture = page.getByRole('dialog')
      await expect(capture.getByRole('combobox', { name: 'Media type', exact: true })).toHaveText(label)
      await capture.getByRole('button', { name: 'Close modal', exact: true }).click()
      const fullResponse = page.waitForResponse(response => response.url().endsWith('/api/catalog-search') && response.request().postDataJSON()?.mode === 'full')
      await page.goto(`/discover?${new URLSearchParams({ type, q: query })}`)
      const full = await fullResponse
      expect(full.status()).toBe(200)
      const fullPayload = await full.json()
      expect(fullPayload.data.length).toBeGreaterThan(0)
      expect(fullPayload.data.every((item: { type: string }) => item.type === label)).toBe(true)
      await expect(page.getByRole('combobox', { name: 'Media type', exact: true })).toHaveText(label)
      await expect(page.getByRole('button', { name: /^Preview / }).first()).toBeVisible()
    }
  })
}
