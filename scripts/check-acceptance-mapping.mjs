#!/usr/bin/env node
/**
 * `pnpm check:acceptance`: the acceptance-mapping check (验收映射; M2-AC01/3,
 * kickoff-package.md §2.2 and §10 G7, CI job `check`).
 *
 * Usage: node scripts/check-acceptance-mapping.mjs <ticket> [<ticket> ...]
 * where <ticket> names docs/planning/tickets/<ticket>.md (e.g. m2-01), the
 * ticket or tickets in progress.
 *
 * 1. Collects the FULL name of every M2 test: the describe chain plus the
 *    test title, joined with " > " (orchestrator ruling R1: the rule applies
 *    to the full name, not to each it() string). Sources:
 *    - Vitest, every config of every workspace under packages/* and apps/*
 *      except apps/web (`vitest list --json`);
 *    - apps/web's Vitest suite limited to its M2 files, src/app/(internal)/
 *      and tests/unit/ (the rest is the M1 demo, named by P-row);
 *    - apps/web's internal Playwright suite (playwright.internal.config.ts,
 *      `playwright test --list --reporter=json`); the M1 suite is not M2.
 *    A `vitest.int.config.*` is listed with `--staticParse`: Vitest 4.1's
 *    `list` runs the config's globalSetup, which here starts or attaches to a
 *    PostgreSQL cluster (with TEST_DATABASE_URL pointing at a closed port,
 *    `vitest list` failed with ECONNREFUSED), and the CI `check` job has no
 *    database. Static parsing reads the titles from the source without
 *    running the files; a title built at run time (`it.each`, a template
 *    literal) keeps its placeholder, and the describe chain still counts.
 *    The other configs are collected by running the files, as `vitest run`
 *    would name them. Either way `vitest list` leaves out tests it sees as
 *    skipped (`it.skip`, and an `it.skipIf(...)` that static parsing cannot
 *    evaluate, such as apps/api's SIGTERM test), so such a test is checked
 *    only where it is not skipped; keep the tag on its describe.
 * 2. (a) Every full name must contain "M2-AC".
 * 3. (b) For each ticket named on the command line, every acceptance
 *    sub-item its file lists (`[M2-ACxx](...) / n`) must have at least one
 *    test whose full name contains "M2-ACxx/n", or a row in
 *    docs/m2-internal/acceptance-record.md whose first cell starts with
 *    "M2-ACxx/n" (manual evidence, including rows marked NOT EXECUTED: this
 *    checks the mapping, the record says whether it ran).
 *
 * Prints a per-sub-item summary. Exit 0 only when (a) and (b) hold.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RECORD = 'docs/m2-internal/acceptance-record.md';
const TAG = 'M2-AC';
const VITEST_CONFIG = /^vitest(\.int)?\.config\.(ts|mts|js|mjs)$/;
/** apps/web is the M1 prototype plus the internal build; only these parts of it are M2. */
const WEB_M2_VITEST_FILTERS = ['src/app/(internal)/', 'tests/unit/'];
const WEB_INTERNAL_PLAYWRIGHT_CONFIG = 'playwright.internal.config.ts';

function fail(message) {
  console.error(`check:acceptance: FAIL: ${message}`);
  process.exit(1);
}

const tickets = process.argv.slice(2);
if (tickets.length === 0) fail('name the ticket(s) in progress, e.g. `node scripts/check-acceptance-mapping.mjs m2-01`');

/** The bin script of `pkg` as resolved from workspace `dir` (pnpm keeps each workspace's own node_modules). */
function binOf(dir, pkg, bin) {
  const manifestPath = createRequire(path.join(ROOT, dir, 'package.json')).resolve(`${pkg}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const relative = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[bin];
  if (!relative) fail(`${pkg} (from ${dir}) declares no "${bin}" bin`);
  return path.join(path.dirname(manifestPath), relative);
}

/** Workspaces whose whole Vitest suite is M2: packages/* and apps/* except apps/web. */
function m2Workspaces() {
  return ['packages', 'apps'].flatMap((group) =>
    readdirSync(path.join(ROOT, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(path.join(ROOT, group, entry.name, 'package.json')))
      .map((entry) => `${group}/${entry.name}`)
      .filter((dir) => dir !== 'apps/web'),
  );
}

function sources() {
  const list = [];
  for (const dir of m2Workspaces()) {
    for (const config of readdirSync(path.join(ROOT, dir)).filter((name) => VITEST_CONFIG.test(name)).sort()) {
      list.push({ kind: 'vitest', dir, config, staticParse: config.startsWith('vitest.int.'), filters: [] });
    }
  }
  list.push({ kind: 'vitest', dir: 'apps/web', config: 'vitest.config.mts', staticParse: false, filters: WEB_M2_VITEST_FILTERS });
  list.push({ kind: 'playwright', dir: 'apps/web', config: WEB_INTERNAL_PLAYWRIGHT_CONFIG });
  return list;
}

function run(args, cwd, env = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

/** Full names ("describe > ... > title") from `vitest list --json`. */
function vitestNames(source, outFile) {
  const cwd = path.join(ROOT, source.dir);
  const args = [binOf(source.dir, 'vitest', 'vitest'), 'list', '--config', source.config, `--json=${outFile}`];
  if (source.staticParse) args.push('--staticParse');
  args.push(...source.filters);
  const result = run(args, cwd);
  if (result.status !== 0 || !existsSync(outFile)) {
    fail(`vitest list in ${source.dir} (${source.config}) exited ${result.status}\n${result.stderr || result.stdout}`);
  }
  return JSON.parse(readFileSync(outFile, 'utf8')).map((test) => ({ name: test.name, file: test.file }));
}

/** Full names from Playwright's JSON report of `--list`: describe titles, then the test title (file and project left out). */
function playwrightNames(source, outFile) {
  const cwd = path.join(ROOT, source.dir);
  const args = [binOf(source.dir, '@playwright/test', 'playwright'), 'test', '-c', source.config, '--list', '--reporter=json'];
  const result = run(args, cwd, { PLAYWRIGHT_JSON_OUTPUT_FILE: outFile });
  if (result.status !== 0 || !existsSync(outFile)) {
    fail(`playwright --list in ${source.dir} (${source.config}) exited ${result.status}\n${result.stderr || result.stdout}`);
  }
  const report = JSON.parse(readFileSync(outFile, 'utf8'));
  // Spec files are reported relative to the config's test directory.
  const testDir = report.config?.rootDir ?? cwd;
  const names = [];
  const walk = (suite, chain, file) => {
    for (const spec of suite.specs ?? []) {
      names.push({ name: [...chain, spec.title].join(' > '), file: path.resolve(testDir, spec.file ?? file) });
    }
    for (const child of suite.suites ?? []) walk(child, [...chain, child.title], file);
  };
  // Top-level suites are files; their titles are not part of a test's name.
  for (const fileSuite of report.suites ?? []) walk(fileSuite, [], fileSuite.file ?? fileSuite.title);
  return names;
}

/** `M2-ACxx/n` for every acceptance line of the ticket file. */
function ticketSubItems(ticket) {
  const file = path.join(ROOT, 'docs', 'planning', 'tickets', `${ticket}.md`);
  if (!existsSync(file)) fail(`no ticket file docs/planning/tickets/${ticket}.md`);
  const items = [...readFileSync(file, 'utf8').matchAll(/\[(M2-AC\d+)\]\([^)]*\)\s*\/\s*(\d+)/g)].map(
    (match) => `${match[1]}/${match[2]}`,
  );
  if (items.length === 0) fail(`docs/planning/tickets/${ticket}.md lists no "[M2-ACxx](...) / n" acceptance line`);
  return [...new Set(items)];
}

/** First cells of the record's table rows, with Markdown emphasis and code marks removed. */
function recordRows() {
  const file = path.join(ROOT, RECORD);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.startsWith('|'))
    .map((line) => ({ first: line.split('|')[1].trim().replace(/^[*`\s]+/, ''), line }));
}

/** True when `text` names `subItem` and not a longer number (M2-AC01/1 is not M2-AC01/10). */
function names(text, subItem) {
  const at = text.indexOf(subItem);
  if (at < 0) return false;
  const next = text[at + subItem.length];
  return next === undefined || !/\d/.test(next);
}

const temp = mkdtempSync(path.join(tmpdir(), 'wringy-acceptance-'));
let collected;
try {
  collected = sources().map((source, index) => {
    const outFile = path.join(temp, `${index}.json`);
    const tests = source.kind === 'vitest' ? vitestNames(source, outFile) : playwrightNames(source, outFile);
    const label =
      source.kind === 'vitest'
        ? `${source.dir} ${source.config}${source.staticParse ? ' (static parse)' : ''}${source.filters.length ? ` [${source.filters.join(', ')}]` : ''}`
        : `${source.dir} ${source.config} (--list)`;
    return { label, tests };
  });
} finally {
  rmSync(temp, { recursive: true, force: true });
}

// Playwright lists a test once per project; a name counts once per file.
const unique = new Map();
for (const { tests } of collected) {
  for (const test of tests) unique.set(`${test.file}\u0000${test.name}`, test);
}
const allTests = [...unique.values()];

console.log(`check:acceptance: ${allTests.length} distinct test names from ${collected.length} sources`);
for (const { label, tests } of collected) console.log(`  ${String(tests.length).padStart(4)}  ${label}`);

let ok = true;

// (a) Every M2 test name carries an acceptance ID.
const untagged = allTests.filter((test) => !test.name.includes(TAG));
if (untagged.length > 0) {
  ok = false;
  console.log(`\n(a) FAIL: ${untagged.length} test name(s) without "${TAG}":`);
  for (const test of untagged) console.log(`    ${path.relative(ROOT, test.file).split(path.sep).join('/')}: ${test.name}`);
} else {
  console.log(`\n(a) OK: all ${allTests.length} names carry "${TAG}"`);
}

// (b) Every sub-item of the tickets in progress maps to a test or a manual-evidence row.
const rows = recordRows();
for (const ticket of tickets) {
  console.log(`\n(b) ${ticket}:`);
  for (const subItem of ticketSubItems(ticket)) {
    const tests = allTests.filter((test) => names(test.name, subItem)).length;
    const manual = rows.filter((row) => row.first.startsWith(subItem) && names(row.first, subItem));
    const notExecuted = manual.filter((row) => row.line.includes('NOT EXECUTED')).length;
    const mapped = tests > 0 || manual.length > 0;
    if (!mapped) ok = false;
    console.log(
      `    ${subItem.padEnd(10)} tests ${String(tests).padStart(4)}   record rows ${String(manual.length).padStart(3)}` +
        `${notExecuted ? ` (${notExecuted} NOT EXECUTED)` : ''}   ${mapped ? 'OK' : `FAIL: no test name contains "${subItem}" and no ${RECORD} row starts with it`}`,
    );
  }
}

console.log(ok ? '\ncheck:acceptance: PASS' : '\ncheck:acceptance: FAIL');
process.exit(ok ? 0 : 1);
