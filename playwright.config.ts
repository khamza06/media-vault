import { defineConfig } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.MEDIA_VAULT_E2E_URL ?? 'http://localhost:3000',
    viewport: { width: 1440, height: 1000 },
    trace: 'off', video: 'off', screenshot: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
})
