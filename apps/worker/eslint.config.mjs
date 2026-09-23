import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Minimal flat config for a TypeScript-only Node app, as in packages/*.
export default defineConfig([
  { ignores: ['node_modules/**', 'dist/**'] },
  ...tseslint.configs.recommended,
]);
