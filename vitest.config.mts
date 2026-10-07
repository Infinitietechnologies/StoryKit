import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/test/**/*.test.{ts,tsx}'],
    pool: 'threads',
    maxWorkers: 1,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/index.ts'],
      thresholds: {
        statements: 50,
        branches: 30,
        functions: 40,
        lines: 50,
      },
    },
  },
});
