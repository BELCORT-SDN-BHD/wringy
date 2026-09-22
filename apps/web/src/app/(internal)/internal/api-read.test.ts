import { createServer } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { internalCampaignsResponseSchema, workerHealthResponseSchema } from '@wringy/contracts';

import { INTERNAL_API_TIMEOUT_MS, classifyApiResponse, readInternalApi } from './api-read';

const workers = {
  workers: [
    {
      workerId: 'worker-local-1',
      startedAt: '2026-09-23T01:00:00.000Z',
      lastBeatAt: '2026-09-23T01:02:00.000Z',
      lastQueueRoundTripAt: null,
      imageRef: 'local/dev',
      state: 'healthy',
      queueState: 'never',
    },
  ],
  dbNow: '2026-09-23T01:02:05.000Z',
};

/** A port on 127.0.0.1 that nothing listens on: bound, read, then closed again. */
function closedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (address && typeof address === 'object' ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

describe('M2-AC01 the internal page turns every API answer into data or an explicit state', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps a 200 body that matches the contract, and only the fields it names', () => {
    const result = classifyApiResponse(200, { ...workers, debug: 'x' }, workerHealthResponseSchema);
    expect(result).toEqual({ ok: true, data: workers });
  });

  it('calls a 503 (database unavailable) api-unavailable, whatever the body', () => {
    expect(
      classifyApiResponse(503, { error: { code: 'database_unavailable', message: 'x' } }, workerHealthResponseSchema),
    ).toEqual({ ok: false, failure: 'api-unavailable' });
    expect(classifyApiResponse(503, undefined, workerHealthResponseSchema)).toEqual({
      ok: false,
      failure: 'api-unavailable',
    });
  });

  it('calls any other status, and a 200 that breaks the contract, unexpected', () => {
    for (const status of [400, 404, 500, 502]) {
      expect(classifyApiResponse(status, workers, workerHealthResponseSchema)).toEqual({
        ok: false,
        failure: 'unexpected',
      });
    }
    const withoutQueueState = { ...workers, workers: [{ ...workers.workers[0], queueState: undefined }] };
    expect(classifyApiResponse(200, withoutQueueState, workerHealthResponseSchema)).toEqual({
      ok: false,
      failure: 'unexpected',
    });
    expect(classifyApiResponse(200, { items: 'none' }, internalCampaignsResponseSchema)).toEqual({
      ok: false,
      failure: 'unexpected',
    });
  });

  it('calls a refused connection api-unreachable and logs the code, never the URL', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const port = await closedPort();
    const base = `http://127.0.0.1:${port}`;

    const result = await readInternalApi(base, '/internal/worker-health', workerHealthResponseSchema);

    expect(result).toEqual({ ok: false, failure: 'api-unreachable' });
    const logged = warn.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toContain('GET /internal/worker-health failed: api-unreachable (ECONNREFUSED)');
    expect(logged).not.toContain(String(port));
  });

  it('bounds every read at the 5 s operational limit', () => {
    expect(INTERNAL_API_TIMEOUT_MS).toBe(5_000);
  });
});
