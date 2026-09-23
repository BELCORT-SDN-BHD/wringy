/**
 * Local PostgreSQL 17 without Docker (ruling D29): `pnpm db:start` / `pnpm db:stop`.
 *
 *   start   initialise `.local/pg` on first use, then start the server in the
 *           background on 127.0.0.1:54329 with TimeZone=UTC, and print the URLs
 *   stop    fast shutdown
 *   status  whether it is running
 *
 * The cluster is created with embedded-postgres's `initialise()` (README "Usage"
 * and "API": databaseDir, user, password, port, authMethod, persistent,
 * initdbFlags). Its `start()` ties the server to this Node process and stops it
 * on exit, so start/stop use the `pg_ctl` binary from the same platform package
 * instead, which leaves the server running between commands. The data directory
 * is persistent and gitignored.
 *
 * Run through tsx (it imports the TypeScript constants in ../src).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

import {
  LOCAL_PG_HOST,
  LOCAL_PG_PORT,
  LOCAL_SUPERUSER,
  LOCAL_SUPERUSER_PASSWORD,
  localUrls,
} from '../src/local-dev.ts';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LOCAL_DIR = path.join(REPO_ROOT, '.local');
const DATA_DIR = path.join(LOCAL_DIR, 'pg');
const LOG_FILE = path.join(LOCAL_DIR, 'pg.log');

/** Server settings for every start: loopback only, UTC (kickoff-package.md §6.2). */
const SERVER_OPTIONS = [
  `-p ${LOCAL_PG_PORT}`,
  `-c listen_addresses=${LOCAL_PG_HOST}`,
  '-c TimeZone=UTC',
  '-c log_timezone=UTC',
].join(' ');

/** Resolves the platform binary package through embedded-postgres, as it does itself. */
async function binaries() {
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const requireFromEmbedded = createRequire(fileURLToPath(import.meta.resolve('embedded-postgres')));
  const entry = requireFromEmbedded.resolve(`@embedded-postgres/${platform}-${process.arch}`);
  return import(pathToFileURL(entry).href);
}

function pgCtl(pgCtlPath, args, stdio = 'inherit') {
  return spawnSync(pgCtlPath, args, { stdio, windowsHide: true });
}

function isRunning(pgCtlPath) {
  // pg_ctl status: 0 running, 3 not running, 4 no data directory.
  return pgCtl(pgCtlPath, ['status', '-D', DATA_DIR], 'ignore').status === 0;
}

async function initialiseIfNeeded() {
  if (existsSync(path.join(DATA_DIR, 'PG_VERSION'))) return false;
  mkdirSync(LOCAL_DIR, { recursive: true });
  const cluster = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: LOCAL_SUPERUSER,
    password: LOCAL_SUPERUSER_PASSWORD,
    port: LOCAL_PG_PORT,
    authMethod: 'scram-sha-256',
    persistent: true,
    // UTF-8 regardless of the Windows code page; C collation for stable ordering.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
  });
  await cluster.initialise();
  return true;
}

async function describeServer() {
  const client = new pg.Client({
    host: LOCAL_PG_HOST,
    port: LOCAL_PG_PORT,
    user: LOCAL_SUPERUSER,
    password: LOCAL_SUPERUSER_PASSWORD,
    database: 'postgres',
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT split_part(version(), ' on ', 1) AS version, current_setting('TimeZone') AS tz",
    );
    return rows[0];
  } finally {
    await client.end();
  }
}

function printUrls() {
  const urls = localUrls();
  console.log(`
Local connection URLs (development-only passwords; never reuse them anywhere else):
  DATABASE_URL_MIGRATOR=${urls.migrator}
  DATABASE_URL=${urls.api}      # api (wringy_api_login)
  DATABASE_URL=${urls.worker}   # worker (wringy_worker_login)
Superuser, used by pnpm db:bootstrap when WRINGY_ENV=local:
  ${urls.superuser}

First time: set WRINGY_ENV=local, then run pnpm db:bootstrap, pnpm db:migrate, pnpm db:env and pnpm db:seed:fixtures.`);
}

async function start() {
  const { pg_ctl: pgCtlPath } = await binaries();
  if (await initialiseIfNeeded()) console.log(`Initialised a new cluster in ${DATA_DIR}`);

  if (isRunning(pgCtlPath)) {
    console.log('Embedded PostgreSQL is already running.');
  } else {
    // stdio 'ignore': on Windows pg_ctl starts the server through cmd.exe with
    // inherited handles, so an inherited stdout would keep the caller's pipe open
    // for the server's whole life. The server writes to LOG_FILE instead.
    const result = pgCtl(
      pgCtlPath,
      ['start', '-D', DATA_DIR, '-l', LOG_FILE, '-w', '-t', '60', '-o', SERVER_OPTIONS],
      'ignore',
    );
    if (result.status !== 0) {
      console.error(`pg_ctl start failed (exit ${result.status}); see ${LOG_FILE}`);
      process.exit(1);
    }
  }

  const server = await describeServer();
  console.log(
    `${server.version} is listening on ${LOCAL_PG_HOST}:${LOCAL_PG_PORT}, TimeZone=${server.tz}, data in .local/pg`,
  );
  printUrls();
}

async function stop() {
  const { pg_ctl: pgCtlPath } = await binaries();
  if (!existsSync(path.join(DATA_DIR, 'PG_VERSION')) || !isRunning(pgCtlPath)) {
    console.log('Embedded PostgreSQL is not running.');
    return;
  }
  const result = pgCtl(pgCtlPath, ['stop', '-D', DATA_DIR, '-m', 'fast', '-w']);
  process.exit(result.status ?? 1);
}

async function status() {
  const { pg_ctl: pgCtlPath } = await binaries();
  const running = existsSync(path.join(DATA_DIR, 'PG_VERSION')) && isRunning(pgCtlPath);
  console.log(running ? 'Embedded PostgreSQL is running.' : 'Embedded PostgreSQL is not running.');
  if (running) printUrls();
}

const commands = { start, stop, status };
const command = commands[process.argv[2] ?? ''];
if (!command) {
  console.error('Usage: local-pg.mjs start|stop|status');
  process.exit(2);
}
await command();
