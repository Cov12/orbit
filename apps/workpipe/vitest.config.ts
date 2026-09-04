import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // `server-only` throws in a client bundle; under node tests it's a no-op.
      'server-only': fileURLToPath(
        new URL('./test/server-only-shim.ts', import.meta.url)
      ),
      // mirror tsconfig `@/*` -> `src/*`
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
