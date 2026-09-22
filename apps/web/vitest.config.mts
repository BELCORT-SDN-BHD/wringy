import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Unit tests cover the pure demo engine (src/domain/**), so the default
// environment is node. Anything needing a DOM opts in per file with
// `// @vitest-environment jsdom`.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
  },
});
