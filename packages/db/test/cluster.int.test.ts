import { describe, expect, it } from 'vitest';

import {
  THROWAWAY_CLUSTER_OPT_IN,
  TestClusterRefusedError,
  bootstrapTestRoles,
  externalClusterHostRefusal,
  findNonTestEnvironments,
  isHarnessDatabase,
  nodeVersionRefusal,
  pinnedNodeMajor,
  pinnedPostgresMajor,
  postgresVersionRefusal,
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

/**
 * M2-AC01/2 part 1 locks the supported dependency intersection. The harness
 * refuses any other PostgreSQL or Node.js major (startTestCluster), so these
 * integration results are evidence for exactly the pinned versions.
 */
describe('M2-AC01/2 the integration tests run on the pinned versions', () => {
  it('M2-AC01/2 runs on PostgreSQL 17 and Node 24', async () => {
    expect(pinnedPostgresMajor()).toBe(17);
    expect(pinnedNodeMajor()).toBe(24);
    const { rows } = await withClientAt(cluster().adminUrl, (admin) =>
      admin.query<{ num: number }>(`SELECT current_setting('server_version_num')::int AS num`),
    );
    expect(Math.floor(rows[0]!.num / 10_000)).toBe(pinnedPostgresMajor());
    expect(Number(process.versions.node.split('.')[0])).toBe(pinnedNodeMajor());
  });

  it('M2-AC01/2 refuses PostgreSQL 16 and Node 20', () => {
    expect(postgresVersionRefusal(160004)).toMatch(/runs PostgreSQL 16 \(server_version_num 160004\), not the supported 17/);
    expect(postgresVersionRefusal(170010)).toBeUndefined();
    expect(nodeVersionRefusal('20.19.5')).toMatch(/run on Node\.js 24 \(\.nvmrc\), not 20\.19\.5/);
    expect(nodeVersionRefusal('24.21.0')).toBeUndefined();
  });
});
