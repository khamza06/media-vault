import { createClient } from '@supabase/supabase-js'
import { expect, type BrowserContext, type Page } from '@playwright/test'

export function fixture() {
  if (process.env.MEDIA_VAULT_E2E !== '1') throw new Error('Synthetic E2E requires explicit opt-in')
  const f = JSON.parse(process.env.MEDIA_VAULT_E2E_FIXTURE ?? '{}') as { run: string; a: string; b: string; password: string }
  if (![f.run, f.a, f.b].every(id => /^[a-f0-9-]{36}$/.test(id)) || !f.password) throw new Error('Invalid synthetic fixture')
  return f
}
export const prefix = () => `QA ${fixture().run.slice(0, 8)}`
export async function userClient(who: 'a' | 'b' = 'a') {
  const f = fixture()
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const signed = await client.auth.signInWithPassword({ email: `qa-${f[who]}@example.invalid`, password: f.password })
  if (signed.error || !signed.data.session) throw new Error('Synthetic account sign-in failed')
  return { client, session: signed.data.session }
}
export async function authenticate(context: BrowserContext, who: 'a' | 'b' = 'a') {
  const signed = await userClient(who)
  const origin = new URL(process.env.MEDIA_VAULT_E2E_URL ?? 'http://localhost:3000')
  await context.addCookies([
    { name: 'media-vault-access-token', value: signed.session.access_token },
    { name: 'media-vault-refresh-token', value: signed.session.refresh_token },
  ].map(cookie => ({ ...cookie, url: origin.origin, httpOnly: true, secure: origin.protocol === 'https:', sameSite: 'Lax' as const })))
  return signed.client
}
export async function loginUI(page: Page) {
  const f = fixture()
  await page.goto('/login')
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill(`qa-${f.a}@example.invalid`)
  try { await page.getByLabel('Password', { exact: true }).fill(f.password) }
  catch { throw new Error('Could not enter synthetic login credentials') }
  await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible()
}
export async function choose(page: Page, label: string, option: string, scope = page.locator('body')) {
  await scope.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
export async function addManual(page: Page, type: string, suffix: string) {
  await page.getByRole('button', { name: '+ Add New', exact: true }).filter({ visible: true }).click()
  const dialog = page.locator('[class*="max-w-3xl"]').filter({ has: page.getByRole('button', { name: 'Close modal', exact: true }) })
  await choose(page, 'Media type', type, dialog)
  const title = `${prefix()} ${suffix}`
  await dialog.getByLabel('Title', { exact: true }).fill(title)
  await dialog.getByRole('textbox', { name: /^Notes/ }).fill(`PRIVATE ${title}`)
  await dialog.getByLabel('My Rating', { exact: true }).fill('8')
  if (type !== 'Movie') await dialog.getByLabel(/Total (Episodes|Chapters|Pages|Count)/).fill('12')
  await dialog.getByRole('button', { name: 'Save Item', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  return title
}
