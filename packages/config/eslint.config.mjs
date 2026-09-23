import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Minimal flat config for a TypeScript-only workspace package. The web app keeps
// eslint-config-next; nothing here is Next- or React-specific.
export default defineConfig([
  { ignores: ['node_modules/**'] },
  ...tseslint.configs.recommended,
]);
