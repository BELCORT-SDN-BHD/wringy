/**
 * Global setup of the internal suite (playwright.internal.config.ts).
 *
 * Playwright runs this AFTER every webServer entry is up, so the database was
 * already made by the second entry (database-server.mts: a PostgreSQL 17
 * cluster, a template migrated from zero, a clone seeded with the fixtures and
 * with the allow-listed testers, all through `@wringy/db/testing/cluster`) and the
 * simulated auth server by the first. This setup checks both through their own
 * connections before any test runs, and exports what the tests rely on into
 * process.env, which the test workers inherit:
 *
 * - WRINGY_ENV=ci, the environment the database is marked as;
 * - WRINGY_E2E_PG_HOST/PORT/DATABASE are already there (captured by
 *   Playwright from the database entry's ready line); e2eDatabase() in
 *   support.ts turns them into the migrator, api and worker login URLs;
 * - SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and WRINGY_E2E_AUTH_CONTROL are
 *   already there too, from the fake-auth entry's ready line.
 *
 * The allow-list check is the one that would otherwise fail late and
 * confusingly: with no listed address, every sign-in in the suite would be
 * refused with 403 `sign_in.not_allowed` and every M2-AC01 row would fail for a
 * reason that has nothing to do with what it tests.
 *
 * Nothing is written to the repository.
 */
import { withClientAt } from '@wringy/db/testing/connect';

import { allowlistedEmails } from './fake-auth/users';
import { e2eDatabase } from './support';

export default async function globalSetup(): Promise<void> {
  const urls = e2eDatabase();

  const { environment, campaigns, allowlisted } = await withClientAt(urls.migrator, async (client) => {
    const marker = await client.query<{ name: string }>('SELECT name FROM ops.environment');
    const seeded = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM app.campaigns WHERE data_origin = 'fixture'",
    );
    const allowed = await client.query<{ email_norm: string }>('SELECT email_norm FROM app.sign_in_allowlist');
    return {
      environment: marker.rows[0]?.name,
      campaigns: Number(seeded.rows[0]?.count ?? 0),
      allowlisted: allowed.rows.map((row) => row.email_norm),
    };
  });

  if (environment !== 'ci') throw new Error(`the internal suite database is marked "${environment}", not "ci"`);
  if (campaigns !== 3) throw new Error(`the internal suite database holds ${campaigns} fixture campaigns, not 3`);
  for (const email of allowlistedEmails()) {
    if (allowlisted.includes(email.toLowerCase())) continue;
    throw new Error(`${email} is not on app.sign_in_allowlist, so every sign-in in the suite would be refused`);
  }

  const control = process.env.WRINGY_E2E_AUTH_CONTROL;
  if (!control) {
    throw new Error('the simulated auth server did not announce its control address (WRINGY_E2E_AUTH_CONTROL)');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('the simulated auth server did not announce SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY');
  }
  const jwks = await fetch(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!jwks.ok) throw new Error(`the simulated auth server's JWKS is not readable (HTTP ${jwks.status})`);
  const keys = ((await jwks.json()) as { keys?: { alg?: string; kid?: string }[] }).keys ?? [];
  if (keys.length !== 1 || keys[0]?.alg !== 'ES256' || !keys[0]?.kid) {
    throw new Error('the simulated auth server must publish exactly one ES256 signing key with a kid');
  }

  process.env.WRINGY_ENV = 'ci';
}
