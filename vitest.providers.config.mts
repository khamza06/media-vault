import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    env: { NODE_ENV: 'development' },
    include: ['tests/providers/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
})
