import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NextResponse } from 'next/server';

/**
 * The seven organisation Route Handlers (M2-03; m2-03-code-review.md R9 rev 2,
 * R13 "web unit"), driven as what they are: plain functions of a `Request` and a
 * `{ params: Promise }` context. Two things are mocked and nothing else — the
 * cookie store (`next/headers` only works inside a real request) and `fetch` to
 * the API. The guards, the segment parsing, the token read, the body, the cookie
 * options, the redirects and the outcome mapping are all the real code.
 *
 * Every identity here is simulated: the access token is a string in a cookie of
 * the shape `@supabase/ssr` writes, and the API is a stub.
 */

// --- The cookie store the handlers read -------------------------------------
const incoming = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [...incoming].map(([name, value]) => ({ name, value })),
      get: (name: string) => (incoming.has(name) ? { name, value: incoming.get(name) } : undefined),
    }),
  headers: () => Promise.resolve(new Headers()),
}));

const { POST: createOrg } = await import('./create/route');
const { POST: renameOrg } = await import('./[orgId]/rename/route');
const { POST: createInvitation } = await import('./[orgId]/invitations/create/route');
const { POST: revokeInvitation } = await import('./[orgId]/invitations/[invitationId]/revoke/route');
const { POST: changeRole } = await import('./[orgId]/members/[userId]/role/route');
const { POST: removeMember } = await import('./[orgId]/members/[userId]/remove/route');
const { POST: leaveOrg } = await import('./[orgId]/leave/route');

const APP_ORIGIN = 'http://127.0.0.1:3100';
const API = 'http://127.0.0.1:3200';
const SUPABASE_URL = 'https://project.supabase.co';
const SESSION_COOKIE = 'sb-project-auth-token';
const NO_STORE = 'private, no-cache, no-store, must-revalidate, max-age=0';

const ORG = '0c0ffee0-0000-4000-8000-00000000000a';
const OTHER_ORG = '0c0ffee0-0000-4000-8000-00000000000b';
const MEMBER = '0da4e000-0000-4000-8000-000000000005';
const INVITATION = '1a000000-0000-4000-8000-000000000001';
const ORG_PAGE = `/internal/orgs/${ORG}`;

/** The caller's access token, as the session cookie carries it. Never to appear in a log line or a URL. */
const ACCESS_TOKEN = 'access-token-for-the-simulated-caller';
/** An invitation token: base64url of 32 bytes is 43 characters. Never to appear in a log line or a URL. */
const INVITE_TOKEN = 'inviteToken_0123456789-abcdefghijklmnopqrst';
const INVITEE = 'carol@example.test';

const INSTANT = '2026-09-26T01:00:00.000Z';
const ORG_SUMMARY = { id: ORG, name: 'Carol Studio', dataOrigin: 'live', createdAt: INSTANT };
const MEMBERSHIP = { orgId: ORG, userId: MEMBER, role: 'member', status: 'active', grantBasis: 'invitation', grantedAt: INSTANT };
const PENDING = { id: INVITATION, inviteeEmailNorm: INVITEE, role: 'member', expiresAt: INSTANT, createdAt: INSTANT };

function internalEnv(appOrigin = APP_ORIGIN): void {
  vi.stubEnv('WRINGY_APP_MODE', 'internal');
  vi.stubEnv('WRINGY_ENV', 'ci');
  vi.stubEnv('API_INTERNAL_URL', API);
  vi.stubEnv('SUPABASE_URL', SUPABASE_URL);
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_fake_0123456789abcdef');
  vi.stubEnv('APP_ORIGIN', appOrigin);
}

/** The session cookie as @supabase/ssr writes it, which the handlers read without refreshing. */
const storedSession = (accessToken: string) =>
  `base64-${Buffer.from(JSON.stringify({ access_token: accessToken }), 'utf8').toString('base64url')}`;

/** A same-origin browser form post. */
function post(path: string, { form, headers }: { form?: Record<string, string>; headers?: Record<string, string> } = {}) {
  return new Request(`${APP_ORIGIN}${path}`, {
    method: 'POST',
    headers: { origin: APP_ORIGIN, ...headers },
    body: form === undefined ? undefined : new URLSearchParams(form),
  });
}

/** A Route Handler context as Next passes it: `params` is a Promise. */
const ctx = <P>(params: P) => ({ params: Promise.resolve(params) });

interface ApiCall {
  url: string;
  init: RequestInit;
}

/** Stub the API. Returns the calls so a test can prove none happened. */
function stubApi(answer: () => Response | Promise<Response>): ApiCall[] {
  const apiCalls: ApiCall[] = [];
  vi.stubGlobal('fetch', (input: string | URL, init: RequestInit = {}) => {
    apiCalls.push({ url: typeof input === 'string' ? input : input.toString(), init });
    return answer();
  });
  return apiCalls;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const refusal = (status: number, code: string) => () => json(status, { error: { code, message: 'x' } });

const location = (response: Response) => response.headers.get('location');

function expectNoStore(response: Response, label = ''): void {
  expect(response.headers.get('cache-control'), label).toBe(NO_STORE);
}

/**
 * One row per handler: how to call it with a valid form, the API path it must
 * build, the body it must send, its success answer and where it goes, and where
 * a refusal sends the person.
 */
interface HandlerCase {
  name: string;
  call: (headers?: Record<string, string>) => Promise<NextResponse>;
  apiPath: string;
  body: unknown;
  success: { status: number; body: unknown; location: string };
  refusedTo: string;
}

const HANDLERS: HandlerCase[] = [
  {
    name: 'create',
    call: (headers) => createOrg(post('/internal/orgs/create', { form: { name: 'Carol Studio' }, headers })),
    apiPath: '/orgs',
    body: { name: 'Carol Studio' },
    success: { status: 201, body: { org: ORG_SUMMARY, membership: { ...MEMBERSHIP, role: 'admin', grantBasis: 'org_created' } }, location: `${ORG_PAGE}?outcome=created` },
    refusedTo: '/internal',
  },
  {
    name: 'rename',
    call: (headers) => renameOrg(post(`${ORG_PAGE}/rename`, { form: { name: 'Carol Studio 2' }, headers }), ctx({ orgId: ORG })),
    apiPath: `/orgs/${ORG}/rename`,
    body: { name: 'Carol Studio 2' },
    success: { status: 200, body: { org: ORG_SUMMARY }, location: `${ORG_PAGE}?outcome=renamed` },
    refusedTo: ORG_PAGE,
  },
  {
    name: 'invite',
    call: (headers) =>
      createInvitation(post(`${ORG_PAGE}/invitations/create`, { form: { email: INVITEE, role: 'member' }, headers }), ctx({ orgId: ORG })),
    apiPath: `/orgs/${ORG}/invitations`,
    body: { email: INVITEE, role: 'member' },
    success: {
      status: 201,
      body: { invitation: PENDING, token: INVITE_TOKEN },
      location: `${ORG_PAGE}/invitations/${INVITATION}?outcome=invited`,
    },
    refusedTo: ORG_PAGE,
  },
  {
    name: 'revoke',
    call: (headers) =>
      revokeInvitation(post(`${ORG_PAGE}/invitations/${INVITATION}/revoke`, { headers }), ctx({ orgId: ORG, invitationId: INVITATION })),
    apiPath: `/orgs/${ORG}/invitations/${INVITATION}/revoke`,
    body: undefined,
    success: { status: 200, body: { invitation: { id: INVITATION, status: 'revoked' } }, location: `${ORG_PAGE}?outcome=revoked` },
    refusedTo: ORG_PAGE,
  },
  {
    name: 'role',
    call: (headers) =>
      changeRole(post(`${ORG_PAGE}/members/${MEMBER}/role`, { form: { role: 'admin' }, headers }), ctx({ orgId: ORG, userId: MEMBER })),
    apiPath: `/orgs/${ORG}/members/${MEMBER}/role`,
    body: { role: 'admin' },
    success: { status: 200, body: { membership: { ...MEMBERSHIP, role: 'admin' } }, location: `${ORG_PAGE}?outcome=role_changed` },
    refusedTo: ORG_PAGE,
  },
  {
    name: 'remove',
    call: (headers) => removeMember(post(`${ORG_PAGE}/members/${MEMBER}/remove`, { headers }), ctx({ orgId: ORG, userId: MEMBER })),
    apiPath: `/orgs/${ORG}/members/${MEMBER}/remove`,
    body: undefined,
    success: { status: 200, body: { membership: { ...MEMBERSHIP, status: 'removed' } }, location: `${ORG_PAGE}?outcome=member_removed` },
    refusedTo: ORG_PAGE,
  },
  {
    name: 'leave',
    call: (headers) => leaveOrg(post(`${ORG_PAGE}/leave`, { headers }), ctx({ orgId: ORG })),
    apiPath: `/orgs/${ORG}/leave`,
    body: undefined,
    success: { status: 200, body: { membership: { ...MEMBERSHIP, status: 'removed' } }, location: '/internal?outcome=left' },
    refusedTo: ORG_PAGE,
  },
];

beforeEach(() => {
  incoming.clear();
  incoming.set(SESSION_COOKIE, storedSession(ACCESS_TOKEN));
  internalEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('M2-AC03/2 org commands: the demo build has none of these endpoints', () => {
  it('M2-AC03/2 org commands: every handler answers 404 in demo mode, before any other work', async () => {
    vi.stubEnv('WRINGY_APP_MODE', 'demo');
    const apiCalls = stubApi(() => json(200, {}));

    for (const handler of HANDLERS) {
      const response = await handler.call();
      expect(response.status, handler.name).toBe(404);
      expectNoStore(response, handler.name);
      expect((await response.json()).error.code, handler.name).toBe('not_found');
    }
    expect(apiCalls).toHaveLength(0);
  });
});

describe('M2-AC03/2 org commands: a cross-site post is refused before the API is called', () => {
  it('M2-AC03/2 org commands: Origin: https://evil.example is 403 on every handler, with no upstream call', async () => {
    const apiCalls = stubApi(() => json(200, {}));

    for (const handler of HANDLERS) {
      const response = await handler.call({ origin: 'https://evil.example' });
      expect(response.status, handler.name).toBe(403);
      expect((await response.json()).error.code, handler.name).toBe('forbidden');
      expect(response.headers.getSetCookie(), handler.name).toEqual([]);
    }
    expect(apiCalls).toHaveLength(0);
  });

  it('M2-AC03/2 org commands: no Origin with Sec-Fetch-Site: cross-site is 403 too', async () => {
    const apiCalls = stubApi(() => json(200, {}));
    const request = new Request(`${APP_ORIGIN}${ORG_PAGE}/leave`, { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } });

    const response = await leaveOrg(request, ctx({ orgId: ORG }));

    expect(response.status).toBe(403);
    expect(apiCalls).toHaveLength(0);
  });
});

describe('M2-AC03/2 org commands: every path segment is a uuid before any API path is built', () => {
  // Route Handlers receive their segments decoded: `x%2F..%2F..` arrives as `x/../..`.
  const HOSTILE = ['not-a-uuid', 'x/../../internal/campaigns', '..', '', `${ORG}/../${OTHER_ORG}`, ORG.slice(0, -1)];

  it('M2-AC03/2 org commands: a hostile orgId answers forbidden on /internal and calls nothing', async () => {
    const apiCalls = stubApi(() => json(200, {}));

    for (const orgId of HOSTILE) {
      const responses = [
        await renameOrg(post(`/internal/orgs/x/rename`, { form: { name: 'n' } }), ctx({ orgId })),
        await createInvitation(post('/internal/orgs/x/invitations/create', { form: { email: INVITEE, role: 'member' } }), ctx({ orgId })),
        await revokeInvitation(post('/internal/orgs/x/invitations/y/revoke'), ctx({ orgId, invitationId: INVITATION })),
        await changeRole(post('/internal/orgs/x/members/y/role', { form: { role: 'admin' } }), ctx({ orgId, userId: MEMBER })),
        await removeMember(post('/internal/orgs/x/members/y/remove'), ctx({ orgId, userId: MEMBER })),
        await leaveOrg(post('/internal/orgs/x/leave'), ctx({ orgId })),
      ];
      for (const response of responses) {
        expect(response.status, orgId).toBe(303);
        expect(location(response), orgId).toBe(`${APP_ORIGIN}/internal?outcome=forbidden`);
        expectNoStore(response, orgId);
      }
    }
    expect(apiCalls).toHaveLength(0);
  });

  it('M2-AC03/2 org commands: a hostile userId or invitationId is refused the same way', async () => {
    const apiCalls = stubApi(() => json(200, {}));

    for (const id of HOSTILE) {
      const responses = [
        await revokeInvitation(post('/internal/orgs/x/invitations/y/revoke'), ctx({ orgId: ORG, invitationId: id })),
        await changeRole(post('/internal/orgs/x/members/y/role', { form: { role: 'admin' } }), ctx({ orgId: ORG, userId: id })),
        await removeMember(post('/internal/orgs/x/members/y/remove'), ctx({ orgId: ORG, userId: id })),
      ];
      for (const response of responses) {
        expect(location(response), id).toBe(`${APP_ORIGIN}/internal?outcome=forbidden`);
      }
    }
    expect(apiCalls).toHaveLength(0);
  });
});

describe('M2-AC03/2 org commands: the caller’s token, the path’s org and only the rendered fields reach the API', () => {
  it('M2-AC03/2 org commands: each handler posts to its own API path with the cookie’s Bearer token', async () => {
    for (const handler of HANDLERS) {
      const apiCalls = stubApi(() => json(handler.success.status, handler.success.body));

      const response = await handler.call();

      expect(response.status, handler.name).toBe(303);
      expect(location(response), handler.name).toBe(`${APP_ORIGIN}${handler.success.location}`);
      expectNoStore(response, handler.name);
      expect(apiCalls, handler.name).toHaveLength(1);
      expect(apiCalls[0]?.url, handler.name).toBe(`${API}${handler.apiPath}`);
      expect(apiCalls[0]?.init.method, handler.name).toBe('POST');
      const sent = apiCalls[0]?.init.headers as Record<string, string>;
      expect(sent.authorization, handler.name).toBe(`Bearer ${ACCESS_TOKEN}`);
      if (handler.body === undefined) {
        // An empty body declared as JSON is a Fastify 400: send neither.
        expect(apiCalls[0]?.init.body, handler.name).toBeUndefined();
        expect(sent, handler.name).not.toHaveProperty('content-type');
      } else {
        expect(JSON.parse(String(apiCalls[0]?.init.body)), handler.name).toEqual(handler.body);
        expect(sent['content-type'], handler.name).toBe('application/json');
      }
    }
  });

  it('M2-AC03/2 org commands: an orgId posted in the form is never forwarded; the path decides the org', async () => {
    const apiCalls = stubApi(() => json(200, { org: ORG_SUMMARY }));

    await renameOrg(post(`${ORG_PAGE}/rename`, { form: { name: 'Renamed', orgId: OTHER_ORG } }), ctx({ orgId: ORG }));
    await changeRole(post(`${ORG_PAGE}/members/${MEMBER}/role`, { form: { role: 'member', orgId: OTHER_ORG } }), ctx({ orgId: ORG, userId: MEMBER }));

    expect(apiCalls.map((call) => call.url)).toEqual([`${API}/orgs/${ORG}/rename`, `${API}/orgs/${ORG}/members/${MEMBER}/role`]);
    expect(JSON.parse(String(apiCalls[0]?.init.body))).toEqual({ name: 'Renamed' });
    expect(JSON.parse(String(apiCalls[1]?.init.body))).toEqual({ role: 'member' });
    for (const call of apiCalls) expect(String(call.init.body)).not.toContain(OTHER_ORG);
  });

  it('M2-AC03/2 org commands: no session cookie answers session_ended without calling the API', async () => {
    incoming.clear();
    const apiCalls = stubApi(() => json(200, {}));

    for (const handler of HANDLERS) {
      const response = await handler.call();
      expect(location(response), handler.name).toBe(`${APP_ORIGIN}${handler.refusedTo}?outcome=session_ended`);
    }
    expect(apiCalls).toHaveLength(0);
  });

  it('M2-AC03/1 org commands: a role outside the contract is never sent, so it cannot read as a bad address', async () => {
    const apiCalls = stubApi(() => json(200, {}));

    for (const role of ['owner', 'ADMIN', '', 'admin ']) {
      const invited = await createInvitation(post(`${ORG_PAGE}/invitations/create`, { form: { email: INVITEE, role } }), ctx({ orgId: ORG }));
      const changed = await changeRole(post(`${ORG_PAGE}/members/${MEMBER}/role`, { form: { role } }), ctx({ orgId: ORG, userId: MEMBER }));
      expect(location(invited), role).toBe(`${APP_ORIGIN}${ORG_PAGE}?outcome=unexpected`);
      expect(location(changed), role).toBe(`${APP_ORIGIN}${ORG_PAGE}?outcome=unexpected`);
    }
    expect(apiCalls).toHaveLength(0);
  });
});

describe('M2-AC03/2 org commands: every refusal says what happened, and a disabled account ends the session', () => {
  /** Answers every handler reads the same way; the command-specific ones follow. */
  const COMMON: [string, () => Response | Promise<Response>, string][] = [
    ['401 unauthenticated', refusal(401, 'unauthenticated'), 'session_ended'],
    ['401 session.revoked', refusal(401, 'session.revoked'), 'session_ended'],
    ['401 auth.expired', refusal(401, 'auth.expired'), 'session_ended'],
    ['403 org.forbidden', refusal(403, 'org.forbidden'), 'forbidden'],
    ['403 org.admin_required', refusal(403, 'org.admin_required'), 'admin_required'],
    ['409 org.last_admin', refusal(409, 'org.last_admin'), 'last_admin'],
    ['404 member.not_found', refusal(404, 'member.not_found'), 'not_found'],
    ['404 invitation.not_found', refusal(404, 'invitation.not_found'), 'not_found'],
    ['403 profile.missing', refusal(403, 'profile.missing'), 'unexpected'],
    ['409 member.self', refusal(409, 'member.self'), 'unexpected'],
    ['503 database_unavailable', refusal(503, 'database_unavailable'), 'unavailable'],
    ['500', refusal(500, 'internal'), 'unexpected'],
    ['502 not json', () => new Response('<html>bad gateway</html>', { status: 502 }), 'unexpected'],
    ['unreachable', () => Promise.reject(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })), 'unexpected'],
    ['a 2xx that breaks the contract', () => json(200, { unexpected: true }), 'unexpected'],
  ];

  it('M2-AC03/2 org commands: the shared refusals map to the same outcome on every handler', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const handler of HANDLERS) {
      for (const [label, answer, outcome] of COMMON) {
        stubApi(answer);
        const response = await handler.call();
        expect(response.status, `${handler.name} ${label}`).toBe(303);
        expect(location(response), `${handler.name} ${label}`).toBe(`${APP_ORIGIN}${handler.refusedTo}?outcome=${outcome}`);
        // A refusal sets no cookie: in particular no invitation link.
        expect(response.headers.getSetCookie(), `${handler.name} ${label}`).toEqual([]);
      }
    }
  });

  it('M2-AC03/2 org commands: 403 account.disabled ends the session through /auth/end-session, as /internal does', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const handler of HANDLERS) {
      stubApi(refusal(403, 'account.disabled'));
      const response = await handler.call();
      expect(response.status, handler.name).toBe(303);
      expect(location(response), handler.name).toBe(`${APP_ORIGIN}/auth/end-session`);
    }
  });

  it('M2-AC03/2 org commands: a 400 is invalid_email on the invite handler, invalid_name on create and rename, and unexpected everywhere else', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (const handler of HANDLERS) {
      stubApi(refusal(400, 'bad_request'));
      const response = await handler.call();
      const expected =
        handler.name === 'invite' ? 'invalid_email' : handler.name === 'create' || handler.name === 'rename' ? 'invalid_name' : 'unexpected';
      expect(location(response), handler.name).toBe(`${APP_ORIGIN}${handler.refusedTo}?outcome=${expected}`);
    }
  });

  it('M2-AC03/2 org commands: the invitation conflicts name themselves', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    stubApi(refusal(409, 'invitation.pending'));
    expect(location(await HANDLERS[2]!.call())).toBe(`${APP_ORIGIN}${ORG_PAGE}?outcome=pending_exists`);

    stubApi(refusal(409, 'invitation.not_pending'));
    expect(location(await HANDLERS[3]!.call())).toBe(`${APP_ORIGIN}${ORG_PAGE}?outcome=not_pending`);

    stubApi(refusal(404, 'invitation.not_found'));
    expect(location(await HANDLERS[3]!.call())).toBe(`${APP_ORIGIN}${ORG_PAGE}?outcome=not_found`);
  });
});

describe('M2-AC03/3 invitation link: the token reaches the admin’s page in a cookie, never in a URL', () => {
  it('M2-AC03/3 invitation link: a 201 sets the page-scoped, httpOnly, 10-minute cookie and 303s to the invitation page', async () => {
    stubApi(() => json(201, { invitation: PENDING, token: INVITE_TOKEN }));

    const response = await createInvitation(
      post(`${ORG_PAGE}/invitations/create`, { form: { email: INVITEE, role: 'member' } }),
      ctx({ orgId: ORG }),
    );

    expect(response.status).toBe(303);
    const target = location(response)!;
    expect(target).toBe(`${APP_ORIGIN}${ORG_PAGE}/invitations/${INVITATION}?outcome=invited`);
    expect(target).not.toContain(INVITE_TOKEN);

    const cookie = response.cookies.get(`wringy-invite-${INVITATION}`);
    expect(cookie?.value).toBe(INVITE_TOKEN);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
    // Exactly the invitation page: no other page, not even the org's, is sent the token.
    expect(cookie?.path).toBe(`${ORG_PAGE}/invitations/${INVITATION}`);
    expect(cookie?.maxAge).toBe(600);
    // A loopback APP_ORIGIN cannot set Secure, or the browser would store nothing.
    expect(cookie?.secure).toBe(false);
    // The response that sets it is never cacheable (M2-02 R20).
    expectNoStore(response);
    expect(response.headers.getSetCookie()).toHaveLength(1);
  });

  it('M2-AC03/3 invitation link: on any non-loopback origin the cookie is Secure', async () => {
    internalEnv('https://internal.wringy.example');
    stubApi(() => json(201, { invitation: PENDING, token: INVITE_TOKEN }));

    const response = await createInvitation(
      post(`${ORG_PAGE}/invitations/create`, { form: { email: INVITEE, role: 'admin' }, headers: { origin: 'https://internal.wringy.example' } }),
      ctx({ orgId: ORG }),
    );

    expect(location(response)).toBe(`https://internal.wringy.example${ORG_PAGE}/invitations/${INVITATION}?outcome=invited`);
    expect(response.cookies.get(`wringy-invite-${INVITATION}`)?.secure).toBe(true);
  });

  it('M2-AC03/3 invitation link: a 201 whose token breaks the contract sets no cookie and says unexpected', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubApi(() => json(201, { invitation: PENDING, token: 'short' }));

    const response = await createInvitation(post(`${ORG_PAGE}/invitations/create`, { form: { email: INVITEE, role: 'member' } }), ctx({ orgId: ORG }));

    expect(location(response)).toBe(`${APP_ORIGIN}${ORG_PAGE}?outcome=unexpected`);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe('M2-AC03/3 org commands: no log line carries a token, a session or an address', () => {
  it('M2-AC03/3 org commands: across every handler and every refusal, the web log names only method, path and code', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const info = vi.spyOn(console, 'log').mockImplementation(() => {});

    const answers = [
      refusal(401, 'session.revoked'),
      refusal(403, 'org.admin_required'),
      refusal(409, 'invitation.pending'),
      refusal(400, 'bad_request'),
      refusal(503, 'database_unavailable'),
      () => Promise.reject(Object.assign(new Error(`refused ${ACCESS_TOKEN}`), { code: 'ECONNREFUSED' })),
    ];
    for (const handler of HANDLERS) {
      for (const answer of answers) {
        stubApi(answer);
        await handler.call();
      }
      stubApi(() => json(handler.success.status, handler.success.body));
      await handler.call();
    }

    const logged = [...warn.mock.calls, ...error.mock.calls, ...info.mock.calls].map((call) => call.join(' ')).join('\n');
    expect(logged).toContain(`POST /orgs/${ORG}/invitations failed: invitation.pending (HTTP 409)`);
    for (const secret of [ACCESS_TOKEN, INVITE_TOKEN, INVITEE, storedSession(ACCESS_TOKEN), SUPABASE_URL, API]) {
      expect(logged, 'a secret, a session or an address reached the log').not.toContain(secret);
    }
  });
});
