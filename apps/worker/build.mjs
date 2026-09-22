#!/usr/bin/env node
/**
 * `pnpm --filter worker build`: bundles src/main.ts into dist/main.js with
 * esbuild (kickoff-package.md §8.9: the image runs `node dist/main.js`).
 *
 * - Workspace packages (@wringy/*) ship TypeScript source, so they are inlined.
 * - Every package this app declares in `dependencies` stays external and is
 *   loaded from node_modules at runtime (the image gets them from
 *   `pnpm --filter worker --prod deploy`).
 * - Anything else reached only through a workspace package (zod through
 *   @wringy/config) is inlined, because the deployed node_modules will not
 *   hold it.
 *
 * The build fails when the bundle would import a package that is neither a
 * Node built-in nor a declared dependency, since `node dist/main.js` could not
 * resolve it.
 */
import { readFileSync, rmSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
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
      return undefined; // @wringy/* and anything reached only through them: bundled.
    });
  },
};

rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });

const result = await build({
  absWorkingDir: ROOT,
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  metafile: true,
  logLevel: 'warning',
  plugins: [externalDeclaredDependencies],
});

const output = result.metafile.outputs['dist/main.js'];
const externals = [...new Set(output.imports.filter((entry) => entry.external).map((entry) => entry.path))].sort();
const undeclared = externals.filter((specifier) => !builtins.has(specifier) && !runtimeDependencies.includes(packageName(specifier)));
if (undeclared.length > 0) {
  console.error(`build: FAIL: dist/main.js imports undeclared packages: ${undeclared.join(', ')}`);
  process.exit(1);
}

// Only files that contributed bytes: esbuild parses more than tree shaking keeps.
const inputs = Object.entries(output.inputs)
  .filter(([, input]) => input.bytesInOutput > 0)
  .map(([file]) => file);
const inlinedWorkspace = [...new Set(inputs.filter((file) => file.includes('packages/')).map((file) => file.replace(/^.*packages\/([^/]+)\/.*$/, '@wringy/$1')))].sort();
const inlinedPackages = [...new Set(inputs.filter((file) => file.includes('node_modules/')).map((file) => packageName(file.split('node_modules/').pop())))].sort();
console.log(`build: dist/main.js ${(output.bytes / 1024).toFixed(1)} KiB`);
console.log(`build: inlined workspace packages: ${inlinedWorkspace.join(', ') || 'none'}`);
console.log(`build: inlined npm packages: ${inlinedPackages.join(', ') || 'none'}`);
console.log(`build: external imports: ${externals.join(', ')}`);
