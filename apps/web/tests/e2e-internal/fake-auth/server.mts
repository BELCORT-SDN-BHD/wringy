/**
 * A local stand-in for Supabase Auth, for the internal Playwright suite
 * (M2-02 R15; kickoff-package.md §4.9).
 *
 * WHY IT EXISTS. Every M2-AC02 row needs a *verified* Google identity, and no
 * verified method exists to drive a real Google consent screen from Playwright
 * (§4.9's closing note). So the suite is built credential-free first: this
 * process speaks the subset of the GoTrue HTTP API that `@supabase/ssr` 0.12.7
 * and `@supabase/auth-js` 2.117.2 actually call, signs ES256 tokens with a key
 * pair it generates at start-up, and publishes the matching JWKS — which is the
 * same algorithm both Supabase projects use (kickoff code review §1). Every row
 * driven through it is therefore labelled **simulated** and cannot close the
 * ticket on its own; the `Real` rows stay human steps.
 *
 * WHAT IT IS NOT. It is not a security boundary and it verifies nothing about
 * the caller: the publishable key is a fixed literal, `/logout` and `/user`
 * accept any well-formed token this process signed, and the control API under
 * `/_control` lets a test revoke a session, shorten the token lifetime, expire
 * a flow (in either of the two ways GoTrue does) or fail one call. It listens on
 * loopback only and writes no files.
 *
 * TWO WAYS A FLOW STATE EXPIRES, because the real one has two:
 *
 *  - `POST /_control/flows/expire-next` marks the flow so the **token exchange**
 *    refuses it, 422 `flow_state_expired`. That is what GoTrue answers when it
 *    still holds the flow row and the exchange arrives too late.
 *  - `POST /_control/flows/expire-to-site-url` makes the flow state already gone
 *    **when the consent completes**, which is the case the founder's real walk of
 *    2026-09-26 found: GoTrue no longer holds the flow, so it no longer knows its
 *    `redirect_to`, and it sends the provider error to the project's **Site URL
 *    root** instead — `GET <site-url>/?error=invalid_request&error_code=`
 *    `bad_oauth_state&error_description=OAuth+state+has+expired`, captured
 *    verbatim from the browser's network log. The fake derives the Site URL from
 *    the flow's own `redirect_to` origin unless the control call names one, the
 *    same way a project's Site URL is `APP_ORIGIN` (kickoff-package.md §4.8).
 *
 * THE SUBSET, and who calls it:
 *
 * | Endpoint | Caller |
 * |---|---|
 * | `GET /auth/v1/authorize` | the browser, after `POST /auth/sign-in` answers 303 with the URL `signInWithOAuth` built |
 * | `GET`/`POST /auth/v1/authorize/consent` | the browser, when someone picks a user or cancels — this page stands in for **both** Supabase's provider redirect and Google's consent screen |
 * | `POST /auth/v1/token?grant_type=pkce` | `exchangeCodeForSession` in `GET /auth/callback` |
 * | `POST /auth/v1/token?grant_type=refresh_token` | the refresh inside `getClaims()` in `proxy.ts` |
 * | `POST /auth/v1/logout?scope=local` | `signOut({ scope: 'local' })` in `POST /auth/sign-out` |
 * | `GET /auth/v1/user` | the api's `auth_server` session-liveness adapter (R2), and auth-js's fallback when a `kid` is unknown |
 * | `GET /auth/v1/.well-known/jwks.json` | `getClaims()` in the web, `createRemoteJWKSet` in the api |
 *
 * CALL COUNTERS. `fullyParallel` workers share this process, so counters are
 * per tag, never global. A request is attributed to a tag when it carries the
 * `X-Wringy-Test` header (browser traffic does, through the context's
 * `extraHTTPHeaders`) **or** when the flow or session it names was created by a
 * tagged request — which is how the server-to-server calls (`/token`,
 * `/logout`, `/user`) land in the right bucket without the web or the api
 * knowing anything about tests. The same scoping applies to the control knobs:
 * `token-lifetime`, `flows/expire-next` and `fail` all take an optional tag.
 *
 * A revoked session is kept in memory as `active: false` rather than deleted,
 * so a later call carrying its token is still attributed to the right tag and
 * still answered the way GoTrue answers for a session that is gone.
 *
 * LOGS. One JSON line per request, with the endpoint, the status, the tag and
 * the user's short name. Never a token, a code, a verifier, a refresh token or
 * the publishable key.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { SignJWT, exportJWK, generateKeyPair, type JWK } from 'jose';

import {
  FAKE_PUBLISHABLE_KEY,
  FAKE_USERS,
  FAKE_USER_NAMES,
  TEST_TAG_HEADER,
  type FakeUser,
  type FakeUserName,
} from './users';

/** GoTrue's API-version header and value, which auth-js needs to read `code` out of an error body. */
const API_VERSION_HEADER = 'X-Supabase-Api-Version';
const API_VERSION = '2024-01-01';

/** Supabase's default access-token lifetime (kickoff-package.md §4.8). */
export const DEFAULT_TOKEN_LIFETIME_SECONDS = 3600;

/**
 * The query GoTrue puts on the **Site URL root** when the PKCE flow state is
 * already gone at the moment the provider leg comes back, copied verbatim from
 * the founder's real walk (2026-09-26, Supabase dev project):
 *
 *     GET http://127.0.0.1:3100/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+has+expired
 *
 * Written out as one literal rather than assembled from parameters, because the
 * whole point of this control is to reproduce that request character for
 * character — the spelling of `bad_oauth_state`, the `+` for the spaces and the
 * order of the three parameters included.
 */
const SITE_URL_EXPIRED_QUERY =
  'error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+has+expired';

/**
 * GoTrue's refresh-token reuse interval: a token that has just been rotated
 * still works for this long, so two tabs refreshing together both stay signed
 * in (§4.3). Outside it, a reused token ends the session.
 */
export const REFRESH_REUSE_INTERVAL_MS = 10_000;

/** The endpoints the per-tag counters are kept for. */
export const CALL_KINDS = ['authorize', 'consent', 'token_pkce', 'token_refresh', 'logout', 'user', 'jwks'] as const;
export type CallKind = (typeof CALL_KINDS)[number];

/** What `GET /auth/v1/authorize` was asked for, as a test reads it back. */
export interface AuthorizeRecord {
  provider: string | null;
  redirectTo: string | null;
  /** Null when the caller asked for no extra scopes, which is what M2-AC02/1 requires. */
  scopes: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  skipHttpRedirect: boolean;
}

/** One session, as the control API reports it. */
export interface SessionRecord {
  id: string;
  userName: FakeUserName;
  active: boolean;
}

/** The per-tag report of `GET /_control/calls?tag=…`. */
export interface CallReport {
  tag: string;
  calls: Record<CallKind, number>;
  authorize: AuthorizeRecord[];
  sessions: SessionRecord[];
}

/** Which endpoint a one-shot failure is armed for. */
export const FAILABLE_ENDPOINTS = ['logout', 'user'] as const;
export type FailableEndpoint = (typeof FAILABLE_ENDPOINTS)[number];

export interface FakeAuthServerOptions {
  /** 0 (the default) takes an ephemeral port; FAKE_AUTH_PORT pins one. */
  port?: number;
  /** false silences the per-request log line, which the in-process self-test does. */
  log?: boolean;
}

export interface FakeAuthServer {
  /** The value of `SUPABASE_URL`: an origin with no path, as `originSchema` requires. */
  url: string;
  /** The value of `WRINGY_E2E_AUTH_CONTROL`: `<url>/_control`. */
  controlUrl: string;
  /** The value of `SUPABASE_PUBLISHABLE_KEY`. */
  publishableKey: string;
  port: number;
  stop(): Promise<void>;
}

// --- internal state ----------------------------------------------------------

interface FlowState {
  code: string;
  challenge: string | null;
  challengeMethod: string | null;
  user: FakeUser;
  tag: string | null;
  expired: boolean;
}

interface PendingAuthorize {
  id: string;
  record: AuthorizeRecord;
  tag: string | null;
}

interface SessionState {
  id: string;
  user: FakeUser;
  tag: string | null;
  refreshToken: string;
  /** The token the last rotation replaced, still honoured inside the reuse interval. */
  previousRefreshToken: string | null;
  previousRotatedAt: number | null;
  /** null means "no expiry", as `auth.sessions.not_after` does. */
  notAfter: Date | null;
  active: boolean;
}

interface ArmedFailure {
  status: number;
  code: string;
}

/** The two claims this process reads back out of a token it signed. */
interface TokenSubject {
  sub: string;
  sessionId: string;
}

/** What one request did, for the log line and the counters. */
interface Outcome {
  kind?: CallKind;
  tag: string | null;
  status: number;
  user?: FakeUserName;
  detail?: string;
}

const base64url = (input: Buffer): string => input.toString('base64url');

const sha256Challenge = (verifier: string): string => base64url(createHash('sha256').update(verifier).digest());

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/** A body of at most 64 KiB, read as JSON, or as a form body when that fails. */
async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.byteLength;
    if (size > 64 * 1024) throw new Error('the simulated auth server was sent a body over 64 KiB');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return Object.fromEntries(new URLSearchParams(text).entries());
  }
}

const readString = (body: Record<string, unknown>, key: string): string | null => {
  const value = body[key];
  return typeof value === 'string' && value !== '' ? value : null;
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const knownUser = (name: string): FakeUser | undefined => (FAKE_USERS as Record<string, FakeUser | undefined>)[name];

/**
 * Starts the server and resolves once it is listening. Nothing is written to
 * disk and nothing outside loopback is contacted.
 */
export async function startFakeAuthServer({ port = 0, log = true }: FakeAuthServerOptions = {}): Promise<FakeAuthServer> {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const kid = `fake-es256-${randomUUID()}`;
  const publicJwk: JWK = { ...(await exportJWK(publicKey)), kid, alg: 'ES256', use: 'sig' };

  const flows = new Map<string, FlowState>();
  const pending = new Map<string, PendingAuthorize>();
  /** Every session ever created, revoked ones kept as `active: false` (see the header). */
  const sessions = new Map<string, SessionState>();
  /** refresh token → session id, for the current token and the one inside the reuse interval. */
  const refreshIndex = new Map<string, string>();
  const counters = new Map<string, Record<CallKind, number>>();
  const authorizeRecords = new Map<string, AuthorizeRecord[]>();
  const lifetimeByTag = new Map<string, number>();
  const expireNextByTag = new Set<string>();
  /**
   * Tags whose next consent must come back on the Site URL root instead of on
   * `redirect_to`. The value is the Site URL the control call named, or null to
   * derive it from the flow's own `redirect_to` origin.
   */
  const expireToSiteUrlByTag = new Map<string, string | null>();
  const failuresByTag = new Map<string, Map<FailableEndpoint, ArmedFailure>>();
  const globalFailures = new Map<FailableEndpoint, ArmedFailure>();
  let defaultLifetimeSeconds = DEFAULT_TOKEN_LIFETIME_SECONDS;
  let expireNextGlobal = false;
  /** The ungated form of `expireToSiteUrlByTag`: `undefined` means "not armed". */
  let expireToSiteUrlGlobal: string | null | undefined;
  /** The bound origin, so the `iss` claim never depends on the caller's Host header. */
  let selfOrigin = '';

  const emptyCounters = (): Record<CallKind, number> =>
    Object.fromEntries(CALL_KINDS.map((kind) => [kind, 0])) as Record<CallKind, number>;

  /** Counts one call. Called BEFORE the response is written, so a test that sees the response sees the count. */
  function count(tag: string | null, kind: CallKind): void {
    if (!tag) return;
    const existing = counters.get(tag) ?? emptyCounters();
    existing[kind] += 1;
    counters.set(tag, existing);
  }

  function lifetimeFor(tag: string | null): number {
    if (tag !== null) {
      const scoped = lifetimeByTag.get(tag);
      if (scoped !== undefined) return scoped;
    }
    return defaultLifetimeSeconds;
  }

  function takeFailure(tag: string | null, endpoint: FailableEndpoint): ArmedFailure | undefined {
    if (tag !== null) {
      const scoped = failuresByTag.get(tag);
      const armed = scoped?.get(endpoint);
      if (armed !== undefined) {
        scoped?.delete(endpoint);
        return armed;
      }
    }
    const armed = globalFailures.get(endpoint);
    if (armed !== undefined) globalFailures.delete(endpoint);
    return armed;
  }

  function takeExpireNext(tag: string | null): boolean {
    if (tag !== null && expireNextByTag.has(tag)) {
      expireNextByTag.delete(tag);
      return true;
    }
    if (expireNextGlobal) {
      expireNextGlobal = false;
      return true;
    }
    return false;
  }

  /**
   * One-shot, per tag, like `takeExpireNext`: whether this consent must come back
   * on the Site URL root, and which Site URL.
   *
   * `{ armed: false }` is the normal case. `{ armed: true, siteUrl: null }` means
   * "derive it from the flow's `redirect_to`", which is what a project whose Site
   * URL is `APP_ORIGIN` behaves like.
   */
  function takeExpireToSiteUrl(tag: string | null): { armed: boolean; siteUrl: string | null } {
    if (tag !== null && expireToSiteUrlByTag.has(tag)) {
      const siteUrl = expireToSiteUrlByTag.get(tag) ?? null;
      expireToSiteUrlByTag.delete(tag);
      return { armed: true, siteUrl };
    }
    if (expireToSiteUrlGlobal !== undefined) {
      const siteUrl = expireToSiteUrlGlobal;
      expireToSiteUrlGlobal = undefined;
      return { armed: true, siteUrl };
    }
    return { armed: false, siteUrl: null };
  }

  /** The GoTrue user object, as `GET /user` and the token responses carry it. */
  function userJson(user: FakeUser): Record<string, unknown> {
    const created = new Date(0).toISOString();
    return {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      email_confirmed_at: created,
      phone: '',
      confirmed_at: created,
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: {
        full_name: user.fullName,
        name: user.fullName,
        email: user.email,
        email_verified: true,
      },
      identities: [
        {
          identity_id: user.id,
          id: user.id,
          user_id: user.id,
          provider: 'google',
          identity_data: { email: user.email, email_verified: true, full_name: user.fullName, sub: user.id },
          created_at: created,
          updated_at: created,
        },
      ],
      created_at: created,
      updated_at: created,
      is_anonymous: false,
    };
  }

  function mintAccessToken(session: SessionState, lifetimeSeconds: number): Promise<string> {
    const issuedAt = nowSeconds();
    return new SignJWT({
      iss: `${selfOrigin}/auth/v1`,
      aud: 'authenticated',
      sub: session.user.id,
      email: session.user.email,
      phone: '',
      role: 'authenticated',
      aal: 'aal1',
      amr: [{ method: 'oauth', timestamp: issuedAt }],
      session_id: session.id,
      is_anonymous: false,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: {
        full_name: session.user.fullName,
        name: session.user.fullName,
        email: session.user.email,
        email_verified: true,
      },
      iat: issuedAt,
      exp: issuedAt + lifetimeSeconds,
    })
      .setProtectedHeader({ alg: 'ES256', kid, typ: 'JWT' })
      .sign(privateKey);
  }

  /**
   * Reads `sub` and `session_id` out of a token this process signed, WITHOUT
   * verifying the signature: the fake is not a security boundary, and every
   * caller here got its token from this process one HTTP hop earlier. The api
   * verifies for real against the JWKS (§4.4).
   */
  function subjectOf(token: string): TokenSubject | null {
    const parts = token.split('.');
    const payload = parts[1];
    if (parts.length !== 3 || payload === undefined) return null;
    try {
      const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (typeof claims !== 'object' || claims === null) return null;
      const record = claims as Record<string, unknown>;
      const sub = record['sub'];
      const sessionId = record['session_id'];
      if (typeof sub !== 'string' || typeof sessionId !== 'string') return null;
      return { sub, sessionId };
    } catch {
      return null;
    }
  }

  /**
   * GoTrue refuses a call to its token, logout and user endpoints without the
   * project's API key, so the fake does too.
   *
   * Not security — nothing here is — but coverage. Every call the web's Supabase
   * client makes carries `apikey: SUPABASE_PUBLISHABLE_KEY`, and the web's own
   * side of that wiring is asserted nowhere else: a renamed variable, the api's
   * value pasted in, or a stale key after a rotation would leave every simulated
   * row green and fail at the founder's first real sign-in. The browser-facing
   * endpoints (`/authorize`, the consent page, the JWKS) carry no key, because a
   * navigation cannot send one.
   */
  function apiKeyRefusal(request: IncomingMessage): { code: string; message: string } | null {
    const key = request.headers.apikey;
    if (key === undefined) return { code: 'no_api_key', message: 'No API key found in request.' };
    if (key !== FAKE_PUBLISHABLE_KEY) return { code: 'invalid_api_key', message: 'Invalid API key.' };
    return null;
  }

  function bearerOf(request: IncomingMessage): string | null {
    const header = request.headers.authorization;
    if (typeof header !== 'string') return null;
    return /^Bearer (\S+)$/.exec(header)?.[1] ?? null;
  }

  /**
   * Ends a session the way a sign-out or a revoke does. The row stays in
   * memory, and every refresh token it ever had stays in `refreshIndex`, so a
   * later call is still attributed to the right tag; `active` is what decides
   * the answer.
   */
  function endSession(session: SessionState): void {
    session.active = false;
  }

  // --- responses -------------------------------------------------------------

  function sendJson(response: ServerResponse, status: number, body: unknown): void {
    const text = JSON.stringify(body);
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      [API_VERSION_HEADER]: API_VERSION,
      'content-length': String(Buffer.byteLength(text)),
    });
    response.end(text);
  }

  /**
   * A GoTrue error: the status it uses, its API-version header and a body
   * carrying `code` (what auth-js reads when the version header is present),
   * `error_code` (older parsers) and a message.
   */
  function sendError(response: ServerResponse, status: number, code: string, message: string): void {
    sendJson(response, status, { code, error_code: code, message, msg: message });
  }

  function sendHtml(response: ServerResponse, status: number, html: string): void {
    response.writeHead(status, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      [API_VERSION_HEADER]: API_VERSION,
      'content-length': String(Buffer.byteLength(html)),
    });
    response.end(html);
  }

  function sendRedirect(response: ServerResponse, location: string): void {
    response.writeHead(302, { location, 'cache-control': 'no-store', [API_VERSION_HEADER]: API_VERSION });
    response.end();
  }

  // --- the consent page ------------------------------------------------------

  const CONSENT_PATH = '/auth/v1/authorize/consent';

  function consentPage(state: PendingAuthorize): string {
    const buttons = FAKE_USER_NAMES.map((name) => FAKE_USERS[name])
      .map(
        (user) =>
          `      <button type="submit" name="user" value="${user.name}" data-testid="fake-user-${user.name}">` +
          `${escapeHtml(user.fullName)} &lt;${escapeHtml(user.email)}&gt;</button>`,
      )
      .join('\n');
    return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Simulated identity provider</title></head>
<body data-app-state="fake-consent" data-fake-state="${escapeHtml(state.id)}">
  <h1>Simulated identity provider</h1>
  <p>This page is the internal Playwright suite's stand-in for Supabase Auth and the Google consent screen. No real
     account is involved.</p>
  <form method="POST" action="${CONSENT_PATH}">
    <input type="hidden" name="state" value="${escapeHtml(state.id)}">
${buttons}
  </form>
  <p><a href="${CONSENT_PATH}?state=${encodeURIComponent(state.id)}&amp;cancel=1" data-testid="fake-cancel">Cancel</a></p>
</body>
</html>
`;
  }

  /** Answers a completed or cancelled consent with the 302 back to `redirect_to`. */
  function completeConsent(
    state: PendingAuthorize,
    userName: string | null,
    tag: string | null,
    response: ServerResponse,
  ): Omit<Outcome, 'kind'> {
    pending.delete(state.id);
    const redirectTo = state.record.redirectTo;
    if (redirectTo === null) {
      sendError(response, 400, 'validation_failed', 'redirect_to is required.');
      return { tag, status: 400 };
    }
    let target: URL;
    try {
      target = new URL(redirectTo);
    } catch {
      sendError(response, 400, 'validation_failed', 'redirect_to is not a URL.');
      return { tag, status: 400 };
    }
    // The flow state was already gone when the provider leg came back, so there
    // is no `redirect_to` to honour: GoTrue falls back to the project's Site URL
    // and replaces whatever the provider said with its own `bad_oauth_state`.
    // Whether the person consented or cancelled makes no difference — the flow it
    // belonged to no longer exists. No code is minted and no session is created.
    const toSiteUrl = takeExpireToSiteUrl(tag ?? state.tag);
    if (toSiteUrl.armed) {
      // A named Site URL is used as it stands (a project's Site URL may carry a
      // path); a derived one is the callback origin's root, which is what a
      // project whose Site URL is `APP_ORIGIN` produces and what the walk saw.
      const siteUrl = toSiteUrl.siteUrl ?? new URL('/', target.origin).toString();
      sendRedirect(response, `${siteUrl}?${SITE_URL_EXPIRED_QUERY}`);
      return { tag, status: 302, detail: 'expired_to_site_url' };
    }

    if (userName === null) {
      target.searchParams.set('error', 'access_denied');
      target.searchParams.set('error_code', 'access_denied');
      target.searchParams.set('error_description', 'The person cancelled at the simulated provider.');
      sendRedirect(response, target.toString());
      return { tag, status: 302, detail: 'cancelled' };
    }
    const user = knownUser(userName);
    if (user === undefined) {
      sendError(response, 400, 'validation_failed', 'The simulated provider knows no such user.');
      return { tag, status: 400 };
    }
    const flowTag = tag ?? state.tag;
    const code = randomUUID();
    flows.set(code, {
      code,
      challenge: state.record.codeChallenge,
      challengeMethod: state.record.codeChallengeMethod,
      user,
      tag: flowTag,
      expired: takeExpireNext(flowTag),
    });
    target.searchParams.set('code', code);
    sendRedirect(response, target.toString());
    return { tag, status: 302, user: user.name, detail: 'consented' };
  }

  // --- the router ------------------------------------------------------------

  async function handleAuth(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
    headerTag: string | null,
    method: string,
  ): Promise<Outcome | undefined> {
    if (url.pathname === '/auth/v1/.well-known/jwks.json' && method === 'GET') {
      count(headerTag, 'jwks');
      sendJson(response, 200, { keys: [publicJwk] });
      return { kind: 'jwks', tag: headerTag, status: 200 };
    }

    if (url.pathname === '/auth/v1/authorize' && method === 'GET') {
      count(headerTag, 'authorize');
      const record: AuthorizeRecord = {
        provider: url.searchParams.get('provider'),
        redirectTo: url.searchParams.get('redirect_to'),
        scopes: url.searchParams.get('scopes'),
        codeChallenge: url.searchParams.get('code_challenge'),
        codeChallengeMethod: url.searchParams.get('code_challenge_method'),
        skipHttpRedirect: url.searchParams.get('skip_http_redirect') === 'true',
      };
      if (headerTag !== null) authorizeRecords.set(headerTag, [...(authorizeRecords.get(headerTag) ?? []), record]);
      const state: PendingAuthorize = { id: randomUUID(), record, tag: headerTag };
      pending.set(state.id, state);
      // A non-browser client (the harness self-test, a request-context row) may
      // name the user straight away and skip the HTML.
      const chosen = url.searchParams.get('user');
      if (chosen !== null) return { kind: 'authorize', ...completeConsent(state, chosen, headerTag, response) };
      // `skip_http_redirect` is deliberately ignored: this one page stands in
      // for Supabase's provider redirect AND Google's consent screen, so a
      // browser must be able to land on it by navigation.
      sendHtml(response, 200, consentPage(state));
      return { kind: 'authorize', tag: headerTag, status: 200 };
    }

    if (url.pathname === CONSENT_PATH && (method === 'GET' || method === 'POST')) {
      count(headerTag, 'consent');
      const body = method === 'POST' ? await readBody(request) : {};
      const stateId = readString(body, 'state') ?? url.searchParams.get('state');
      const state = stateId === null ? undefined : pending.get(stateId);
      if (state === undefined) {
        sendError(response, 404, 'flow_state_not_found', 'No simulated authorize request is pending for that state.');
        return { kind: 'consent', tag: headerTag, status: 404 };
      }
      const cancelled = (readString(body, 'cancel') ?? url.searchParams.get('cancel')) !== null;
      const chosen = cancelled ? null : (readString(body, 'user') ?? url.searchParams.get('user'));
      if (!cancelled && chosen === null) {
        pending.delete(state.id);
        sendError(response, 400, 'validation_failed', 'Name a user, or cancel.');
        return { kind: 'consent', tag: headerTag, status: 400 };
      }
      return { kind: 'consent', ...completeConsent(state, chosen, headerTag, response) };
    }

    // The three endpoints a client calls, rather than a browser navigates to.
    if (['/auth/v1/token', '/auth/v1/logout', '/auth/v1/user'].includes(url.pathname)) {
      const refusal = apiKeyRefusal(request);
      if (refusal !== null) {
        sendError(response, 401, refusal.code, refusal.message);
        return { tag: headerTag, status: 401, detail: refusal.code };
      }
    }

    if (url.pathname === '/auth/v1/token' && method === 'POST') {
      const grantType = url.searchParams.get('grant_type');
      const body = await readBody(request);

      if (grantType === 'pkce') {
        const authCode = readString(body, 'auth_code');
        const verifier = readString(body, 'code_verifier');
        const flow = authCode === null ? undefined : flows.get(authCode);
        if (flow === undefined) {
          count(headerTag, 'token_pkce');
          sendError(response, 404, 'flow_state_not_found', 'No simulated flow state matches that code.');
          return { kind: 'token_pkce', tag: headerTag, status: 404 };
        }
        const tag = headerTag ?? flow.tag;
        count(tag, 'token_pkce');
        // A flow state is single use, whatever the outcome: a replay answers flow_state_not_found.
        flows.delete(flow.code);
        if (flow.expired) {
          sendError(response, 422, 'flow_state_expired', 'The simulated flow state has expired. Sign in again.');
          return { kind: 'token_pkce', tag, status: 422, user: flow.user.name };
        }
        const expected = flow.challenge;
        const matches =
          verifier !== null &&
          expected !== null &&
          (flow.challengeMethod === 'plain' ? verifier === expected : sha256Challenge(verifier) === expected);
        if (!matches) {
          sendError(response, 400, 'bad_code_verifier', 'The code verifier does not match the challenge of that flow.');
          return { kind: 'token_pkce', tag, status: 400, user: flow.user.name };
        }
        const session: SessionState = {
          id: randomUUID(),
          user: flow.user,
          tag: flow.tag,
          refreshToken: base64url(randomBytes(24)),
          previousRefreshToken: null,
          previousRotatedAt: null,
          notAfter: null,
          active: true,
        };
        sessions.set(session.id, session);
        refreshIndex.set(session.refreshToken, session.id);
        const lifetime = lifetimeFor(session.tag);
        const accessToken = await mintAccessToken(session, lifetime);
        sendJson(response, 200, {
          access_token: accessToken,
          refresh_token: session.refreshToken,
          expires_in: lifetime,
          expires_at: nowSeconds() + lifetime,
          token_type: 'bearer',
          user: userJson(session.user),
        });
        return { kind: 'token_pkce', tag, status: 200, user: session.user.name, detail: 'session_created' };
      }

      if (grantType === 'refresh_token') {
        const presented = readString(body, 'refresh_token');
        const sessionId = presented === null ? undefined : refreshIndex.get(presented);
        const session = sessionId === undefined ? undefined : sessions.get(sessionId);
        const tag = headerTag ?? session?.tag ?? null;
        count(tag, 'token_refresh');
        if (presented === null || session === undefined || !session.active) {
          sendError(response, 400, 'refresh_token_not_found', 'That refresh token is not current for any session.');
          return { kind: 'token_refresh', tag, status: 400, user: session?.user.name };
        }
        // Only the current token and the one the last rotation replaced are
        // honoured. Anything older is a reuse, which ends the session (§4.3).
        const isCurrent = presented === session.refreshToken;
        const isPrevious = presented === session.previousRefreshToken;
        const withinInterval =
          session.previousRotatedAt !== null && Date.now() - session.previousRotatedAt <= REFRESH_REUSE_INTERVAL_MS;
        if (!isCurrent && !(isPrevious && withinInterval)) {
          endSession(session);
          sendError(response, 400, 'refresh_token_not_found', 'That refresh token was reused after its rotation.');
          return { kind: 'token_refresh', tag, status: 400, user: session.user.name, detail: 'session_ended' };
        }
        if (isCurrent) {
          session.previousRefreshToken = session.refreshToken;
          session.previousRotatedAt = Date.now();
          session.refreshToken = base64url(randomBytes(24));
          refreshIndex.set(session.refreshToken, session.id);
        }
        const lifetime = lifetimeFor(session.tag);
        const accessToken = await mintAccessToken(session, lifetime);
        sendJson(response, 200, {
          access_token: accessToken,
          refresh_token: session.refreshToken,
          expires_in: lifetime,
          expires_at: nowSeconds() + lifetime,
          token_type: 'bearer',
          user: userJson(session.user),
        });
        return {
          kind: 'token_refresh',
          tag,
          status: 200,
          user: session.user.name,
          detail: isCurrent ? 'rotated' : 'reuse_within_interval',
        };
      }

      sendError(response, 400, 'validation_failed', 'Unsupported grant_type for the simulated auth server.');
      return { tag: headerTag, status: 400 };
    }

    if (url.pathname === '/auth/v1/logout' && method === 'POST') {
      const token = bearerOf(request);
      const subject = token === null ? null : subjectOf(token);
      const session = subject === null ? undefined : sessions.get(subject.sessionId);
      const tag = headerTag ?? session?.tag ?? null;
      count(tag, 'logout');
      const armed = takeFailure(tag, 'logout');
      if (armed !== undefined) {
        sendError(response, armed.status, armed.code, 'The simulated auth server was told to fail this logout.');
        return { kind: 'logout', tag, status: armed.status, detail: 'injected_failure' };
      }
      if (subject === null) {
        sendError(response, 401, 'no_authorization', 'This endpoint requires a bearer token.');
        return { kind: 'logout', tag, status: 401 };
      }
      const scope = url.searchParams.get('scope') ?? 'global';
      if (scope === 'local') {
        if (session !== undefined) endSession(session);
      } else {
        for (const candidate of sessions.values()) {
          if (candidate.user.id !== subject.sub || !candidate.active) continue;
          if (scope === 'others' && candidate.id === subject.sessionId) continue;
          endSession(candidate);
        }
      }
      response.writeHead(204, { 'cache-control': 'no-store', [API_VERSION_HEADER]: API_VERSION });
      response.end();
      return { kind: 'logout', tag, status: 204, user: session?.user.name, detail: `scope=${scope}` };
    }

    if (url.pathname === '/auth/v1/user' && method === 'GET') {
      const token = bearerOf(request);
      const subject = token === null ? null : subjectOf(token);
      const session = subject === null ? undefined : sessions.get(subject.sessionId);
      const tag = headerTag ?? session?.tag ?? null;
      count(tag, 'user');
      const armed = takeFailure(tag, 'user');
      if (armed !== undefined) {
        sendError(response, armed.status, armed.code, 'The simulated auth server was told to fail this user read.');
        return { kind: 'user', tag, status: armed.status, detail: 'injected_failure' };
      }
      if (subject === null) {
        sendError(response, 401, 'no_authorization', 'This endpoint requires a bearer token.');
        return { kind: 'user', tag, status: 401 };
      }
      if (session === undefined || !session.active) {
        // What GoTrue answers for a token whose session_id has no row: signed
        // out, or revoked. The api turns it into 401 `session.revoked` (R2).
        sendError(response, 403, 'session_not_found', 'That session does not exist any more.');
        return { kind: 'user', tag, status: 403 };
      }
      sendJson(response, 200, userJson(session.user));
      return { kind: 'user', tag, status: 200, user: session.user.name };
    }

    return undefined;
  }

  let closing = false;

  async function handleControl(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
    method: string,
    stop: () => void,
  ): Promise<Outcome> {
    const controlTag = url.searchParams.get('tag');

    if (url.pathname === '/_control/shutdown' && method === 'POST') {
      closing = true;
      sendJson(response, 200, { stopping: true });
      stop();
      return { tag: null, status: 200, detail: 'shutdown' };
    }

    if (url.pathname === '/_control/reset' && method === 'POST') {
      flows.clear();
      pending.clear();
      for (const session of sessions.values()) endSession(session);
      sessions.clear();
      refreshIndex.clear();
      counters.clear();
      authorizeRecords.clear();
      lifetimeByTag.clear();
      expireNextByTag.clear();
      expireToSiteUrlByTag.clear();
      failuresByTag.clear();
      globalFailures.clear();
      defaultLifetimeSeconds = DEFAULT_TOKEN_LIFETIME_SECONDS;
      expireNextGlobal = false;
      expireToSiteUrlGlobal = undefined;
      sendJson(response, 200, { reset: true });
      return { tag: null, status: 200, detail: 'reset' };
    }

    if (url.pathname === '/_control/calls' && method === 'GET') {
      if (controlTag === null) {
        sendError(response, 400, 'validation_failed', 'Name the tag whose calls to report.');
        return { tag: null, status: 400 };
      }
      const report: CallReport = {
        tag: controlTag,
        calls: counters.get(controlTag) ?? emptyCounters(),
        authorize: authorizeRecords.get(controlTag) ?? [],
        sessions: [...sessions.values()]
          .filter((session) => session.tag === controlTag)
          .map((session) => ({ id: session.id, userName: session.user.name, active: session.active })),
      };
      sendJson(response, 200, report);
      return { tag: controlTag, status: 200 };
    }

    if (url.pathname === '/_control/sessions' && method === 'GET') {
      sendJson(response, 200, {
        sessions: [...sessions.values()].filter((session) => session.active).map((session) => session.id),
      });
      return { tag: null, status: 200 };
    }

    if (url.pathname === '/_control/token-lifetime' && method === 'POST') {
      const body = await readBody(request);
      const seconds = Number(body['seconds']);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 86_400) {
        sendError(response, 400, 'validation_failed', 'seconds must be a whole number from 1 to 86400.');
        return { tag: controlTag, status: 400 };
      }
      const tag = readString(body, 'tag') ?? controlTag;
      if (tag === null) defaultLifetimeSeconds = seconds;
      else lifetimeByTag.set(tag, seconds);
      sendJson(response, 200, { seconds, tag });
      return { tag, status: 200, detail: `lifetime=${seconds}s` };
    }

    if (url.pathname === '/_control/flows/expire-next' && method === 'POST') {
      const body = await readBody(request);
      const tag = readString(body, 'tag') ?? controlTag;
      if (tag === null) expireNextGlobal = true;
      else expireNextByTag.add(tag);
      sendJson(response, 200, { expireNext: true, tag });
      return { tag, status: 200, detail: 'expire_next_flow' };
    }

    if (url.pathname === '/_control/flows/expire-to-site-url' && method === 'POST') {
      const body = await readBody(request);
      const tag = readString(body, 'tag') ?? controlTag;
      const siteUrl = readString(body, 'site_url');
      if (siteUrl !== null) {
        try {
          new URL(siteUrl);
        } catch {
          sendError(response, 400, 'validation_failed', 'site_url must be an absolute URL, or be left out.');
          return { tag, status: 400 };
        }
      }
      if (tag === null) expireToSiteUrlGlobal = siteUrl;
      else expireToSiteUrlByTag.set(tag, siteUrl);
      sendJson(response, 200, { expireToSiteUrl: true, tag, siteUrl });
      return { tag, status: 200, detail: 'expire_flow_to_site_url' };
    }

    if (url.pathname === '/_control/fail' && method === 'POST') {
      const body = await readBody(request);
      const endpoint = readString(body, 'endpoint');
      const status = Number(body['status']);
      const code = readString(body, 'code');
      const named = endpoint !== null && (FAILABLE_ENDPOINTS as readonly string[]).includes(endpoint);
      if (!named || !Number.isInteger(status) || status < 400 || status > 599 || code === null) {
        sendError(
          response,
          400,
          'validation_failed',
          `endpoint must be one of ${FAILABLE_ENDPOINTS.join(', ')}, status a 4xx or 5xx, and code a string.`,
        );
        return { tag: controlTag, status: 400 };
      }
      const tag = readString(body, 'tag') ?? controlTag;
      const armed: ArmedFailure = { status, code };
      if (tag === null) {
        globalFailures.set(endpoint as FailableEndpoint, armed);
      } else {
        const scoped = failuresByTag.get(tag) ?? new Map<FailableEndpoint, ArmedFailure>();
        scoped.set(endpoint as FailableEndpoint, armed);
        failuresByTag.set(tag, scoped);
      }
      sendJson(response, 200, { endpoint, status, code, tag });
      return { tag, status: 200, detail: `fail_next=${endpoint}` };
    }

    const revokeOne = /^\/_control\/sessions\/([^/]+)\/revoke$/.exec(url.pathname);
    if (revokeOne !== null && revokeOne[1] !== undefined && method === 'POST') {
      const id = decodeURIComponent(revokeOne[1]);
      const session = sessions.get(id);
      if (session !== undefined) endSession(session);
      sendJson(response, 200, { revoked: session !== undefined, id });
      return { tag: session?.tag ?? null, status: 200, user: session?.user.name, detail: 'session_revoked' };
    }

    const revokeAll = /^\/_control\/users\/([^/]+)\/revoke-all$/.exec(url.pathname);
    if (revokeAll !== null && revokeAll[1] !== undefined && method === 'POST') {
      const user = knownUser(decodeURIComponent(revokeAll[1]));
      if (user === undefined) {
        sendError(response, 404, 'not_found', 'The simulated provider knows no such user.');
        return { tag: controlTag, status: 404 };
      }
      let revoked = 0;
      for (const session of sessions.values()) {
        if (session.user.id !== user.id || !session.active) continue;
        endSession(session);
        revoked += 1;
      }
      sendJson(response, 200, { revoked, user: user.name });
      return { tag: controlTag, status: 200, user: user.name, detail: `revoked=${revoked}` };
    }

    sendError(response, 404, 'not_found', 'No such control endpoint on the simulated auth server.');
    return { tag: controlTag, status: 404 };
  }

  const server: Server = createServer((request, response) => {
    const host = request.headers.host ?? '127.0.0.1';
    const url = new URL(request.url ?? '/', `http://${host}`);
    const method = request.method ?? 'GET';
    const headerTagRaw = request.headers[TEST_TAG_HEADER.toLowerCase()];
    const headerTag = typeof headerTagRaw === 'string' && headerTagRaw !== '' ? headerTagRaw : null;

    const route = async (): Promise<Outcome> => {
      const handled = await handleAuth(request, response, url, headerTag, method);
      if (handled !== undefined) return handled;
      if (url.pathname.startsWith('/_control/')) {
        return await handleControl(request, response, url, method, () => {
          setTimeout(() => {
            server.closeAllConnections();
            server.close(() => process.exit(0));
          }, 50);
        });
      }
      sendError(response, 404, 'not_found', 'The simulated auth server does not serve that path.');
      return { tag: headerTag, status: 404 };
    };

    route()
      .then((outcome) => {
        if (!log) return;
        // No token, code, verifier, refresh token or key is ever logged.
        console.log(
          JSON.stringify({
            fake_auth: 'request',
            method,
            path: url.pathname,
            grant_type: url.searchParams.get('grant_type'),
            endpoint: outcome.kind ?? null,
            status: outcome.status,
            tag: outcome.tag,
            user: outcome.user ?? null,
            detail: outcome.detail ?? null,
          }),
        );
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (log) console.error(JSON.stringify({ fake_auth: 'error', path: url.pathname, message }));
        if (!response.headersSent) sendError(response, 500, 'unexpected_failure', 'The simulated auth server failed.');
        else response.end();
      });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const boundPort = address !== null && typeof address === 'object' ? address.port : 0;
  selfOrigin = `http://127.0.0.1:${boundPort}`;

  return {
    url: selfOrigin,
    controlUrl: `${selfOrigin}/_control`,
    publishableKey: FAKE_PUBLISHABLE_KEY,
    port: boundPort,
    stop: () =>
      new Promise<void>((resolve) => {
        if (closing) {
          resolve();
          return;
        }
        closing = true;
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
