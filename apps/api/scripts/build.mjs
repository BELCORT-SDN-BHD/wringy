#!/usr/bin/env node
/**
 * `pnpm --filter api build`: bundles src/main.ts into dist/main.js with esbuild
 * (kickoff-package.md §8.9: the api image runs `node dist/main.js`).
 *
 * The workspace packages (@wringy/*) ship TypeScript source, so they are
 * bundled. Every other bare import stays external and is loaded at run time
 * from apps/api/node_modules, which holds exactly this package's declared
 * dependencies (pnpm's isolated layout; the image gets them through
 * `pnpm --filter api --prod deploy`).
 *
 * External imports reached only through a workspace package are marked free of
 * side effects, so an import whose bindings the API never uses is dropped.
 * That keeps @wringy/db's migration tooling (node-pg-migrate, pg-boss), which
 * the API never calls, out of the bundle's run-time imports; the check at the
 * end fails the build if any external the API does not declare survives.
 */
import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PACKAGES_DIR = fileURLToPath(new URL('../../../packages/', import.meta.url));
const OUTFILE = path.join(ROOT, 'dist', 'main.js');
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const declared = new Set(Object.keys(manifest.dependencies ?? {}));

const WORKSPACE = /^@wringy\//;
const BARE = /^[^./]/;

/** `@scope/name/sub` → `@scope/name`; `name/sub` → `name`. */
function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

const isBuiltin = (specifier) => specifier.startsWith('node:') || builtinModules.includes(packageName(specifier));

/** @type {import('esbuild').Plugin} */
const externalizeNpm = {
  name: 'externalize-npm',
  setup(context) {
    context.onResolve({ filter: BARE }, (args) => {
      if (args.kind === 'entry-point' || WORKSPACE.test(args.path)) return undefined;
      const fromWorkspacePackage = !path.relative(PACKAGES_DIR, args.importer).startsWith('..');
      return fromWorkspacePackage
        ? { path: args.path, external: true, sideEffects: false }
        : { path: args.path, external: true };
    });
  },
};

const result = await build({
  absWorkingDir: ROOT,
  entryPoints: ['src/main.ts'],
  outfile: OUTFILE,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  metafile: true,
  logLevel: 'info',
  plugins: [externalizeNpm],
});

// Every run-time import must be a Node built-in or a dependency this package declares.
const imports = result.metafile.outputs[path.relative(ROOT, OUTFILE).split(path.sep).join('/')]?.imports ?? [];
const undeclared = [
  ...new Set(
    imports
      .filter((entry) => entry.external && !isBuiltin(entry.path))
      .map((entry) => packageName(entry.path))
      .filter((name) => !declared.has(name)),
  ),
];
if (undeclared.length > 0) {
  console.error(`build: dist/main.js imports packages api does not declare: ${undeclared.join(', ')}`);
  process.exit(1);
}
const externals = [...new Set(imports.filter((entry) => entry.external && !isBuiltin(entry.path)).map((entry) => packageName(entry.path)))];
console.log(`build: dist/main.js external packages: ${externals.sort().join(', ')}`);
