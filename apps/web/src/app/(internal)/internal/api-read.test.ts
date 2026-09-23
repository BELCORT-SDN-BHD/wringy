import { createServer as createHttpServer, type ServerResponse } from 'node:http';
import { createServer, type Server, type Socket } from 'node:net';

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

  it('M2-AC01 keeps a 200 body that matches the contract, and only the fields it names', () => {
    const result = classifyApiResponse(200, { ...workers, debug: 'x' }, workerHealthResponseSchema);
    expect(result).toEqual({ ok: true, data: workers });
  });

  it('M2-AC01 calls a 503 (database unavailable) api-unavailable, whatever the body', () => {
    expect(
      classifyApiResponse(503, { error: { code: 'database_unavailable', message: 'x' } }, workerHealthResponseSchema),
    ).toEqual({ ok: false, failure: 'api-unavailable' });
    expect(classifyApiResponse(503, undefined, workerHealthResponseSchema)).toEqual({
      ok: false,
      failure: 'api-unavailable',
    });
  });

  it('M2-AC01 calls any other status, and a 200 that breaks the contract, unexpected', () => {
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

  it('M2-AC01 calls a refused connection api-unreachable and logs the code, never the URL', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const port = await closedPort();
    const base = `http://127.0.0.1:${port}`;

    const result = await readInternalApi(base, '/internal/worker-health', workerHealthResponseSchema);

    expect(result).toEqual({ ok: false, failure: 'api-unreachable' });
    const logged = warn.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toContain('GET /internal/worker-health failed: api-unreachable (ECONNREFUSED)');
    expect(logged).not.toContain(String(port));
  });

  it('M2-AC01 an API that accepts the connection and never answers ends as api-unreachable at the read limit', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const silent = await listen(createServer((socket) => void socket)); // accepts, reads, never writes
    try {
      const started = Date.now();
      const result = await readInternalApi(silent.base, '/internal/worker-health', workerHealthResponseSchema, {
        timeoutMs: READ_LIMIT_MS,
      });
      const elapsed = Date.now() - started;
      expect(result).toEqual({ ok: false, failure: 'api-unreachable' });
      expect(elapsed).toBeGreaterThanOrEqual(READ_LIMIT_MS - 20);
      expect(elapsed).toBeLessThan(READ_LIMIT_MS + 2_000);
      expect(warn.mock.calls.map((call) => call.join(' ')).join('\n')).toMatch(
        /GET \/internal\/worker-health failed: api-unreachable \((AbortError|TimeoutError)\)/,
      );
    } finally {
      await silent.close();
    }
  });

  it('M2-AC01 an API that sends its headers and then stalls the body ends as api-unreachable at the same limit', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const open: ServerResponse[] = [];
    const stalling = await listen(
      createHttpServer((_request, response) => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.write('{"workers":[');
        open.push(response); // the body never finishes
      }),
    );
    try {
      const started = Date.now();
      const result = await readInternalApi(stalling.base, '/internal/worker-health', workerHealthResponseSchema, {
        timeoutMs: READ_LIMIT_MS,
      });
      expect(result).toEqual({ ok: false, failure: 'api-unreachable' });
      expect(Date.now() - started).toBeLessThan(READ_LIMIT_MS + 2_000);
    } finally {
      for (const response of open) response.destroy();
      await stalling.close();
    }
  });

  it('M2-AC01 the page reads with the 5 s operational limit by default', () => {
    // Configuration only; the two tests above show what the limit does.
    expect(INTERNAL_API_TIMEOUT_MS).toBe(5_000);
  });
});

/** A short read limit for the tests above, so they do not wait the page's full 5 s. */
const READ_LIMIT_MS = 300;

/** Listens on a free port on 127.0.0.1; close() also drops open sockets. */
async function listen(server: Server): Promise<{ base: string; close(): Promise<void> }> {
  const sockets = new Set<Socket>();
  server.on('connection', (socket: Socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address !== 'object') throw new Error('no port');
  return {
    base: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
