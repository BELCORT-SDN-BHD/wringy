import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Minimal flat config, the same as the workspace packages: TypeScript only,
// nothing Next- or React-specific. dist/ is the esbuild bundle.
export default defineConfig([
  { ignores: ['node_modules/**', 'dist/**'] },
  ...tseslint.configs.recommended,
]);
