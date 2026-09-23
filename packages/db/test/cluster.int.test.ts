import { describe, expect, it } from 'vitest';

import {
  THROWAWAY_CLUSTER_OPT_IN,
  TestClusterRefusedError,
  bootstrapTestRoles,
  externalClusterHostRefusal,
  findNonTestEnvironments,
  isHarnessDatabase,
  startTestCluster,
  withAdminAt,
  withClientAt,
} from './cluster';
import { cluster } from './harness';

/**
 * CI points every integration suite at one postgres:17 service
 * (TEST_DATABASE_URL, .github/workflows/app.yml `integration`), and
 * `pnpm test:int` runs the apps/api and apps/worker suites at the same time, so
 * their global setups bootstrap the same cluster-wide roles concurrently.
 */
describe('M2-AC01 test harness on a shared cluster', () => {
  it('M2-AC01/3 concurrent test runs bootstrap the login roles without a catalog conflict', async () => {
    const info = cluster();
    await Promise.all(Array.from({ length: 6 }, () => bootstrapTestRoles(info)));

    const { rows } = await withClientAt(info.adminUrl, (admin) =>
      admin.query<{ rolname: string }>(
        `SELECT rolname FROM pg_catalog.pg_roles
          WHERE rolname IN ('wringy_migrator', 'wringy_api', 'wringy_worker', 'wringy_api_login', 'wringy_worker_login')
          ORDER BY rolname`,
      ),
    );
    expect(rows.map((row) => row.rolname)).toEqual([
      'wringy_api',
      'wringy_api_login',
      'wringy_migrator',
      'wringy_worker',
      'wringy_worker_login',
    ]);
  });
});

/**
 * The harness resets the cluster-wide wringy_* login passwords to the committed
 * development values and creates and drops databases, so it runs only on a
 * throwaway cluster (packages/db/test/cluster.ts assertThrowawayCluster).
 */
describe('M2-AC01/2 the test harness bootstraps only a throwaway cluster', () => {
  const remote = 'postgres://postgres:placeholder@db.staging.example.com:5432/postgres';

  it('M2-AC01/2 refuses a TEST_DATABASE_URL that is not on this machine, before connecting, unless the throwaway opt-in is set', async () => {
    const refusal = externalClusterHostRefusal(remote, {});
    expect(refusal).toMatch(/points at db\.staging\.example\.com, not this machine/);
    expect(refusal).not.toContain('placeholder');
    expect(externalClusterHostRefusal(remote, { [THROWAWAY_CLUSTER_OPT_IN]: '1' })).toBeUndefined();
    for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
      expect(externalClusterHostRefusal(`postgres://postgres:placeholder@${host}:5432/postgres`, {}), host).toBeUndefined();
    }

    // startTestCluster refuses before it opens any connection (the host does not resolve).
    const saved = process.env[THROWAWAY_CLUSTER_OPT_IN];
    delete process.env[THROWAWAY_CLUSTER_OPT_IN];
    try {
      await expect(startTestCluster({ adminUrl: remote })).rejects.toBeInstanceOf(TestClusterRefusedError);
    } finally {
      if (saved !== undefined) process.env[THROWAWAY_CLUSTER_OPT_IN] = saved;
    }
  });

  it('M2-AC01/2 refuses a cluster where another database is marked as an environment other than local or ci', async () => {
    const info = cluster();
    // Named like a harness clone so that another run sharing this cluster skips it.
    const probe = `wringy_t_${info.runId}_markerprobe`;
    const probeUrl = (() => {
      const url = new URL(info.adminUrl);
      url.pathname = `/${probe}`;
      return url.toString();
    })();
    await withAdminAt(info, (admin) => admin.query(`CREATE DATABASE ${admin.escapeIdentifier(probe)}`));
    try {
      await withClientAt(probeUrl, async (client) => {
        await client.query('CREATE SCHEMA ops');
        await client.query('CREATE TABLE ops.environment (name text PRIMARY KEY)');
        await client.query(`INSERT INTO ops.environment (name) VALUES ('staging')`);
      });
      expect(isHarnessDatabase(probe)).toBe(true);

      // As a staging database would be seen: not skipped as one of the harness's own.
      const seen = await findNonTestEnvironments(info.adminUrl, (name) => name !== probe && isHarnessDatabase(name));
      expect(seen).toContainEqual({ database: probe, environment: 'staging' });
      // The harness's own databases (clones marked production by other tests included) are never counted.
      expect(await findNonTestEnvironments(info.adminUrl)).toEqual([]);
    } finally {
      await withAdminAt(info, (admin) => admin.query(`DROP DATABASE IF EXISTS ${admin.escapeIdentifier(probe)} WITH (FORCE)`));
    }
  });
});
