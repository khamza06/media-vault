import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/providers/**'],
    clearMocks: true,
    restoreMocks: true,
  },
})
