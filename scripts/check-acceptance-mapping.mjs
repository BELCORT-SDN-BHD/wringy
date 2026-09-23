#!/usr/bin/env node
/**
 * `pnpm check:acceptance`: the acceptance-mapping check (验收映射; M2-AC01/3,
 * kickoff-package.md §2.2 and §10 G7, CI job `check`).
 *
 * Usage: node scripts/check-acceptance-mapping.mjs <ticket> [<ticket> ...]
 * where <ticket> names docs/planning/tickets/<ticket>.md (e.g. m2-01), the
 * ticket or tickets in progress.
 *
 * 0. Self-test, on every run: the same parsing and matching run over the
 *    fixtures in scripts/fixtures/acceptance-self-test/ (a ticket, a record, a
 *    Playwright --list report and a Vitest list, a file with runtime skips),
 *    whose verdicts are known: an untagged name, a sub-item whose only test is
 *    declared skipped, one whose only name is a longer number (M2-AC99/10 is
 *    not M2-AC99/1), and runtime skips must all be caught. If the check would
 *    pass what it must fail, it exits 1 before looking at the repository (the
 *    counterpart of depcruise's planted violation).
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
 *    would name them.
 *
 *    Skipped tests are no evidence. Declared skips are left out: `vitest list`
 *    omits `it.skip` (and an `it.skipIf(...)` that static parsing cannot
 *    evaluate, such as apps/api's SIGTERM test, so such a test is checked only
 *    where it is not skipped: keep the tag on its describe), and a Playwright
 *    spec is dropped when every one of its tests is expected to be skipped
 *    (`test.skip(title, fn)`, `test.describe.skip`, `test.fixme`). A skip made
 *    at run time cannot be seen by listing, so (c) below refuses the
 *    unconditional ones in the listed files instead.
 * 2. (a) Every full name must contain "M2-AC".
 * 3. (b) For each ticket named on the command line, every acceptance
 *    sub-item its file lists (`[M2-ACxx](...) / n`) must have at least one
 *    test whose full name contains "M2-ACxx/n", or a row in
 *    docs/m2-internal/acceptance-record.md whose first cell starts with
 *    "M2-ACxx/n" (manual evidence, including rows marked NOT EXECUTED: this
 *    checks the mapping, the record says whether it ran).
 * 4. (c) No listed test file skips a test unconditionally at run time: a
 *    Vitest context skip (`ctx.skip()`, `context.skip(...)`: any `<name>.skip(`
 *    other than it/test/describe/suite/bench) or a Playwright `test.skip()` /
 *    `test.fixme()` with no condition (or `true`). A conditional Playwright
 *    skip that scopes a test to one project (`test.skip(cond, reason)`) is
 *    allowed: the test runs in the other project.
 *
 * Prints a per-sub-item summary. Exit 0 only when the self-test and (a), (b)
 * and (c) hold.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RECORD = 'docs/m2-internal/acceptance-record.md';
const TAG = 'M2-AC';
const VITEST_CONFIG = /^vitest(\.int)?\.config\.(ts|mts|js|mjs)$/;
/** apps/web is the M1 prototype plus the internal build; only these parts of it are M2. */
const WEB_M2_VITEST_FILTERS = ['src/app/(internal)/', 'tests/unit/'];
const WEB_INTERNAL_PLAYWRIGHT_CONFIG = 'playwright.internal.config.ts';
const SELF_TEST_DIR = path.join(ROOT, 'scripts', 'fixtures', 'acceptance-self-test');

function fail(message) {
  console.error(`check:acceptance: FAIL: ${message}`);
  process.exit(1);
}

const relative = (file) => path.relative(ROOT, file).split(path.sep).join('/');

// --- Parsing and matching (shared by the self-test and the real run) --------

/** `M2-ACxx/n` for every acceptance line of a ticket's text. */
function subItemsOf(text) {
  const items = [...text.matchAll(/\[(M2-AC\d+)\]\([^)]*\)\s*\/\s*(\d+)/g)].map((match) => `${match[1]}/${match[2]}`);
  return [...new Set(items)];
}

/** First cells of a Markdown record's table rows, with emphasis and code marks removed. */
function recordRowsOf(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.startsWith('|'))
    .map((line) => ({ first: line.split('|')[1].trim().replace(/^[*`\s]+/, ''), line }));
}

/**
 * Full names from Playwright's JSON report of `--list`: describe titles, then
 * the test title (file and project left out). A spec whose every test is
 * expected to be skipped (declared test.skip, describe.skip, test.fixme) is
 * left out: it never runs, so it is no evidence.
 */
function namesFromPlaywrightReport(report, cwd) {
  // Spec files are reported relative to the config's test directory.
  const testDir = report.config?.rootDir ?? cwd;
  const names = [];
  const walk = (suite, chain, file) => {
    for (const spec of suite.specs ?? []) {
      const tests = spec.tests ?? [];
      if (tests.length > 0 && tests.every((test) => test.expectedStatus === 'skipped')) continue;
      names.push({ name: [...chain, spec.title].join(' > '), file: path.resolve(testDir, spec.file ?? file) });
    }
    for (const child of suite.suites ?? []) walk(child, [...chain, child.title], file);
  };
  // Top-level suites are files; their titles are not part of a test's name.
  for (const fileSuite of report.suites ?? []) walk(fileSuite, [], fileSuite.file ?? fileSuite.title);
  return names;
}

/** Vitest's test-context skip: `<name>.skip(` where <name> is not a declaration API. */
const CONTEXT_SKIP = /\b(?!(?:it|test|describe|suite|bench)\b)[A-Za-z_$][\w$]*\.skip\s*\(/;
/** Playwright's unconditional run-time skip or fixme: no argument, or `true`. */
const UNCONDITIONAL_PLAYWRIGHT_SKIP = /\btest\.(?:skip|fixme)\s*\(\s*(?:\)|true\b)/;

/** Unconditional run-time skips in one test file's source: [{ file, line, text }]. */
function runtimeSkipsIn(file, text) {
  const found = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const code = line.replace(/\/\/.*$/, '');
    if (CONTEXT_SKIP.test(code) || UNCONDITIONAL_PLAYWRIGHT_SKIP.test(code)) {
      found.push({ file, line: index + 1, text: line.trim() });
    }
  });
  return found;
}

/** True when `text` names `subItem` and not a longer number (M2-AC01/1 is not M2-AC01/10). */
function names(text, subItem) {
  const at = text.indexOf(subItem);
  if (at < 0) return false;
  const next = text[at + subItem.length];
  return next === undefined || !/\d/.test(next);
}

/** The verdicts (a), (b) and (c) for `tests`, record `rows`, sub-items per ticket and run-time skips. */
function evaluate({ tests, rows, subItemsByTicket, runtimeSkips }) {
  const untagged = tests.filter((test) => !test.name.includes(TAG));
  const tickets = [...subItemsByTicket].map(([ticket, subItems]) => ({
    ticket,
    items: subItems.map((subItem) => {
      const count = tests.filter((test) => names(test.name, subItem)).length;
      const manual = rows.filter((row) => row.first.startsWith(subItem) && names(row.first, subItem));
      const notExecuted = manual.filter((row) => row.line.includes('NOT EXECUTED')).length;
      return { subItem, tests: count, manual: manual.length, notExecuted, mapped: count > 0 || manual.length > 0 };
    }),
  }));
  const ok =
    untagged.length === 0 && runtimeSkips.length === 0 && tickets.every(({ items }) => items.every((item) => item.mapped));
  return { untagged, tickets, runtimeSkips, ok };
}

// --- 0. Self-test ------------------------------------------------------------

function selfTest() {
  const read = (name) => readFileSync(path.join(SELF_TEST_DIR, name), 'utf8');
  const playwright = namesFromPlaywrightReport(JSON.parse(read('playwright-list.json')), SELF_TEST_DIR);
  const vitest = JSON.parse(read('vitest-list.json')).map((test) => ({
    name: test.name,
    file: path.join(SELF_TEST_DIR, test.file),
  }));
  const skipFile = path.join(SELF_TEST_DIR, 'runtime-skip.fixture.txt');
  const verdict = evaluate({
    tests: [...playwright, ...vitest],
    rows: recordRowsOf(read('record.md')),
    subItemsByTicket: new Map([['self-test', subItemsOf(read('ticket.md'))]]),
    runtimeSkips: runtimeSkipsIn(skipFile, readFileSync(skipFile, 'utf8')),
  });

  const got = {
    ok: verdict.ok,
    untagged: verdict.untagged.map((test) => test.name),
    mapped: Object.fromEntries(verdict.tickets[0].items.map((item) => [item.subItem, item.mapped])),
    runtimeSkipLines: verdict.runtimeSkips.map((skip) => skip.line),
  };
  const want = {
    ok: false,
    untagged: ['an untagged name'],
    mapped: {
      // Its only name is M2-AC99/10's: a longer number is not a match.
      'M2-AC99/1': false,
      // Its only test is declared test.skip (every project): no evidence.
      'M2-AC99/2': false,
      // Runs in one project and is skipped in the other: evidence.
      'M2-AC99/3': true,
      // Listed, but its file skips at run time: caught by (c) instead.
      'M2-AC99/4': true,
      // A manual-evidence row only.
      'M2-AC99/5': true,
      // Its only test is test.fixme: no evidence.
      'M2-AC99/6': false,
      'M2-AC99/10': true,
    },
    // ctx.skip() and test.fixme() in runtime-skip.fixture.txt; the conditional test.skip is allowed.
    runtimeSkipLines: [4, 8],
  };
  if (!isDeepStrictEqual(got, want)) {
    fail(
      `self-test: the check's verdicts on scripts/fixtures/acceptance-self-test/ differ from the known ones, so it ` +
        `could pass what it must fail.\n  expected ${JSON.stringify(want)}\n  got      ${JSON.stringify(got)}`,
    );
  }
  console.log(
    'check:acceptance: self-test passed (an untagged name, a declared skip, a fixme, M2-AC99/10 versus /1 and two ' +
      'run-time skips were all caught)',
  );
}

// --- 1. The repository ---------------------------------------------------------

const tickets = process.argv.slice(2);
if (tickets.length === 0) fail('name the ticket(s) in progress, e.g. `node scripts/check-acceptance-mapping.mjs m2-01`');

selfTest();

/** The bin script of `pkg` as resolved from workspace `dir` (pnpm keeps each workspace's own node_modules). */
function binOf(dir, pkg, bin) {
  const manifestPath = createRequire(path.join(ROOT, dir, 'package.json')).resolve(`${pkg}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const binPath = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[bin];
  if (!binPath) fail(`${pkg} (from ${dir}) declares no "${bin}" bin`);
  return path.join(path.dirname(manifestPath), binPath);
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

/** Full names from `playwright test --list --reporter=json`, declared skips left out. */
function playwrightNames(source, outFile) {
  const cwd = path.join(ROOT, source.dir);
  const args = [binOf(source.dir, '@playwright/test', 'playwright'), 'test', '-c', source.config, '--list', '--reporter=json'];
  const result = run(args, cwd, { PLAYWRIGHT_JSON_OUTPUT_FILE: outFile });
  if (result.status !== 0 || !existsSync(outFile)) {
    fail(`playwright --list in ${source.dir} (${source.config}) exited ${result.status}\n${result.stderr || result.stdout}`);
  }
  return namesFromPlaywrightReport(JSON.parse(readFileSync(outFile, 'utf8')), cwd);
}

/** `M2-ACxx/n` for every acceptance line of the ticket file. */
function ticketSubItems(ticket) {
  const file = path.join(ROOT, 'docs', 'planning', 'tickets', `${ticket}.md`);
  if (!existsSync(file)) fail(`no ticket file docs/planning/tickets/${ticket}.md`);
  const items = subItemsOf(readFileSync(file, 'utf8'));
  if (items.length === 0) fail(`docs/planning/tickets/${ticket}.md lists no "[M2-ACxx](...) / n" acceptance line`);
  return items;
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
        : `${source.dir} ${source.config} (--list, declared skips left out)`;
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
const testFiles = [...new Set(allTests.map((test) => test.file))].sort();

console.log(`check:acceptance: ${allTests.length} distinct test names from ${collected.length} sources`);
for (const { label, tests } of collected) console.log(`  ${String(tests.length).padStart(4)}  ${label}`);

const verdict = evaluate({
  tests: allTests,
  rows: existsSync(path.join(ROOT, RECORD)) ? recordRowsOf(readFileSync(path.join(ROOT, RECORD), 'utf8')) : [],
  subItemsByTicket: new Map(tickets.map((ticket) => [ticket, ticketSubItems(ticket)])),
  runtimeSkips: testFiles.flatMap((file) => (existsSync(file) ? runtimeSkipsIn(file, readFileSync(file, 'utf8')) : [])),
});

// (a) Every M2 test name carries an acceptance ID.
if (verdict.untagged.length > 0) {
  console.log(`\n(a) FAIL: ${verdict.untagged.length} test name(s) without "${TAG}":`);
  for (const test of verdict.untagged) console.log(`    ${relative(test.file)}: ${test.name}`);
} else {
  console.log(`\n(a) OK: all ${allTests.length} names carry "${TAG}"`);
}

// (b) Every sub-item of the tickets in progress maps to a test or a manual-evidence row.
for (const { ticket, items } of verdict.tickets) {
  console.log(`\n(b) ${ticket}:`);
  for (const item of items) {
    console.log(
      `    ${item.subItem.padEnd(10)} tests ${String(item.tests).padStart(4)}   record rows ${String(item.manual).padStart(3)}` +
        `${item.notExecuted ? ` (${item.notExecuted} NOT EXECUTED)` : ''}   ${item.mapped ? 'OK' : `FAIL: no test name contains "${item.subItem}" and no ${RECORD} row starts with it`}`,
    );
  }
}

// (c) No listed test file skips a test unconditionally at run time.
if (verdict.runtimeSkips.length > 0) {
  console.log(`\n(c) FAIL: ${verdict.runtimeSkips.length} unconditional run-time skip(s) that listing cannot see:`);
  for (const skip of verdict.runtimeSkips) console.log(`    ${relative(skip.file)}:${skip.line}: ${skip.text}`);
} else {
  console.log(`\n(c) OK: no unconditional run-time skip in the ${testFiles.length} listed test files`);
}

console.log(verdict.ok ? '\ncheck:acceptance: PASS' : '\ncheck:acceptance: FAIL');
process.exit(verdict.ok ? 0 : 1);
