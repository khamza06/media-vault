import { test, expect } from '@playwright/test'

test('temporary QA routes are absent and the global 404 is localized', async ({ page }) => {
  await page.request.post('/api/locale', { data: { locale: 'ru' } })
  const response = await page.goto('/qa-localization')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Страница не найдена', exact: true })).toBeVisible()
})

// These scenarios require no credentials and never create or mutate library records.
test('language switching persists across reloads and leaves metadata preference independent', async ({ page }) => {
  const response = await page.request.post('/api/locale', { data: { locale: 'en', metadataLanguage: 'original' } })
  expect(response.ok()).toBe(true)
  await page.goto('/login')
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Русский', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect(page.getByLabel('Электронная почта', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Русский', exact: true })).toBeEnabled()
  await page.reload()
  await expect(page.getByLabel('Электронная почта', { exact: true })).toBeVisible()
  const cookies = await page.context().cookies()
  expect(cookies.find(cookie => cookie.name === 'media-vault-metadata-language')?.value).toBe('original')
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Требуется вход', exact: true })).toBeVisible()
})

test('public error states and recovery UI are Russian at a narrow mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.request.post('/api/locale', { data: { locale: 'ru', metadataLanguage: 'en' } })
  await page.goto('/public/not-a-uuid')
  await expect(page.getByText('Неверная публичная ссылка. Попросите владельца прислать правильную.')).toBeVisible()
  await page.goto('/auth/reset-password')
  await expect(page.getByRole('heading', { name: 'Установить новый пароль', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.goto('/login')
  await expect(page.getByRole('group', { name: 'Язык интерфейса', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/localization-login-ru-mobile.png', fullPage: true, caret: 'initial' })
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('static offline fallback uses only the UI preference and contains no account data', async ({ page }) => {
  await page.request.post('/api/locale', { data: { locale: 'ru', metadataLanguage: 'en' } })
  await page.goto('/offline.html')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect(page.getByRole('heading', { name: 'Media Vault временно недоступен без сети' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Попробовать снова' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('metadataLanguage')
})
