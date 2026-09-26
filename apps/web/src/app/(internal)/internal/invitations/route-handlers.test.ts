import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `POST /internal/invitations/accept/confirm`, the accept page's form target
 * (M2-03; m2-03-code-review.md R7, R9 rev 2, R13 "web unit"), driven as a plain
 * function of a `Request`. Mocked: the cookie store and `fetch` to the API.
 * Everything else — the guard, the token shape check, the body, the outcome
 * mapping and the rule that no URL this handler builds carries the invitation
 * token — is the real code. The identity is simulated.
 */

const incoming = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [...incoming].map(([name, value]) => ({ name, value })),
      get: (name: string) => (incoming.has(name) ? { name, value: incoming.get(name) } : undefined),
    }),
  headers: () => Promise.resolve(new Headers()),
}));

const { POST: confirm } = await import('./accept/confirm/route');

const APP_ORIGIN = 'http://127.0.0.1:3100';
const API = 'http://127.0.0.1:3200';
const SESSION_COOKIE = 'sb-project-auth-token';
const ORG = '0c0ffee0-0000-4000-8000-00000000000a';
const USER = '0ca70100-0000-4000-8000-000000000004';
const ACCESS_TOKEN = 'access-token-for-the-simulated-invitee';
const INVITE_TOKEN = 'inviteToken_0123456789-abcdefghijklmnopqrst';
const INSTANT = '2026-09-26T01:00:00.000Z';

const ACCEPTED = {
  org: { id: ORG, name: 'Dave Retail', dataOrigin: 'live', createdAt: INSTANT },
  membership: { orgId: ORG, userId: USER, role: 'member', status: 'active', grantBasis: 'invitation', grantedAt: INSTANT },
};

const storedSession = (accessToken: string) =>
  `base64-${Buffer.from(JSON.stringify({ access_token: accessToken }), 'utf8').toString('base64url')}`;

function post(form: Record<string, string> | undefined, headers: Record<string, string> = {}) {
  return new Request(`${APP_ORIGIN}/internal/invitations/accept/confirm`, {
    method: 'POST',
    headers: { origin: APP_ORIGIN, ...headers },
    body: form === undefined ? undefined : new URLSearchParams(form),
  });
}

function stubApi(answer: () => Response | Promise<Response>) {
  const apiCalls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', (input: string | URL, init: RequestInit = {}) => {
    apiCalls.push({ url: typeof input === 'string' ? input : input.toString(), init });
    return answer();
  });
  return apiCalls;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const refusal = (status: number, code: string) => () => json(status, { error: { code, message: 'x' } });

beforeEach(() => {
  incoming.clear();
  incoming.set(SESSION_COOKIE, storedSession(ACCESS_TOKEN));
  vi.stubEnv('WRINGY_APP_MODE', 'internal');
  vi.stubEnv('WRINGY_ENV', 'ci');
  vi.stubEnv('API_INTERNAL_URL', API);
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fake_0123456789abcdef');
  vi.stubEnv('APP_ORIGIN', APP_ORIGIN);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('M2-AC03/1 accept: the invitation is accepted by the API, from a token in a POST body', () => {
  it('M2-AC03/1 accept: forwards the token as JSON to POST /invitations/accept and lands on the org with joined', async () => {
    const apiCalls = stubApi(() => json(200, ACCEPTED));

    const response = await confirm(post({ token: INVITE_TOKEN }));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal/orgs/${ORG}?outcome=joined`);
    expect(apiCalls).toHaveLength(1);
    // The token travels in the body, never in the API path (the API's request log writes paths).
    expect(apiCalls[0]?.url).toBe(`${API}/invitations/accept`);
    expect(JSON.parse(String(apiCalls[0]?.init.body))).toEqual({ token: INVITE_TOKEN });
    const sent = apiCalls[0]?.init.headers as Record<string, string>;
    expect(sent.authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(sent['content-type']).toBe('application/json');
  });

  it('M2-AC03/1 accept: the demo build has no such endpoint and a cross-site post is refused, both before the API', async () => {
    const apiCalls = stubApi(() => json(200, ACCEPTED));

    const crossSite = await confirm(post({ token: INVITE_TOKEN }, { origin: 'https://evil.example' }));
    expect(crossSite.status).toBe(403);

    vi.stubEnv('WRINGY_APP_MODE', 'demo');
    const demo = await confirm(post({ token: INVITE_TOKEN }));
    expect(demo.status).toBe(404);

    expect(apiCalls).toHaveLength(0);
  });

  it('M2-AC03/1 accept: a missing or malformed token is invitation_invalid without calling the API', async () => {
    const apiCalls = stubApi(() => json(200, ACCEPTED));

    const forms: (Record<string, string> | undefined)[] = [
      undefined,
      {},
      { token: '' },
      { token: 'short' },
      { token: `${INVITE_TOKEN}x` },
      { token: `${INVITE_TOKEN.slice(1)}/` },
    ];
    for (const form of forms) {
      const response = await confirm(post(form));
      expect(response.headers.get('location'), JSON.stringify(form)).toBe(`${APP_ORIGIN}/internal?outcome=invitation_invalid`);
    }
    expect(apiCalls).toHaveLength(0);
  });

  it('M2-AC03/1 accept: no session cookie is session_ended, and nothing is called', async () => {
    incoming.clear();
    const apiCalls = stubApi(() => json(200, ACCEPTED));

    const response = await confirm(post({ token: INVITE_TOKEN }));

    expect(response.headers.get('location')).toBe(`${APP_ORIGIN}/internal?outcome=session_ended`);
    expect(apiCalls).toHaveLength(0);
  });
});

describe('M2-AC03/3 accept: a refused invitation says why on /internal and never puts the token back in a URL', () => {
  it('M2-AC03/3 accept: each refusal of the accept command maps to its outcome', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cases: [() => Response | Promise<Response>, string][] = [
      [refusal(403, 'invitation.invalid'), '/internal?outcome=invitation_invalid'],
      [refusal(403, 'invitation.expired'), '/internal?outcome=invitation_expired'],
      [refusal(403, 'invitation.used'), '/internal?outcome=invitation_used'],
      [refusal(403, 'invitation.email_mismatch'), '/internal?outcome=invitation_mismatch'],
      [refusal(409, 'invitation.already_member'), '/internal?outcome=already_member'],
      [refusal(401, 'unauthenticated'), '/internal?outcome=session_ended'],
      [refusal(403, 'account.disabled'), '/auth/end-session'],
      [refusal(400, 'bad_request'), '/internal?outcome=unexpected'],
      [refusal(503, 'database_unavailable'), '/internal?outcome=unavailable'],
      [refusal(500, 'internal'), '/internal?outcome=unexpected'],
      [() => Promise.reject(Object.assign(new Error('x'), { code: 'ECONNRESET' })), '/internal?outcome=unexpected'],
    ];

    for (const [answer, expected] of cases) {
      stubApi(answer);
      const response = await confirm(post({ token: INVITE_TOKEN }));
      const target = response.headers.get('location');
      expect(target, expected).toBe(`${APP_ORIGIN}${expected}`);
      expect(target, expected).not.toContain(INVITE_TOKEN);
      expect(response.headers.getSetCookie(), expected).toEqual([]);
    }
  });

  it('M2-AC03/3 accept: no log line carries the invitation token or the access token', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const answer of [refusal(403, 'invitation.email_mismatch'), refusal(503, 'database_unavailable'), () => json(200, {})]) {
      stubApi(answer);
      await confirm(post({ token: INVITE_TOKEN }));
    }

    const logged = warn.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toContain('POST /invitations/accept failed: invitation.email_mismatch (HTTP 403)');
    expect(logged).not.toContain(INVITE_TOKEN);
    expect(logged).not.toContain(ACCESS_TOKEN);
  });
});
