#!/usr/bin/env node
/**
 * `pnpm depcruise`: the dependency-direction check (ruling D31, M2-AC01/3).
 *
 * 1. Cruises every apps/<name>/src and packages/<name>/src with
 *    .dependency-cruiser.cjs and requires zero violations.
 * 2. Copies scripts/fixtures/dependency-violation.ts (apps/web importing
 *    @wringy/db) into apps/web/src/lib, cruises again, and requires the run to
 *    FAIL with the rule `web-not-to-server-runtime` naming that file. The copy
 *    is always removed, even when the cruise throws.
 *
 * Exit 0 only when both halves hold.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE = path.join(ROOT, 'scripts', 'fixtures', 'dependency-violation.ts');
const PLANTED_REL = 'apps/web/src/lib/__dependency-violation__.ts';
const PLANTED = path.join(ROOT, PLANTED_REL);
const EXPECTED_RULE = 'web-not-to-server-runtime';

// The root devDependency (pnpm links it into the root node_modules).
const DEPCRUISE = path.join(ROOT, 'node_modules', 'dependency-cruiser', 'bin', 'dependency-cruiser.mjs');

/** apps/<name>/src and packages/<name>/src that exist, as cruise roots. */
function sourceRoots() {
  return ['apps', 'packages'].flatMap((group) => {
    const dir = path.join(ROOT, group);
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(path.join(dir, entry.name, 'src')))
      .map((entry) => `${group}/${entry.name}/src`);
  });
}

function cruise(roots) {
  const result = spawnSync(
    process.execPath,
    [DEPCRUISE, '--config', '.dependency-cruiser.cjs', '--output-type', 'err', ...roots],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout}${result.stderr}`.trim() };
}

function fail(message, output) {
  console.error(`depcruise: FAIL: ${message}`);
  if (output) console.error(output);
  process.exit(1);
}

// A copy left behind by a killed run would fail step 1 for the wrong reason.
rmSync(PLANTED, { force: true });

const roots = sourceRoots();
console.log(`depcruise: cruising ${roots.join(', ')}`);

const clean = cruise(roots);
if (clean.status !== 0) fail('the source tree breaks a dependency rule', clean.output);
console.log(`depcruise: clean tree: ${clean.output.split('\n').pop()}`);

let planted;
try {
  copyFileSync(FIXTURE, PLANTED);
  planted = cruise(roots);
} finally {
  rmSync(PLANTED, { force: true });
}

const named = planted.output
  .split('\n')
  .some((line) => line.includes(EXPECTED_RULE) && line.includes(PLANTED_REL));
if (planted.status === 0 || !named) {
  fail(`the planted violation (${PLANTED_REL} importing @wringy/db) was not rejected by ${EXPECTED_RULE}`, planted.output);
}
const evidence = planted.output.split('\n').find((line) => line.includes(EXPECTED_RULE));
console.log(`depcruise: planted violation rejected (exit ${planted.status}): ${evidence.trim()}`);
console.log('depcruise: PASS');
