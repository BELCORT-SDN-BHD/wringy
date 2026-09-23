import { createServer } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { errorBody } from '../../src/errors';
import { REDACTED } from '../../src/logger';
import { buildTestApi, createTestDatabase, seedFixtures, type TestApi, type TestDatabase } from './support';

/** A port nothing listens on: bound, read, released. */
function unusedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (address && typeof address === 'object' ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

/** Everything that must never leave the process for a connection string `url`. */
function secretsOf(url: string): string[] {
  const { password } = new URL(url);
  return [url, decodeURIComponent(password), 'postgres://'];
}

function expectClean(text: string, secrets: string[], label: string) {
  for (const secret of secrets) expect(text, `${label} leaks ${secret.slice(0, 12)}...`).not.toContain(secret);
}

describe('M2-AC01 no secret leaves the API', () => {
  let db: TestDatabase;
  let api: TestApi;
  let outage: TestApi;
  let outageUrl: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    await seedFixtures(db);
    api = await buildTestApi(db.urls.api);

    // A pool whose server is unreachable, with a canary password in its URL.
    outageUrl = `postgres://wringy_api_login:canary-pw-DO-NOT-LEAK@127.0.0.1:${await unusedPort()}/wringy`;
    outage = await buildTestApi(outageUrl);

    // A route that fails with the connection string in its message and logs it
    // under secret-looking keys, as careless code might.
    for (const target of [api, outage]) {
      const url = target === api ? db.urls.api : outageUrl;
      target.app.get('/internal/boom', async (request) => {
        request.log.info(
          { databaseUrl: url, config: { password: new URL(url).password, apiToken: 'tok-DO-NOT-LEAK' }, note: `via ${url}` },
          `probe for ${url}`,
        );
        throw new Error(`query failed on ${url}`);
      });
    }
  });

  afterAll(async () => {
    await api?.close();
    await outage?.close();
    await db?.drop();
  });

  it('M2-AC01/2 no secret leaves the process: /health and error bodies never contain the connection string, and logs redact DATABASE_URL', async () => {
    const secrets = [...secretsOf(db.urls.api), ...secretsOf(outageUrl), 'tok-DO-NOT-LEAK'];
    const bodies: string[] = [];

    for (const [target, url, status] of [
      [api, '/health', 200],
      [api, '/health/live', 200],
      [api, '/internal/campaigns', 200],
      [api, '/internal/worker-health', 200],
      [api, '/nope', 404],
      [api, '/internal/boom', 500],
      [outage, '/health', 503],
      [outage, '/internal/campaigns', 503],
      [outage, '/internal/worker-health', 503],
      [outage, '/internal/boom', 500],
    ] as const) {
      const response = await target.app.inject({ method: 'GET', url });
      expect(response.statusCode, url).toBe(status);
      expectClean(response.body, secrets, `${url} body`);
      expect(response.body, `${url} body carries no stack`).not.toMatch(/\bat .+:\d+:\d+|"stack"/);
      bodies.push(response.body);
    }

    // The error bodies are the fixed ones, nothing more.
    expect(JSON.parse(bodies[4]!)).toEqual(errorBody('not_found'));
    expect(JSON.parse(bodies[5]!)).toEqual(errorBody('internal_error'));
    expect(JSON.parse(bodies[7]!)).toEqual(errorBody('database_unavailable'));

    // Logs: the connection strings and passwords appear nowhere, in any line.
    const logText = api.logs.text + outage.logs.text;
    expectClean(logText, secrets, 'log');

    // ...yet the log is still useful: the secret keys are censored, not dropped,
    // and the 500 carries its stack with the URL scrubbed out of the message.
    const probe = api.logs.records.find((record) => String(record.msg).startsWith('probe for'));
    expect(probe).toMatchObject({
      msg: `probe for ${REDACTED}`,
      databaseUrl: REDACTED,
      config: { password: REDACTED, apiToken: REDACTED },
      note: `via ${REDACTED}`,
    });
    const failed = api.logs.records.find((record) => record.msg === 'request failed');
    const err = failed?.err as { message: string; stack: string } | undefined;
    expect(err?.message).toBe(`query failed on ${REDACTED}`);
    expect(err?.stack).toMatch(/\n\s+at /);

    // The outage's cause is logged with its network code, never its URL.
    const unavailable = outage.logs.records.find((record) => record.msg === 'database unavailable');
    expect(JSON.stringify(unavailable)).toMatch(/ECONNREFUSED/);

    // Request logs keep the path (the url key of the request serializer is not a secret).
    expect(api.logs.records.some((record) => (record.req as { url?: string } | undefined)?.url === '/internal/campaigns')).toBe(true);
  });

  it('M2-AC01/2 request logs keep the pathname and drop the query string: ?password= and ?token= values never reach the log', async () => {
    const canaries = ['qs-pw-DO-NOT-LEAK', 'qs-tok-DO-NOT-LEAK'];
    const query = `?password=${canaries[0]}&token=${canaries[1]}`;
    const before = api.logs.lines.length;

    for (const [path, status] of [
      ['/health/live', 200],
      ['/internal/campaigns', 200],
      ['/nope', 404],
    ] as const) {
      const response = await api.app.inject({ method: 'GET', url: `${path}${query}` });
      expect(response.statusCode, path).toBe(status);
      expectClean(response.body, canaries, `${path} body`);
    }

    const lines = api.logs.lines.slice(before);
    expectClean(lines.join(''), canaries, 'log');
    const paths = lines
      .map((line) => JSON.parse(line) as { msg?: string; req?: { url?: string; method?: string } })
      .filter((record) => record.msg === 'incoming request')
      .map((record) => `${record.req?.method} ${record.req?.url}`);
    expect(paths).toEqual(['GET /health/live', 'GET /internal/campaigns', 'GET /nope']);
  });
});
