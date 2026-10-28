import { test, expect } from '@playwright/test'
import { fixture } from './helpers'

test('registration and recovery request UI with synthetic email (delivery not verified)', async ({ page }) => {
  const f = fixture()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create account', exact: true })).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill(`qa-signup-${f.run}@example.invalid`)
  try { await page.getByLabel('Password', { exact: true }).fill(f.password) }
  catch { throw new Error('Could not fill synthetic registration credentials') }
  const action = page.waitForResponse(response => response.request().method() === 'POST' && Boolean(response.request().headers()['next-action']))
  await page.locator('form').getByRole('button', { name: 'Create account', exact: true }).click()
  expect((await action).status()).toBe(200)
  const feedback = page.locator('form [role="alert"], form [role="status"]').first()
  await expect(feedback).toBeVisible()
  console.log(`Synthetic registration response: ${(await feedback.innerText()).slice(0, 220)}`)
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click()
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill(`qa-${f.a}@example.invalid`)
  const reset = page.waitForResponse(response => response.request().method() === 'POST' && Boolean(response.request().headers()['next-action']))
  await page.locator('form').getByRole('button', { name: /Send reset link/i }).click()
  expect((await reset).status()).toBe(200)
  await expect(feedback).toBeVisible()
  console.log(`Synthetic recovery response: ${(await feedback.innerText()).slice(0, 220)}`)
})
