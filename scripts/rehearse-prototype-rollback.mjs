#!/usr/bin/env node
/**
 * Rehearses the M2-01 recovery clause (docs/planning/tickets/m2-01.md,
 * "Verification and recovery": 移除新入口可回到原型，保留源设计资产 — removing
 * the new entry returns the app to the prototype, and the source design assets
 * are kept).
 *
 * Usage: node scripts/rehearse-prototype-rollback.mjs [--e2e]
 *
 * Nothing in this checkout changes. In a throwaway git worktree of HEAD, under
 * the system temporary directory, it:
 *
 * 1. removes the new entry, the (internal) root layout and route group
 *    (apps/web/src/app/(internal)/, the only route M2-01 added);
 * 2. installs from the lockfile, offline (`pnpm install --frozen-lockfile
 *    --offline`): no dependency or lockfile edit is needed;
 * 3. runs the web unit tests and `next build`, and checks that the build has no
 *    /internal route;
 * 4. starts the built app and requests `/`, `/campaigns` and `/internal`:
 *    the prototype pages answer 200 and /internal is the demo's own 404;
 * 5. with --e2e, runs the M1 prototype Playwright suite (apps/web
 *    playwright.config.ts) against a warmed `next dev` in the worktree,
 *    leaving out the tests of the removed entry itself: the suite's
 *    "M2-AC01 internal build route walk" (tests/e2e/i18n.spec.ts) walks
 *    /internal, which no longer exists (`--grep-invert M2-AC01`).
 *
 * And, in this checkout, it checks that M2-01 changed none of the source design
 * assets (DESIGN_ASSETS) since the merge base with main.
 *
 * The worktree is always removed. Exit 0 only when every step holds. The
 * evidence of a run is recorded in docs/m2-internal/acceptance-record.md.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NEW_ENTRY = 'apps/web/src/app/(internal)';
/** The tests of the removed entry inside the M1 suite: their titles carry this ticket's key. */
const REMOVED_ENTRY_TESTS = 'M2-AC01';
/** The prototype's design sources: the design system v2 and brand deliverables, the UI kit, the tokens, the static assets. */
const DESIGN_ASSETS = [
  'phase-0/foundation/design-system-v2',
  'phase-0/deliverables/brand',
  'apps/web/src/components/ui',
  'apps/web/src/app/globals.css',
  'apps/web/public',
];
const WITH_E2E = process.argv.includes('--e2e');
const WINDOWS = process.platform === 'win32';

function log(line) {
  console.log(`rollback: ${line}`);
}

function fail(message, output) {
  console.error(`rollback: FAIL: ${message}`);
  if (output) console.error(output.slice(-8000));
  process.exitCode = 1;
  throw new Error(message);
}

/** Runs a command to completion; pnpm goes through the shell (pnpm.cmd on Windows). */
function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    shell: command === 'pnpm',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/**
 * Like run(), without blocking the event loop: while it runs, the servers started
 * with start() keep having their output read. (With spawnSync the loop stops, a
 * server's stdout pipe fills, and the server stalls on its next log line.)
 */
function runAsync(command, args, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: command === 'pnpm',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, output }));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

/** Starts a long-running pnpm command; stop() ends it and its children. */
function start(args, cwd, env = {}) {
  const child = spawn('pnpm', args, {
    cwd,
    env: { ...process.env, ...env },
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !WINDOWS,
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  return {
    output: () => output,
    stop: () => {
      if (child.exitCode !== null) return;
      if (WINDOWS) spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      else {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          // already gone
        }
      }
    },
  };
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      return response.status;
    } catch {
      if (Date.now() > deadline) return undefined;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

/** Every page route of the worktree's app, as a URL that compiles it (route groups dropped, segments filled). */
function pageRoutes(appDir) {
  const routes = [];
  const walk = (dir, segments) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const name = entry.name;
        const segment = /^\(.*\)$/.test(name)
          ? null
          : name.startsWith('[...')
            ? 'rollback-unmatched'
            : name.startsWith('[')
              ? 'rollback-id'
              : name;
        walk(path.join(dir, name), segment === null ? segments : [...segments, segment]);
      } else if (entry.name === 'page.tsx') {
        routes.push(`/${segments.join('/')}`);
      }
    }
  };
  walk(appDir, []);
  return [...new Set(routes)].sort();
}

// --- Design assets, in this checkout ----------------------------------------------

const mergeBase = run('git', ['merge-base', 'HEAD', 'main'], ROOT);
if (mergeBase.status !== 0) fail('no merge base with main', mergeBase.output);
const base = mergeBase.output.trim();
const changed = run('git', ['diff', '--name-only', base, 'HEAD', '--', ...DESIGN_ASSETS], ROOT);
if (changed.status !== 0) fail('git diff of the design assets failed', changed.output);
if (changed.output.trim() !== '') fail(`M2-01 changed source design assets since ${base.slice(0, 7)}:\n${changed.output}`);
log(`design assets unchanged since the merge base ${base.slice(0, 7)}: ${DESIGN_ASSETS.join(', ')}`);

// --- The rehearsal, in a throwaway worktree -------------------------------------------

const head = run('git', ['rev-parse', '--short', 'HEAD'], ROOT).output.trim();
const worktree = mkdtempSync(path.join(tmpdir(), 'wringy-rollback-'));
rmSync(worktree, { recursive: true, force: true });
const servers = [];
let added = false;
try {
  const add = run('git', ['worktree', 'add', '--detach', worktree, 'HEAD'], ROOT);
  if (add.status !== 0) fail('git worktree add failed', add.output);
  added = true;
  log(`worktree of ${head} at ${worktree}`);

  // 1. Remove the new entry.
  const removed = run('git', ['ls-files', '--', NEW_ENTRY], worktree).output.trim().split('\n').filter(Boolean);
  rmSync(path.join(worktree, NEW_ENTRY), { recursive: true, force: true });
  log(`removed ${NEW_ENTRY} (${removed.length} tracked files)`);
  // What is left of the web app no longer reaches the M2-01 packages.
  const wringyImports = run('git', ['grep', '-l', '@wringy/', '--', 'apps/web/src'], worktree);
  const importers = wringyImports.output.trim().split('\n').filter((file) => file && !file.startsWith(NEW_ENTRY));
  if (importers.length > 0) fail(`apps/web/src still imports @wringy/* after the removal:\n${importers.join('\n')}`);
  log('apps/web/src imports no @wringy/* package once the entry is removed');

  // 2. Install from the lockfile, offline.
  const install = run('pnpm', ['install', '--frozen-lockfile', '--offline'], worktree);
  if (install.status !== 0) fail('pnpm install --frozen-lockfile --offline failed', install.output);
  log('pnpm install --frozen-lockfile --offline: exit 0 (no manifest or lockfile edit needed)');

  // 3. Unit tests and the production build.
  const unit = run('pnpm', ['--filter', 'web', 'test'], worktree);
  const unitSummary = unit.output.match(/Tests\s+[^\n]*passed[^\n]*/)?.[0]?.trim();
  if (unit.status !== 0) fail('pnpm --filter web test failed', unit.output);
  log(`pnpm --filter web test: exit 0 (${unitSummary ?? 'no summary'})`);

  const build = run('pnpm', ['--filter', 'web', 'build'], worktree, { NEXT_TELEMETRY_DISABLED: '1' });
  if (build.status !== 0) fail('pnpm --filter web build failed', build.output);
  const routeLines = build.output.split('\n').filter((line) => /[├└┌]\s/.test(line));
  if (routeLines.some((line) => /\s\/internal(\s|\/|$)/.test(line))) fail('the build still lists an /internal route', build.output);
  log(`pnpm --filter web build: exit 0, ${routeLines.length} route lines, none of them /internal`);

  // 4. The built app answers as the prototype.
  const startPort = await freePort();
  const started = start(['--filter', 'web', 'exec', 'next', 'start', '--port', String(startPort), '--hostname', '127.0.0.1'], worktree, {
    NEXT_TELEMETRY_DISABLED: '1',
  });
  servers.push(started);
  const appUrl = `http://127.0.0.1:${startPort}`;
  if ((await waitForHttp(`${appUrl}/`, 60_000)) === undefined) fail('next start did not answer', started.output());
  const answers = {};
  const unmatched = '/rollback-unmatched-probe';
  for (const route of ['/', '/campaigns', '/internal', unmatched]) {
    const response = await fetch(`${appUrl}${route}`, { redirect: 'manual' });
    answers[route] = { status: response.status, html: await response.text() };
  }
  const snippet = (route) => `${answers[route].html.slice(0, 600)}`;
  if (answers['/'].status !== 200 || answers['/campaigns'].status !== 200) {
    fail(`prototype pages did not answer 200: / ${answers['/'].status}, /campaigns ${answers['/campaigns'].status}`);
  }
  if (answers['/internal'].status !== 404) fail(`/internal answered ${answers['/internal'].status}, not 404`, snippet('/internal'));
  if (/data-app-state=|internal-build/.test(answers['/internal'].html)) fail('/internal still renders the internal page', snippet('/internal'));
  // /internal is now just another unmatched URL: the same answer as any other the prototype does not know.
  const shape = (html) => (html.match(/<title>[^<]*<\/title>/)?.[0] ?? '') + (html.match(/<html[^>]*>/)?.[0]?.replace(/\s(class|style)="[^"]*"/g, '') ?? '');
  if (answers[unmatched].status !== 404 || shape(answers['/internal'].html) !== shape(answers[unmatched].html)) {
    fail(
      `/internal does not answer like an unmatched prototype URL (${unmatched}: ${answers[unmatched].status})`,
      `/internal:
${snippet('/internal')}
${unmatched}:
${snippet(unmatched)}`,
    );
  }
  log(`next start: / 200, /campaigns 200, /internal 404 like any unmatched prototype URL (${shape(answers['/internal'].html)})`);
  started.stop();

  // 5. The M1 prototype suite.
  if (WITH_E2E) {
    const devPort = await freePort();
    const dev = start(['--filter', 'web', 'dev', '--port', String(devPort)], worktree, { NEXT_TELEMETRY_DISABLED: '1' });
    servers.push(dev);
    const devBase = `http://127.0.0.1:${devPort}`;
    if ((await waitForHttp(`${devBase}/`, 120_000)) === undefined) fail('next dev did not answer', dev.output());
    const routes = pageRoutes(path.join(worktree, 'apps/web/src/app'));
    for (const route of routes) await waitForHttp(`${devBase}${route}`, 120_000);
    log(`next dev warmed: ${routes.length} routes`);

    const suite = await runAsync('pnpm', ['--filter', 'web', 'e2e', '--grep-invert', REMOVED_ENTRY_TESTS], worktree, {
      WEB_PORT: String(devPort),
      CI: '',
    });
    const summary = suite.output
      .split('\n')
      .filter((line) => /^\s*\d+ (passed|skipped|failed|flaky)/.test(line))
      .map((line) => line.trim())
      .join(', ');
    if (suite.status !== 0) {
      const firstFailure = suite.output.slice(Math.max(0, suite.output.search(/^\s+1\) /m)), undefined).slice(0, 3000);
      fail(
        `the M1 prototype suite failed (${summary})`,
        [firstFailure, '----- next dev, last output -----', dev.output().slice(-3000)].join('\n'),
      );
    }
    log(`M1 prototype suite (apps/web playwright.config.ts, --grep-invert ${REMOVED_ENTRY_TESTS}): exit 0, ${summary}`);
    dev.stop();
  } else {
    log('M1 prototype suite not run (pass --e2e)');
  }
  log(`PASS on ${head}`);
} catch (error) {
  if (process.exitCode !== 1) {
    console.error(`rollback: FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
} finally {
  for (const server of servers) server.stop();
  if (added) run('git', ['worktree', 'remove', '--force', worktree], ROOT);
  // On Windows `git worktree remove` can deregister the worktree yet fail to delete it
  // ("Directory not empty"); with rmSync (10 retries) as the fallback the run then never
  // finished, the tree left in place (seen 2026-09-23), while `rd /s /q` removed the same
  // tree in 7 s.
  if (existsSync(worktree) && statSync(worktree).isDirectory()) {
    if (WINDOWS) spawnSync('cmd', ['/d', '/c', 'rd', '/s', '/q', worktree], { stdio: 'ignore' });
    else rmSync(worktree, { recursive: true, force: true });
  }
  if (existsSync(worktree)) console.error(`rollback: could not remove ${worktree}; delete it by hand`);
  run('git', ['worktree', 'prune'], ROOT);
  process.exit(process.exitCode ?? 0);
}
