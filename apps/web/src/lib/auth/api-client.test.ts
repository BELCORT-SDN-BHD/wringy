import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { meResponseSchema } from '@wringy/contracts';

import { API_REQUEST_TIMEOUT_MS, apiFetch, classifyApiResult, errorCodeOf } from './api-client';
import { ACCESS_TOKEN_HEADER } from './wire';

// `headers()` is only reachable inside a request, so the one function that uses
// it is driven through a mock. Everything else here is plain HTTP.
const headerStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: (name: string) => headerStore.get(name.toLowerCase()) ?? null }),
}));

const BASE = 'http://127.0.0.1:3200';
const PROFILE = {
  id: '00000000-0000-4000-8000-000000000001',
  displayName: 'Alice Tan',
  contactEmail: 'alice@example.test',
  status: 'active',
  lastSignInAt: '2026-09-25T01:00:00.000Z',
  createdAt: '2026-09-20T01:00:00.000Z',
};
const ME = { profile: PROFILE, session: { expiresAt: '2026-09-25T02:00:00.000Z' } };

/** Replaces global fetch and records what it was asked to do. */
function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', (input: string | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    return Promise.resolve(handler(url, init));
  });
  return calls;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  headerStore.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('M2-AC02/2 revoked: the web keeps the API’s error code so it can say the right thing', () => {
  it('M2-AC02/2 revoked: a 401 or 403 keeps its code, which is what tells the cases apart', () => {
    for (const [status, code] of [
      [401, 'session.revoked'],
      [401, 'auth.expired'],
      [401, 'unauthenticated'],
      [403, 'account.disabled'],
      [403, 'sign_in.not_allowed'],
      [403, 'profile.missing'],
    ] as const) {
      expect(classifyApiResult(status, { error: { code, message: 'x' } }, meResponseSchema)).toEqual({
        kind: 'error',
        status,
        code,
      });
    }
  });

  it('M2-AC02/2 revoked: a 401 or 403 with no usable envelope still reports its status', () => {
    expect(classifyApiResult(401, undefined, meResponseSchema)).toEqual({ kind: 'error', status: 401, code: null });
    expect(classifyApiResult(403, { error: {} }, meResponseSchema)).toEqual({ kind: 'error', status: 403, code: null });
  });

  it('M2-AC02/2 revoked: every 503 is a retryable failure, never a signed-out answer', () => {
    // R9: a transient Auth-server or database blip must not sign everyone out.
    for (const body of [{ error: { code: 'session_check_unavailable', message: 'x' } }, undefined]) {
      expect(classifyApiResult(503, body, meResponseSchema)).toEqual({
        kind: 'failure',
        failure: 'api-unavailable',
      });
    }
  });

  it('M2-AC02/3 cache: a 200 is kept only when it matches the contract, and only its named fields', () => {
    expect(classifyApiResult(200, { ...ME, secret: 'x' }, meResponseSchema)).toEqual({ kind: 'ok', data: ME });
    expect(classifyApiResult(200, { profile: PROFILE }, meResponseSchema)).toEqual({
      kind: 'failure',
      failure: 'unexpected',
    });
  });

  // Amended by M2-03 (m2-03-code-review.md R9 rev 2, §5; an M2-AC02/3 amendment row in
  // the acceptance record): this row said "any other status is unexpected". The org
  // outcomes need the codes of 400, 404 and 409, so those now keep theirs; a 5xx and
  // any status the web does not know stay `unexpected`.
  it('M2-AC02/3 cache: 5xx and unknown statuses are unexpected; 400/404/409 keep their code', () => {
    for (const status of [405, 410, 418, 500, 502, 504, 302]) {
      expect(classifyApiResult(status, ME, meResponseSchema), String(status)).toEqual({
        kind: 'failure',
        failure: 'unexpected',
      });
    }
    for (const [status, code] of [
      [400, 'bad_request'],
      [404, 'invitation.not_found'],
      [404, 'member.not_found'],
      [409, 'org.last_admin'],
      [409, 'invitation.pending'],
    ] as const) {
      expect(classifyApiResult(status, { error: { code, message: 'x' } }, meResponseSchema), `${status} ${code}`).toEqual({
        kind: 'error',
        status,
        code,
      });
    }
    // With no usable envelope the status still decides, and no code is invented.
    expect(classifyApiResult(409, undefined, meResponseSchema)).toEqual({ kind: 'error', status: 409, code: null });
  });

  it('M2-AC03/1 created: any 2xx is success against the contract, and a 2xx that breaks it is not', () => {
    // POST /orgs and POST /orgs/:orgId/invitations answer 201.
    expect(classifyApiResult(201, ME, meResponseSchema)).toEqual({ kind: 'ok', data: ME });
    expect(classifyApiResult(299, ME, meResponseSchema)).toEqual({ kind: 'ok', data: ME });
    expect(classifyApiResult(201, { profile: PROFILE }, meResponseSchema)).toEqual({
      kind: 'failure',
      failure: 'unexpected',
    });
    expect(classifyApiResult(204, undefined, meResponseSchema)).toEqual({ kind: 'failure', failure: 'unexpected' });
  });

  it('M2-AC02/2 revoked: errorCodeOf reads only a well-formed envelope', () => {
    expect(errorCodeOf({ error: { code: 'session.revoked', message: 'x' } })).toBe('session.revoked');
    for (const body of [null, undefined, 'x', {}, { error: null }, { error: 'x' }, { error: { code: '' } }, { error: { code: 7 } }]) {
      expect(errorCodeOf(body), JSON.stringify(body)).toBeNull();
    }
  });
});

describe('M2-AC02/2 revoked: every call carries the caller’s token and is bounded and uncached', () => {
  it('M2-AC02/2 revoked: sends Authorization: Bearer and never caches', async () => {
    const calls = stubFetch(() => json(200, ME));

    const result = await apiFetch('/me', { baseUrl: BASE, token: 'token-abc', schema: meResponseSchema });

    expect(result).toEqual({ kind: 'ok', data: ME });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://127.0.0.1:3200/me');
    expect(calls[0].init.cache).toBe('no-store');
    expect(calls[0].init.method).toBe('GET');
    const sent = calls[0].init.headers as Record<string, string>;
    expect(sent.authorization).toBe('Bearer token-abc');
  });

  it('M2-AC02/2 revoked: sends no Authorization header at all when there is no token', async () => {
    const calls = stubFetch(() => json(401, { error: { code: 'unauthenticated', message: 'x' } }));

    const result = await apiFetch('/me', { baseUrl: BASE, token: null, schema: meResponseSchema });

    expect(result).toEqual({ kind: 'error', status: 401, code: 'unauthenticated' });
    // An empty Bearer would be a different request; absent is what is meant.
    expect(calls[0].init.headers).not.toHaveProperty('authorization');
  });

  it('M2-AC02/2 revoked: POSTs when asked, and joins the path without doubling a slash', async () => {
    const calls = stubFetch(() => json(200, { ok: true, checkedAt: '2026-09-25T01:00:00.000Z' }));

    await apiFetch('/me/session/probe', {
      baseUrl: `${BASE}/`,
      token: 'token-abc',
      method: 'POST',
      schema: { safeParse: (input: unknown) => ({ success: true as const, data: input }) },
    });

    expect(calls[0].url).toBe('http://127.0.0.1:3200/me/session/probe');
    expect(calls[0].init.method).toBe('POST');
  });

  it('M2-AC03/2 command: a call with no body sends no body and no content-type', async () => {
    // Fastify answers an empty body declared as JSON with 400, so leave, remove and
    // revoke — which take none — must not claim one (R9 rev 2).
    const calls = stubFetch(() => json(200, { ok: true }));
    const passThrough = { safeParse: (input: unknown) => ({ success: true as const, data: input }) };

    await apiFetch('/orgs/a0000000-0000-4000-8000-000000000001/leave', {
      baseUrl: BASE,
      token: 'token-abc',
      method: 'POST',
      schema: passThrough,
    });

    expect(calls[0].init.body).toBeUndefined();
    const sent = calls[0].init.headers as Record<string, string>;
    expect(sent).not.toHaveProperty('content-type');
    expect(sent.accept).toBe('application/json');
  });

  it('M2-AC03/2 command: a body is sent as JSON with its content-type, and never logged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const calls = stubFetch(() => json(409, { error: { code: 'invitation.pending', message: 'x' } }));
    const passThrough = { safeParse: (input: unknown) => ({ success: true as const, data: input }) };

    const result = await apiFetch('/orgs/a0000000-0000-4000-8000-000000000001/invitations', {
      baseUrl: BASE,
      token: 'token-abc',
      method: 'POST',
      body: { email: 'carol@example.test', role: 'member' },
      schema: passThrough,
    });

    expect(result).toEqual({ kind: 'error', status: 409, code: 'invitation.pending' });
    expect(calls[0].init.body).toBe('{"email":"carol@example.test","role":"member"}');
    const sent = calls[0].init.headers as Record<string, string>;
    expect(sent['content-type']).toBe('application/json');
    expect(sent.authorization).toBe('Bearer token-abc');
    // The log line names the method, the path and the code: not the body, not the token.
    const logged = warn.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toContain('POST /orgs/a0000000-0000-4000-8000-000000000001/invitations failed: invitation.pending (HTTP 409)');
    expect(logged).not.toContain('carol@example.test');
    expect(logged).not.toContain('token-abc');
  });

  it('M2-AC02/2 revoked: an unreachable API is a failure, and the log names no URL or token', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', () => Promise.reject(Object.assign(new Error('nope'), { code: 'ECONNREFUSED' })));

    const result = await apiFetch('/me', { baseUrl: BASE, token: 'token-abc', schema: meResponseSchema });

    expect(result).toEqual({ kind: 'failure', failure: 'api-unreachable' });
    const logged = warn.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toContain('GET /me failed: api-unreachable (ECONNREFUSED)');
    expect(logged).not.toContain('token-abc');
    expect(logged).not.toContain('127.0.0.1');
  });

  it('M2-AC02/2 revoked: a non-JSON body is classified by status instead of throwing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(() => new Response('<html>502</html>', { status: 502 }));

    await expect(apiFetch('/me', { baseUrl: BASE, token: 'token-abc', schema: meResponseSchema })).resolves.toEqual({
      kind: 'failure',
      failure: 'unexpected',
    });
  });

  it('M2-AC02/2 revoked: an API that never answers ends at the read limit as api-unreachable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
    );

    const started = Date.now();
    const result = await apiFetch('/me', {
      baseUrl: BASE,
      token: 'token-abc',
      schema: meResponseSchema,
      timeoutMs: 150,
    });

    expect(result).toEqual({ kind: 'failure', failure: 'api-unreachable' });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('M2-AC02/2 revoked: the call limit is the same 5 s the page reads use', () => {
    expect(API_REQUEST_TIMEOUT_MS).toBe(5_000);
  });
});

describe('M2-AC02/2 isolation: a Server Component takes the token only from the proxy’s header', () => {
  it('M2-AC02/2 isolation: reads the token the proxy set', async () => {
    const { accessTokenFromHeaders } = await import('./api-client');
    headerStore.set(ACCESS_TOKEN_HEADER, 'token-from-proxy');

    await expect(accessTokenFromHeaders()).resolves.toBe('token-from-proxy');
  });

  it('M2-AC02/2 isolation: an absent or empty header is null, so the page renders no identity', async () => {
    const { accessTokenFromHeaders } = await import('./api-client');

    await expect(accessTokenFromHeaders()).resolves.toBeNull();

    headerStore.set(ACCESS_TOKEN_HEADER, '');
    await expect(accessTokenFromHeaders()).resolves.toBeNull();
  });
});
