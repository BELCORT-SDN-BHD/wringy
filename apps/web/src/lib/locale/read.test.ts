import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ApiResult } from '@/lib/auth/api-client';
import type { MeResponse } from '@wringy/contracts';

/**
 * The account read's own bound (M2-04; m2-04-code-review.md R3 rev 2, R13
 * "/1 API stalled"): the language never waits more than 1.5 s for `GET /me`,
 * and on timeout the order continues without the account. `control.failNext`
 * cannot stall the API and the outage instance's closed port answers at once,
 * so the stall is proven here: once with fake timers, once against a real
 * server that sleeps.
 */

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: () => undefined, getAll: () => [] }),
  headers: () => Promise.resolve(new Headers()),
}));

const { ACCOUNT_READ_BUDGET_MS, accountPreferenceOf, accountPreferenceWithin, readMe } = await import('./read');

const PROFILE = {
  id: '00000000-0000-4000-8000-000000000001',
  displayName: 'Fiona Chen',
  contactEmail: 'fiona@example.test',
  status: 'active',
  lastSignInAt: '2026-09-25T01:00:00.000Z',
  createdAt: '2026-09-20T01:00:00.000Z',
  localePref: 'ms-MY',
  localePrefSetAt: '2026-09-26T01:00:00.000Z',
};
const ME = { profile: PROFILE, session: { expiresAt: '2026-09-27T02:00:00.000Z' } };

let server: Server | null = null;

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (server !== null) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
  }
});

/** A local API whose `/me` answers after `delayMs`. */
async function sleepyApi(delayMs: number): Promise<string> {
  server = createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(ME));
    }, delayMs);
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('M2-AC04/1 API stalled: the language does not wait for a slow account read', () => {
  it('M2-AC04/1 API stalled: a read that never answers is unknown at 1.5 s, and not before', async () => {
    vi.useFakeTimers();
    const never = new Promise<ApiResult<MeResponse>>(() => {});
    let settled: unknown = 'pending';
    void accountPreferenceWithin(never).then((value) => {
      settled = value;
    });

    await vi.advanceTimersByTimeAsync(ACCOUNT_READ_BUDGET_MS - 1);
    expect(settled).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe('unknown');
    expect(ACCOUNT_READ_BUDGET_MS).toBe(1_500);
  });

  it('M2-AC04/1 API stalled: an answer inside the budget is the account’s preference, a refusal or a failure is unknown', async () => {
    const ok = (localePref: string | null) =>
      Promise.resolve({ kind: 'ok', data: { ...ME, profile: { ...PROFILE, localePref } } } as ApiResult<MeResponse>);
    expect(await accountPreferenceWithin(ok('ms-MY'))).toBe('ms-MY');
    expect(await accountPreferenceWithin(ok(null))).toBeNull();

    expect(accountPreferenceOf({ kind: 'error', status: 401, code: 'auth.expired' })).toBe('unknown');
    expect(accountPreferenceOf({ kind: 'error', status: 403, code: 'account.disabled' })).toBe('unknown');
    for (const failure of ['api-unavailable', 'api-unreachable', 'unexpected'] as const) {
      expect(accountPreferenceOf({ kind: 'failure', failure }), failure).toBe('unknown');
    }
  });

  it('M2-AC04/1 API stalled: against an API that sleeps 3 s, the preference is unknown within the budget and the read still completes for the page', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const base = await sleepyApi(3_000);
    const read = readMe('token-for-the-simulated-caller', base);

    const started = performance.now();
    const preference = await accountPreferenceWithin(read);
    const waited = performance.now() - started;

    expect(preference).toBe('unknown');
    expect(waited).toBeGreaterThanOrEqual(ACCOUNT_READ_BUDGET_MS - 50);
    expect(waited).toBeLessThan(ACCOUNT_READ_BUDGET_MS + 1_000);

    // The race did not cancel the read: the page that awaits it gets the answer.
    const result = await read;
    expect(result.kind).toBe('ok');
    expect(accountPreferenceOf(result)).toBe('ms-MY');
  }, 15_000);

  it('M2-AC04/1 API stalled: against a prompt API, the preference arrives well inside the budget', async () => {
    const base = await sleepyApi(0);
    const started = performance.now();
    expect(await accountPreferenceWithin(readMe('token-for-the-simulated-caller', base))).toBe('ms-MY');
    expect(performance.now() - started).toBeLessThan(ACCOUNT_READ_BUDGET_MS);
  });
});
