import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts: vitest runs on its own vite, whose plugin types differ from the app's.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts'
  }
})
