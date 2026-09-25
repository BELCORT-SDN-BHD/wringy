#!/usr/bin/env node
/**
 * `pnpm canary`: the secret canary (M2-AC01/2 part 4, "浏览器包和日志不含密钥";
 * kickoff-package.md §8.5 "Secrets", §8.8 `check` job).
 *
 * 1. Coverage. Every variable the five process env schemas in @wringy/config
 *    read (web, api, worker, migrate, bootstrap), plus TEST_DATABASE_URL, gets a
 *    distinct canary value below. The script asks @wringy/config for the
 *    schemas' variable names and FAILS if one has no canary, so a new variable
 *    cannot slip past. Secret-bearing variables carry canary passwords inside
 *    realistic values (postgres URLs with the password in them); the others
 *    carry canary values too, so an accidental inlining of any of them shows.
 *    Enum-valued variables (WRINGY_ENV, WRINGY_APP_MODE, SESSION_LIVENESS) are
 *    set to a value their schema accepts and searched for nothing: their whole
 *    value space is public. Every canary value must satisfy its zod shape, or the
 *    api refuses to start and step 4 fails on the empty log.
 * 2. Builds, with every canary in the environment: `pnpm --filter web build`
 *    (API_INTERNAL_URL is a canary URL), `pnpm --filter api build`,
 *    `pnpm --filter worker build`.
 * 3. Artefacts. Searches every file under apps/web/.next/static (what the
 *    browser downloads), apps/web/.next/server (server chunks may name a
 *    variable, never hold its value), the rest of apps/web/.next (cache
 *    excluded), apps/api/dist and apps/worker/dist for every canary VALUE.
 *    Variable NAMES found are reported for information only.
 * 4. Logs. Starts the built api (`node dist/main.js`) and worker against an
 *    unreachable database whose URL carries the canary password, captures
 *    stdout and stderr for ~10 s while both retry the connection, stops them,
 *    and searches the captured text for every canary value.
 * 5. Self-test. Before trusting a clean result, the scanner must find a canary
 *    planted in a temporary file.
 *
 * Exit 0 only when nothing leaked. A hit prints the file (or log) and the
 * variable NAME with the value's first 4 characters, never the value.
 *
 * The canary values are fixed, random-looking strings generated once for this
 * script; they are not secrets and open nothing.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOG_CAPTURE_MS = 10_000;

// --- Canary values (fixed; generated once) ---------------------------------------
const CANARY_API_DB_PASSWORD = 'k7QmZ2vR9xTf4LpW8nHc';
const CANARY_WORKER_DB_PASSWORD = 'u3YbN6sJ1dKq9GzE5rVa';
const CANARY_MIGRATOR_PASSWORD = 'p8WcX4hM2tRj7FnB1yQe';
const CANARY_ADMIN_PASSWORD = 'f5LzA9gD3kSv6PmT2wUx';
const CANARY_BOOTSTRAP_MIGRATOR_PASSWORD = 'r1HnC8qW5eYb3JxK7tGd';
const CANARY_BOOTSTRAP_API_PASSWORD = 'm6VsE2zP9aLc4NwR8fTh';
const CANARY_BOOTSTRAP_WORKER_PASSWORD = 'b9TgU3kF7mXq1DyH5sZn';
const CANARY_TEST_ADMIN_PASSWORD = 'z2NeR6wB4jVp8KcM3xLa';
const CANARY_API_HOST = 'api-q4Wm8Tz2Kx.invalid';
const CANARY_WORKER_ID = 'worker-c5Nh9Rj3Vb';
const CANARY_IMAGE_REF = 'canary/wringy-worker:h7Kx2Pq9Lm';
const CANARY_DATABASE = 'wringy_g8Fd3Zs6Qy';
const CANARY_BOOTSTRAP_DATABASE = 'wringy_v4Tb7Jm2Hc';
// M2-02: the Supabase project origin, the publishable key and the web origin.
// The values satisfy @wringy/config's originSchema and publishableKeySchema, so
// the web and api really start with them (checkCoverage would not catch a value
// the schema rejects; a refusing api writes no log line and fails this script).
const CANARY_SUPABASE_HOST = 'supabase-w9Kd4Rt7Zx.invalid';
const CANARY_PUBLISHABLE_KEY = 'sb_publishable_n2Qv8Bm5Hy3Ldk';
const CANARY_APP_HOST = 'app-t6Jz3Wq8Nc.invalid';

/** Filled in with a port on 127.0.0.1 that nothing listens on, before anything starts. */
let deadPort = 1;
const dbUrl = (user, password, database = CANARY_DATABASE) => `postgres://${user}:${password}@127.0.0.1:${deadPort}/${database}`;

/**
 * Every variable, its canary environment value, and the canary strings a leak
 * of it would show (a URL's password, or the value itself). `for` names which
 * process reads it.
 */
function canaries() {
  return [
    { name: 'WRINGY_ENV', value: 'ci', needles: [], for: 'all' },
    { name: 'API_INTERNAL_URL', value: `http://${CANARY_API_HOST}:3200`, needles: [CANARY_API_HOST], for: 'web' },
    // Enum-valued variables carry no needle, like WRINGY_ENV: their whole value
    // space is public (`demo|internal`, `database|auth_server`), so a "leak" of
    // one would be a word, not a secret. They are still set here, with a value
    // the schema accepts, so the builds and the processes run the internal path.
    { name: 'WRINGY_APP_MODE', value: 'internal', needles: [], for: 'web' },
    { name: 'SESSION_LIVENESS', value: 'auth_server', needles: [], for: 'api' },
    // The publishable key is publishable by design; it is still searched for,
    // because M2-02 reads it on the server only and it must not reach the bundle.
    { name: 'SUPABASE_URL', value: `https://${CANARY_SUPABASE_HOST}`, needles: [CANARY_SUPABASE_HOST], for: 'web, api' },
    { name: 'SUPABASE_PUBLISHABLE_KEY', value: CANARY_PUBLISHABLE_KEY, needles: [CANARY_PUBLISHABLE_KEY], for: 'web, api' },
    { name: 'APP_ORIGIN', value: `https://${CANARY_APP_HOST}`, needles: [CANARY_APP_HOST], for: 'web' },
    // DATABASE_URL: one name, two logins; the api and the worker each get their own canary password.
    { name: 'DATABASE_URL', value: dbUrl('wringy_api_login', CANARY_API_DB_PASSWORD), needles: [CANARY_API_DB_PASSWORD, CANARY_DATABASE], for: 'api' },
    { name: 'DATABASE_URL (worker)', env: 'DATABASE_URL', value: dbUrl('wringy_worker_login', CANARY_WORKER_DB_PASSWORD), needles: [CANARY_WORKER_DB_PASSWORD], for: 'worker' },
    { name: 'PORT', value: '3279', needles: [], for: 'api' },
    { name: 'HOST', value: '127.0.0.1', needles: [], for: 'api' },
    { name: 'LOG_LEVEL', value: 'debug', needles: [], for: 'api, worker' },
    { name: 'WORKER_ID', value: CANARY_WORKER_ID, needles: [], for: 'worker' },
    { name: 'IMAGE_REF', value: CANARY_IMAGE_REF, needles: [], for: 'worker' },
    { name: 'DATABASE_URL_MIGRATOR', value: dbUrl('wringy_migrator', CANARY_MIGRATOR_PASSWORD), needles: [CANARY_MIGRATOR_PASSWORD], for: 'migrate' },
    { name: 'PG_BOOTSTRAP_ADMIN_URL', value: dbUrl('postgres', CANARY_ADMIN_PASSWORD, 'postgres'), needles: [CANARY_ADMIN_PASSWORD], for: 'bootstrap' },
    { name: 'PG_BOOTSTRAP_DATABASE', value: CANARY_BOOTSTRAP_DATABASE, needles: [CANARY_BOOTSTRAP_DATABASE], for: 'bootstrap' },
    { name: 'PG_BOOTSTRAP_MIGRATOR_PASSWORD', value: CANARY_BOOTSTRAP_MIGRATOR_PASSWORD, needles: [CANARY_BOOTSTRAP_MIGRATOR_PASSWORD], for: 'bootstrap' },
    { name: 'PG_BOOTSTRAP_API_PASSWORD', value: CANARY_BOOTSTRAP_API_PASSWORD, needles: [CANARY_BOOTSTRAP_API_PASSWORD], for: 'bootstrap' },
    { name: 'PG_BOOTSTRAP_WORKER_PASSWORD', value: CANARY_BOOTSTRAP_WORKER_PASSWORD, needles: [CANARY_BOOTSTRAP_WORKER_PASSWORD], for: 'bootstrap' },
    { name: 'TEST_DATABASE_URL', value: dbUrl('postgres', CANARY_TEST_ADMIN_PASSWORD, 'postgres'), needles: [CANARY_TEST_ADMIN_PASSWORD], for: 'tests' },
  ];
}

/** Worker-only values never searched as the worker's own identity in its own logs. */
const WORKER_IDENTITY = new Set([CANARY_WORKER_ID, CANARY_IMAGE_REF]);

/**
 * Variables whose value space is a public enum, so neither the value nor a
 * mention of the NAME says anything. They carry no needle and are left out of
 * the informational name report (a build legitimately inlines the mode).
 */
const PUBLIC_ENUM_VARIABLES = new Set(['WRINGY_ENV', 'WRINGY_APP_MODE', 'SESSION_LIVENESS']);

/** The environment for a build or a process: every canary, with DATABASE_URL set for `role`. */
function canaryEnv(role) {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
  for (const canary of canaries()) {
    if (canary.env === 'DATABASE_URL') continue;
    env[canary.name] = canary.value;
  }
  if (role === 'worker') env.DATABASE_URL = canaries().find((canary) => canary.env === 'DATABASE_URL').value;
  return env;
}

/** Every searchable canary string with the variable it stands for. */
function needles() {
  return canaries().flatMap((canary) => canary.needles.map((needle) => ({ variable: canary.name, needle })));
}

const preview = (value) => `${value.slice(0, 4)}…`;

function fail(message) {
  console.error(`canary: FAIL: ${message}`);
  process.exit(1);
}

/**
 * Runs one shell command line (plain tokens only: no quoting is needed or done)
 * from the repository root, quietly; on failure prints the tail with every
 * canary value masked, and stops.
 */
function run(label, commandLine, options = {}) {
  const started = Date.now();
  const result = spawnSync(commandLine, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', shell: true, ...options });
  if (result.status !== 0) {
    let tail = `${result.stdout ?? ''}${result.stderr ?? ''}`.split('\n').slice(-30).join('\n');
    for (const { needle } of needles()) tail = tail.split(needle).join(`${preview(needle)}[canary]`);
    console.error(tail);
    fail(`${label} exited ${result.status}`);
  }
  console.log(`canary: ${label}: ok in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  return result;
}

// --- 1. Coverage --------------------------------------------------------------------
function schemaVariables() {
  // tsx comes from @wringy/db's devDependencies; scripts/env-schema-names.mts imports the schemas' source.
  const result = run('reading the env schemas from @wringy/config', 'pnpm --filter @wringy/db exec tsx ../../scripts/env-schema-names.mts');
  return JSON.parse(result.stdout.trim().split('\n').pop());
}

function checkCoverage() {
  const bySchema = schemaVariables();
  const covered = new Set(canaries().map((canary) => canary.env ?? canary.name));
  const missing = [];
  for (const [schema, names] of Object.entries(bySchema)) {
    for (const name of names) if (!covered.has(name)) missing.push(`${schema}.${name}`);
  }
  if (missing.length > 0) fail(`no canary for ${missing.join(', ')}; add one to scripts/check-secret-canary.mjs`);
  const total = new Set(Object.values(bySchema).flat()).size;
  console.log(`canary: coverage: ${total} variables across ${Object.keys(bySchema).join(', ')} all carry a canary (plus TEST_DATABASE_URL)`);
}

// --- 3. Artefacts -------------------------------------------------------------------
function* filesUnder(dir, skip = () => false) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (skip(full)) continue;
    if (entry.isDirectory()) yield* filesUnder(full, skip);
    else if (entry.isFile()) yield full;
  }
}

/** Searches every file for every canary value; returns hits and the variable NAMES seen. */
function scan(files) {
  const hits = [];
  const namesSeen = new Map();
  // A whole-word match, so PORT does not count inside EXPORT or HOST inside LOCALHOST.
  const variableNames = [...new Set(canaries().map((canary) => canary.env ?? canary.name))]
    .filter((name) => !PUBLIC_ENUM_VARIABLES.has(name))
    .map((name) => ({ name, pattern: new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`) }));
  let count = 0;
  for (const file of files) {
    count += 1;
    const buffer = readFileSync(file);
    for (const { variable, needle } of needles()) {
      if (buffer.includes(needle)) hits.push({ file: path.relative(ROOT, file), variable, needle });
    }
    const text = buffer.toString('latin1');
    for (const { name, pattern } of variableNames) {
      if (pattern.test(text)) namesSeen.set(name, (namesSeen.get(name) ?? 0) + 1);
    }
  }
  return { hits, namesSeen, count };
}

function report(label, { hits, namesSeen, count }) {
  const names = [...namesSeen.entries()].map(([name, files]) => `${name}×${files}`).join(', ') || 'none';
  console.log(`canary: ${label}: ${count} files, canary values found: ${hits.length}; variable names referenced (information only): ${names}`);
  for (const hit of hits) console.error(`canary: LEAK in ${hit.file}: ${hit.variable} (value starts ${preview(hit.needle)})`);
  return hits.length;
}

function selfTest() {
  const dir = mkdtempSync(path.join(tmpdir(), 'wringy-canary-'));
  try {
    const planted = path.join(dir, 'planted.js');
    writeFileSync(planted, `const leaked = "${CANARY_API_DB_PASSWORD}";\n`);
    const { hits } = scan([planted]);
    if (!hits.some((hit) => hit.variable === 'DATABASE_URL')) fail('self-test: the scanner did not find a planted canary');
    console.log(`canary: self-test: a planted DATABASE_URL canary was found (${hits.length} hit)`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- 4. Logs ------------------------------------------------------------------------
function closedPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function captureProcess(role) {
  return new Promise((resolve) => {
    const cwd = path.join(ROOT, 'apps', role);
    const child = spawn(process.execPath, ['dist/main.js'], { cwd, env: canaryEnv(role), stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    child.stdout.on('data', (chunk) => (text += chunk));
    child.stderr.on('data', (chunk) => (text += chunk));
    let exitCode = null;
    child.on('exit', (code) => (exitCode = code));
    setTimeout(() => {
      if (exitCode === null) child.kill();
      setTimeout(() => resolve({ role, text, exitCode, lines: text.split('\n').filter(Boolean).length }), 500);
    }, LOG_CAPTURE_MS);
  });
}

function scanLog({ role, text, lines, exitCode }) {
  const hits = [];
  for (const { variable, needle } of needles()) {
    if (role === 'worker' && WORKER_IDENTITY.has(needle)) continue;
    if (text.includes(needle)) hits.push({ variable, needle });
  }
  console.log(
    `canary: ${role} log: ${lines} lines in ${LOG_CAPTURE_MS / 1000} s (${exitCode === null ? 'still retrying, stopped' : `exited ${exitCode}`}), canary values found: ${hits.length}`,
  );
  for (const hit of hits) console.error(`canary: LEAK in the ${role} log: ${hit.variable} (value starts ${preview(hit.needle)})`);
  if (lines === 0) fail(`the ${role} wrote no log line, so its log proves nothing`);
  return hits.length;
}

// --- main ---------------------------------------------------------------------------
deadPort = await closedPort();
selfTest();
checkCoverage();

run('pnpm --filter web build (canary environment)', 'pnpm --filter web build', { env: canaryEnv('api') });
run('pnpm --filter api build (canary environment)', 'pnpm --filter api build', { env: canaryEnv('api') });
run('pnpm --filter worker build (canary environment)', 'pnpm --filter worker build', { env: canaryEnv('worker') });

const NEXT_DIR = path.join(ROOT, 'apps', 'web', '.next');
const STATIC_DIR = path.join(NEXT_DIR, 'static');
const SERVER_DIR = path.join(NEXT_DIR, 'server');
if (!existsSync(STATIC_DIR) || statSync(STATIC_DIR).isFile()) fail('apps/web/.next/static is missing after the build');

let leaks = 0;
leaks += report('apps/web/.next/static (browser bundle)', scan(filesUnder(STATIC_DIR)));
leaks += report('apps/web/.next/server (server chunks)', scan(filesUnder(SERVER_DIR)));
leaks += report(
  'apps/web/.next (other build output, cache excluded)',
  scan(filesUnder(NEXT_DIR, (full) => [STATIC_DIR, SERVER_DIR, path.join(NEXT_DIR, 'cache'), path.join(NEXT_DIR, 'dev')].includes(full))),
);
leaks += report('apps/api/dist', scan(filesUnder(path.join(ROOT, 'apps', 'api', 'dist'))));
leaks += report('apps/worker/dist', scan(filesUnder(path.join(ROOT, 'apps', 'worker', 'dist'))));

console.log(`canary: starting the built api and worker against 127.0.0.1:${deadPort} (nothing listens) for ${LOG_CAPTURE_MS / 1000} s`);
const logs = await Promise.all([captureProcess('api'), captureProcess('worker')]);
for (const log of logs) leaks += scanLog(log);

if (leaks > 0) fail(`${leaks} canary value(s) leaked`);
console.log('canary: PASS: no canary value in the browser bundle, the server build, the api and worker bundles, or their logs');
