#!/usr/bin/env node
/**
 * `pnpm --filter @wringy/db build`: bundles the migration CLI
 * (src/cli/migrate.ts, what `pnpm db:migrate` runs through tsx) into
 * dist/migrate.js with esbuild, so a production image can run the one-off
 * migrate step with plain `node` (kickoff-package.md §8.9: "The image also
 * carries the migrations for a one-off migrate step"; apps/api/Dockerfile).
 *
 * - The workspace package @wringy/config ships TypeScript source, so it is
 *   inlined, together with anything reached only through it (zod).
 * - The packages this package declares in `dependencies` (node-pg-migrate, pg,
 *   pg-boss) stay external and load from node_modules at run time; the image
 *   gets them from `pnpm --filter @wringy/db --prod deploy --legacy`.
 * - The bundle keeps the source's relative layout: src/migrate.ts finds the
 *   SQL files at `new URL('../migrations/', import.meta.url)` and src/pgboss.ts
 *   resolves the pg-boss CLI from `import.meta.url`, and dist/ sits beside
 *   migrations/ exactly as src/ does.
 *
 * The build fails when the bundle would import a package that is neither a
 * Node built-in nor a declared dependency.
 */
import { readFileSync, rmSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTFILE = 'dist/migrate.js';
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const runtimeDependencies = Object.keys(manifest.dependencies ?? {}).filter((name) => !name.startsWith('@wringy/'));
const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

/** `pg-boss/x` → `pg-boss`, `@scope/pkg/x` → `@scope/pkg`. */
function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** @type {import('esbuild').Plugin} */
const externalDeclaredDependencies = {
  name: 'external-declared-dependencies',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^[^./]/ }, (args) => {
      if (builtins.has(args.path)) return { path: args.path, external: true };
      if (runtimeDependencies.includes(packageName(args.path))) return { path: args.path, external: true };
      return undefined; // @wringy/config and anything reached only through it: bundled.
    });
  },
};

rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });

const result = await build({
  absWorkingDir: ROOT,
  entryPoints: ['src/cli/migrate.ts'],
  outfile: OUTFILE,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  metafile: true,
  logLevel: 'warning',
  plugins: [externalDeclaredDependencies],
});

const output = result.metafile.outputs[OUTFILE];
const externals = [...new Set(output.imports.filter((entry) => entry.external).map((entry) => entry.path))].sort();
const undeclared = externals.filter((specifier) => !builtins.has(specifier) && !runtimeDependencies.includes(packageName(specifier)));
if (undeclared.length > 0) {
  console.error(`build: FAIL: ${OUTFILE} imports undeclared packages: ${undeclared.join(', ')}`);
  process.exit(1);
}
console.log(`build: ${OUTFILE} ${(output.bytes / 1024).toFixed(1)} KiB; external imports: ${externals.join(', ')}`);
