import { defineConfig } from 'vitest/config';

// Unit tests only: no database. `pnpm test:int` uses vitest.int.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
