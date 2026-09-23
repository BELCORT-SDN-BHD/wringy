import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { REDACTED, loggerOptions, redactSecrets, requestPath, scrubText, serializeError, serializeRequest } from './logger';

const URL = 'postgres://wringy_api_login:hunter2-DO-NOT-LEAK@db.internal:5432/wringy';

describe('M2-AC01 scrubText', () => {
  it('M2-AC01/2 replaces a PostgreSQL connection string wherever it appears', () => {
    const text = `connect ${URL} failed; retry postgresql://u:p@h/d`;
    expect(scrubText(text)).toBe(`connect ${REDACTED} failed; retry ${REDACTED}`);
  });

  it('M2-AC01/2 removes user:password credentials from any URL', () => {
    expect(scrubText('see https://admin:s3cret@example.test/path')).toBe(`see https://${REDACTED}@example.test/path`);
  });

  it('leaves ordinary text alone', () => {
    expect(scrubText('GET /internal/campaigns 200')).toBe('GET /internal/campaigns 200');
  });
});

describe('M2-AC01 redactSecrets', () => {
  it('M2-AC01/2 censors every key matching url|password|secret|token, at any depth, in any case', () => {
    const redacted = redactSecrets({
      databaseUrl: URL,
      DATABASE_URL: URL,
      nested: { password: 'p', clientSecret: 's', refresh_token: 't', list: [{ apiToken: 'x' }] },
      keep: 'value',
      count: 3,
    });
    expect(redacted).toEqual({
      databaseUrl: REDACTED,
      DATABASE_URL: REDACTED,
      nested: { password: REDACTED, clientSecret: REDACTED, refresh_token: REDACTED, list: [{ apiToken: REDACTED }] },
      keep: 'value',
      count: 3,
    });
    expect(JSON.stringify(redacted)).not.toContain('hunter2');
  });

  it('M2-AC01/2 scrubs connection strings under innocent keys', () => {
    expect(redactSecrets({ detail: `using ${URL}` })).toEqual({ detail: `using ${REDACTED}` });
  });

  it('leaves non-plain objects for their serializers (a request keeps its url)', () => {
    class RequestLike {
      url = '/internal/campaigns';
    }
    const request = new RequestLike();
    const error = new Error('x');
    const out = redactSecrets({ req: request, err: error }) as Record<string, unknown>;
    expect(out.req).toBe(request);
    expect(out.err).toBe(error);
  });

  it('does not mutate its input', () => {
    const input = { password: 'p' };
    redactSecrets(input);
    expect(input.password).toBe('p');
  });
});

describe('M2-AC01 serializeError', () => {
  it('M2-AC01/2 keeps the type, the SQLSTATE and the stack, scrubbed, and follows the cause', () => {
    const cause = Object.assign(new Error(`connect failed for ${URL}`), { code: 'ECONNREFUSED', connectionString: URL });
    const error = new Error('The database is unavailable', { cause });
    const out = serializeError(error);

    expect(out.type).toBe('Error');
    expect(out.message).toBe('The database is unavailable');
    expect(String(out.stack)).toContain('logger.test.ts');
    expect(out.cause).toMatchObject({ code: 'ECONNREFUSED', connectionString: REDACTED, message: `connect failed for ${REDACTED}` });
    expect(JSON.stringify(out)).not.toContain('hunter2');
    expect(JSON.stringify(out)).not.toContain('db.internal');
  });

  it('handles a thrown non-Error', () => {
    expect(serializeError(`boom ${URL}`)).toEqual({ type: 'string', message: `boom ${REDACTED}`, stack: '' });
  });
});

describe('M2-AC01 API log line format', () => {
  it('M2-AC01 stamps every line with an ISO 8601 UTC time, the format the worker logs', async () => {
    const lines: string[] = [];
    const app = Fastify({ logger: loggerOptions('info', { write: (line) => void lines.push(line) }) });
    const before = Date.now();
    app.log.info('probe');
    await app.close();

    const probe = lines.map((line) => JSON.parse(line) as { msg?: string; time?: unknown }).find((line) => line.msg === 'probe');
    expect(probe?.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Date.parse(String(probe?.time))).toBeGreaterThanOrEqual(before - 1_000);
  });
});

describe('M2-AC01 serializeRequest', () => {
  it('M2-AC01/2 keeps the method, the path, the request id and the remote address, and drops the query string and fragment', () => {
    const request = {
      method: 'GET',
      url: '/health/live?password=pw-DO-NOT-LEAK&token=tok-DO-NOT-LEAK#frag',
      id: 'req-7',
      ip: '127.0.0.1',
      host: 'api.internal',
      headers: { authorization: 'Bearer tok-DO-NOT-LEAK' },
    };
    const out = serializeRequest(request);
    expect(out).toEqual({ method: 'GET', url: '/health/live', id: 'req-7', remoteAddress: '127.0.0.1' });
    expect(JSON.stringify(out)).not.toContain('DO-NOT-LEAK');
  });

  it('M2-AC01/2 cuts at the first ? or #, and scrubs credentials from the path itself', () => {
    expect(requestPath('/internal/campaigns')).toBe('/internal/campaigns');
    expect(requestPath('/a#b?c')).toBe('/a');
    expect(requestPath('/a?b#c')).toBe('/a');
    expect(requestPath('?only=query')).toBe('');
    expect(requestPath('/x/postgres://u:p@h/d')).toBe(`/x/${REDACTED}`);
  });

  it('logs nothing it cannot read', () => {
    expect(JSON.stringify(serializeRequest(undefined))).toBe('{}');
    expect(JSON.stringify(serializeRequest({ url: 42 }))).toBe('{}');
  });
});

describe('M2-AC01 API request logs', () => {
  it('M2-AC01/2 a request with secrets in its query string is logged by its pathname only', async () => {
    const lines: string[] = [];
    const app = Fastify({ logger: loggerOptions('info', { write: (line) => void lines.push(line) }) });
    app.get('/health/live', async () => ({ status: 'ok' }));
    const response = await app.inject({ method: 'GET', url: '/health/live?password=qs-pw-DO-NOT-LEAK&token=qs-tok-DO-NOT-LEAK' });
    await app.close();

    expect(response.statusCode).toBe(200);
    const text = lines.join('');
    expect(text).not.toContain('qs-pw-DO-NOT-LEAK');
    expect(text).not.toContain('qs-tok-DO-NOT-LEAK');
    const incoming = lines
      .map((line) => JSON.parse(line) as { msg?: string; req?: Record<string, unknown> })
      .find((line) => line.msg === 'incoming request');
    expect(incoming?.req).toEqual({ method: 'GET', url: '/health/live', id: expect.any(String), remoteAddress: '127.0.0.1' });
  });
});
