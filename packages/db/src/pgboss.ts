/**
 * Installs or upgrades the pg-boss schema as the migration owner, through the
 * pg-boss CLI's `migrate` command (kickoff-package.md §8.4; the CLI reference is
 * https://raw.githubusercontent.com/timgit/pg-boss/master/docs/cli.md, checked
 * against the installed 12.33.5 `dist/cli.js`).
 *
 * Why the CLI, run from here: `pnpm db:migrate` has to bring pgboss to the
 * pinned version before node-pg-migrate's 0005 grants the worker its rights, and
 * the worker starts PgBoss with `migrate: false` so it never needs DDL (ruling
 * D33). The CLI takes the connection from `PGBOSS_DATABASE_URL` and the schema
 * from `--schema`, creates the schema when absent, runs pending pg-boss
 * migrations inside its own advisory-locked transaction, inlines the index
 * builds a live worker would otherwise run, and does nothing when the schema is
 * current. pg-boss is therefore a runtime dependency of @wringy/db: the
 * migration step ships with the migrations.
 *
 * The connection string travels in the child's environment, never in its argv
 * (argv is visible in process listings), and never in any log line.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { PGBOSS_SCHEMA } from './roles';

const require = createRequire(import.meta.url);
/** packages/db: the CLI's working directory. It holds no pgboss.json or .pgbossrc for the CLI to load. */
const PACKAGE_DIR = fileURLToPath(new URL('../', import.meta.url));

export interface InstalledPgBoss {
  /** The npm version resolved from this package (pinned exactly in package.json). */
  version: string;
  /** The pg-boss schema version this build installs (its package.json `pgboss.schema`). */
  schemaVersion: number;
  /** Absolute path of the CLI entry (`bin.pg-boss`). */
  cliPath: string;
}

/** Reads the pg-boss package this package resolves; pg-boss has no `exports` map, so its package.json is reachable. */
export function installedPgBoss(): InstalledPgBoss {
  const packageJsonPath = require.resolve('pg-boss/package.json');
  const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    version: string;
    bin: Record<string, string>;
    pgboss: { schema: number };
  };
  const bin = manifest.bin['pg-boss'];
  if (bin === undefined) throw new Error('pg-boss declares no pg-boss bin entry');
  return {
    version: manifest.version,
    schemaVersion: manifest.pgboss.schema,
    cliPath: path.join(path.dirname(packageJsonPath), bin),
  };
}

type Queryable = Pick<pg.ClientBase, 'query'>;

/** The version recorded in `pgboss.version`, or null when pg-boss is not installed. */
export async function readPgBossVersion(client: Queryable): Promise<number | null> {
  const exists = await client.query<{ present: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS present`,
    [`${PGBOSS_SCHEMA}.version`],
  );
  if (!exists.rows[0]?.present) return null;
  const { rows } = await client.query<{ version: number }>(`SELECT version FROM ${PGBOSS_SCHEMA}.version`);
  return rows[0]?.version ?? null;
}

async function readVersionAt(databaseUrl: string): Promise<number | null> {
  const client = new pg.Client({ connectionString: databaseUrl, application_name: 'wringy-migrate' });
  await client.connect();
  try {
    return await readPgBossVersion(client);
  } finally {
    await client.end();
  }
}

export interface PgBossInstallResult {
  schema: string;
  /** Version before the run; null when pg-boss was not installed. */
  from: number | null;
  /** Version after the run. */
  to: number;
  outcome: 'installed' | 'upgraded' | 'unchanged';
}

function runCli(cliPath: string, databaseUrl: string, log: (line: string) => void): Promise<void> {
  // Inherit the environment minus any PGBOSS_* variable, so a stray PGBOSS_SCHEMA
  // or PGBOSS_HOST cannot redirect the run; the explicit --schema wins anyway.
  const env: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith('PGBOSS_')) env[name] = value;
  }
  env.PGBOSS_DATABASE_URL = databaseUrl;

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, 'migrate', '--schema', PGBOSS_SCHEMA], {
      cwd: PACKAGE_DIR,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    let stdoutRest = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      const lines = (stdoutRest + chunk).split(/\r?\n/);
      stdoutRest = lines.pop() ?? '';
      for (const line of lines) if (line.trim() !== '') log(`pg-boss: ${line}`);
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (stdoutRest.trim() !== '') log(`pg-boss: ${stdoutRest}`);
      if (code === 0) resolve();
      else reject(new Error(`pg-boss migrate exited with code ${code}: ${stderr.trim() || 'no error output'}`));
    });
  });
}

export interface InstallPgBossOptions {
  /** The migration owner's connection string (`DATABASE_URL_MIGRATOR`). */
  databaseUrl: string;
  /** The schema version the caller expects afterwards (EXPECTED_PGBOSS_VERSION). */
  expectedVersion: number;
  /** Receives progress lines; never the connection string. */
  log?: (line: string) => void;
}

/**
 * `pg-boss migrate --schema pgboss` as the migrator, then a read of
 * `pgboss.version`. Fails when the database ends at any version other than
 * `expectedVersion`, for example a pg-boss bump without an EXPECTED_PGBOSS_VERSION
 * update, or an older image run against a newer pgboss schema.
 */
export async function installPgBossSchema({
  databaseUrl,
  expectedVersion,
  log = () => {},
}: InstallPgBossOptions): Promise<PgBossInstallResult> {
  const { cliPath } = installedPgBoss();
  const from = await readVersionAt(databaseUrl);
  await runCli(cliPath, databaseUrl, log);
  const to = await readVersionAt(databaseUrl);
  if (to !== expectedVersion) {
    throw new Error(
      `pgboss schema is at version ${to ?? 'none'} after pg-boss migrate, but this build expects ${expectedVersion}`,
    );
  }
  return {
    schema: PGBOSS_SCHEMA,
    from,
    to,
    outcome: from === null ? 'installed' : from === to ? 'unchanged' : 'upgraded',
  };
}
