#!/usr/bin/env node
/**
 * `pnpm depcruise`: the dependency-direction check (ruling D31, M2-AC01/3).
 *
 * 1. Cruises every apps/<name>/src and packages/<name>/src with
 *    .dependency-cruiser.cjs and requires zero violations.
 * 2. Plants each deliberately violating fixture of PLANTED below at the path
 *    it names, cruises again, and requires the run to FAIL with each fixture's
 *    rule naming that fixture's planted file:
 *    - scripts/fixtures/dependency-violation.ts (apps/web importing @wringy/db)
 *      must be rejected by `web-not-to-server-runtime`;
 *    - scripts/fixtures/dependency-violation-worker.ts (apps/worker importing
 *      @wringy/contracts) must be rejected by `worker-not-to-contracts`;
 *    - scripts/fixtures/dependency-violation-supabase.ts (a second file in
 *      apps/web importing @supabase/ssr) must be rejected by
 *      `supabase-client-only-in-auth-lib` (M2-02 R17);
 *    - scripts/fixtures/dependency-violation-auth-demo.ts (the M2-02 auth
 *      library importing the demo store) must be rejected by the widened
 *      `internal-not-to-demo` (M2-02 R17).
 *    The copies are always removed, even when the cruise throws.
 *
 * Exit 0 only when both halves hold.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Each fixture, where it is planted (relative to the repository root), and the rule that must reject it. */
const PLANTED = [
  {
    fixture: 'scripts/fixtures/dependency-violation.ts',
    at: 'apps/web/src/lib/__dependency-violation__.ts',
    rule: 'web-not-to-server-runtime',
    what: 'apps/web importing @wringy/db',
  },
  {
    fixture: 'scripts/fixtures/dependency-violation-worker.ts',
    at: 'apps/worker/src/__dependency-violation__.ts',
    rule: 'worker-not-to-contracts',
    what: 'apps/worker importing @wringy/contracts',
  },
  {
    fixture: 'scripts/fixtures/dependency-violation-supabase.ts',
    // Under (internal)/ on purpose: a Server Component creating a client is the
    // case the rule exists to stop.
    at: 'apps/web/src/app/(internal)/internal/__dependency-violation__.ts',
    rule: 'supabase-client-only-in-auth-lib',
    what: 'a second apps/web file importing @supabase/ssr',
  },
  {
    fixture: 'scripts/fixtures/dependency-violation-auth-demo.ts',
    at: 'apps/web/src/lib/auth/__dependency-violation__.ts',
    rule: 'internal-not-to-demo',
    what: 'the M2-02 auth library importing the demo store',
  },
];

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

const removePlanted = () => {
  for (const { at } of PLANTED) rmSync(path.join(ROOT, at), { force: true });
};

// A copy left behind by a killed run would fail step 1 for the wrong reason.
removePlanted();

const roots = sourceRoots();
console.log(`depcruise: cruising ${roots.join(', ')}`);

const clean = cruise(roots);
if (clean.status !== 0) fail('the source tree breaks a dependency rule', clean.output);
console.log(`depcruise: clean tree: ${clean.output.split('\n').pop()}`);

let planted;
try {
  for (const { fixture, at } of PLANTED) copyFileSync(path.join(ROOT, fixture), path.join(ROOT, at));
  planted = cruise(roots);
} finally {
  removePlanted();
}

if (planted.status === 0) fail('the planted violations were not rejected (the cruise passed)', planted.output);
const lines = planted.output.split('\n');
for (const { at, rule, what } of PLANTED) {
  const evidence = lines.find((line) => line.includes(rule) && line.includes(at));
  if (evidence === undefined) fail(`the planted violation (${at}, ${what}) was not rejected by ${rule}`, planted.output);
  console.log(`depcruise: planted violation rejected (exit ${planted.status}): ${evidence.trim()}`);
}
console.log('depcruise: PASS');
