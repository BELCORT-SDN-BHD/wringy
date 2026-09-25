/**
 * Credential-free identity support for the API integration suite (M2-02 R15):
 * an ES256 key pair generated in the process, a local JWKS the real hook verifies
 * against, and a token signer that can produce every shape the hook must refuse.
 * No Supabase project, no secret and no network are involved, so the suite runs
 * on a laptop and in CI exactly the same way.
 *
 * `fakeAuthUserServer()` is the counterpart for the `auth_server` liveness
 * adapter: an in-process `GET /auth/v1/user` whose status, body and delay a test
 * sets, and which records what it was *sent* — as shapes, never as values, so a
 * failing assertion cannot print a token.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  UnsecuredJWT,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from 'jose';

/** The issuer every test token claims; the same shape the process uses (`<origin>/auth/v1`). */
export const TEST_ISSUER_ORIGIN = 'https://identity-test.invalid';

/**
 * A value shaped like a Supabase publishable key. It signs nothing: it exists so
 * the HS256 row can prove that a token signed with the *publishable* key — the one
 * value an attacker really has — is refused by the algorithm allow-list.
 */
export const TEST_PUBLISHABLE_KEY = 'sb_publishable_fake_0123456789abcdef';

export interface SignTokenOptions {
  /** The `sub` claim: the actor's user id. */
  sub?: string;
  /** The `session_id` claim. */
  sessionId?: string;
  /** The top-level `email` claim; null leaves it out entirely. */
  email?: string | null;
  /** `user_metadata.full_name`; null leaves the metadata empty. */
  displayName?: string | null;
  /** Seconds of remaining life. Negative or zero makes an already-expired token. */
  expiresIn?: number;
  overrides?: {
    /** Claims to add or replace; a value of `undefined` removes the claim. */
    claims?: Record<string, unknown>;
    /** Protected-header members to add or replace (`alg`, `kid`). */
    header?: Record<string, unknown>;
  };
}

export interface TestIdentity {
  /** What the hook is configured with: `<origin>/auth/v1`. */
  issuer: string;
  /** The key id the published set carries. */
  kid: string;
  /** The published key set, for a test that serves it over HTTP. */
  jwksJson: JSONWebKeySet;
  /** The resolver to hand `createSupabaseAuthenticate`; no network. */
  jwks: JWTVerifyGetKey;
  /** A token this identity's key set accepts (unless the options break it on purpose). */
  signToken(options?: SignTokenOptions): Promise<string>;
  /** The published `kid`, a valid ES256 signature — by a key the set does not contain. */
  signWithUnknownKey(options?: SignTokenOptions): Promise<string>;
  /** `alg: HS256`, signed with a shared secret (the publishable key, in the tests). */
  signHs256(secret: string, options?: SignTokenOptions): Promise<string>;
  /** `alg: none`, the unsecured JWT an attacker tries when a verifier is lax. */
  signUnsecured(options?: SignTokenOptions): string;
}

const DEFAULT_SUB = '11111111-1111-4111-8111-111111111111';
const DEFAULT_SESSION = '22222222-2222-4222-8222-222222222222';

function claimsFor(issuer: string, options: SignTokenOptions): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  const {
    sub = DEFAULT_SUB,
    sessionId = DEFAULT_SESSION,
    email = 'signed-in@example.test',
    displayName = 'Signed In',
    expiresIn = 3_600,
  } = options;

  const claims: Record<string, unknown> = {
    iss: issuer,
    aud: 'authenticated',
    sub,
    session_id: sessionId,
    role: 'authenticated',
    aal: 'aal1',
    amr: [{ method: 'oauth', timestamp: now }],
    is_anonymous: false,
    iat: now,
    exp: now + expiresIn,
    user_metadata: displayName === null ? {} : { full_name: displayName },
  };
  if (email !== null) claims.email = email;

  for (const [name, value] of Object.entries(options.overrides?.claims ?? {})) {
    if (value === undefined) delete claims[name];
    else claims[name] = value;
  }
  return claims;
}

/** An ES256 key pair, its published key set, and a signer for every token shape. */
export async function createTestIdentity(origin: string = TEST_ISSUER_ORIGIN): Promise<TestIdentity> {
  const issuer = `${origin}/auth/v1`;
  const kid = 'test-key-1';
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
  const other = await generateKeyPair('ES256', { extractable: true });
  const jwksJson: JSONWebKeySet = { keys: [{ ...(await exportJWK(publicKey)), kid, alg: 'ES256', use: 'sig' }] };

  const header = (options: SignTokenOptions, alg: string) =>
    ({ alg, kid, ...options.overrides?.header }) as Parameters<SignJWT['setProtectedHeader']>[0];

  return {
    issuer,
    kid,
    jwksJson,
    jwks: createLocalJWKSet(jwksJson),
    signToken: (options = {}) =>
      new SignJWT(claimsFor(issuer, options)).setProtectedHeader(header(options, 'ES256')).sign(privateKey),
    signWithUnknownKey: (options = {}) =>
      new SignJWT(claimsFor(issuer, options)).setProtectedHeader(header(options, 'ES256')).sign(other.privateKey),
    signHs256: (secret, options = {}) =>
      new SignJWT(claimsFor(issuer, options))
        .setProtectedHeader(header(options, 'HS256'))
        .sign(new TextEncoder().encode(secret)),
    signUnsecured: (options = {}) => new UnsecuredJWT(claimsFor(issuer, options)).encode(),
  };
}

/** `Authorization: Bearer <token>`, for `app.inject({ headers: bearer(token) })`. */
export function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

/** What the fake auth server answers next. */
export interface FakeUserResponse {
  status: number;
  /** Sent as JSON. A string is sent verbatim, for a body that is not JSON at all. */
  body?: unknown;
  /** Milliseconds to wait before answering, for the timeout row. */
  delayMs?: number;
}

/**
 * What the fake was sent, as shapes rather than values: a failing expectation may
 * print any of these, and none of them is a credential.
 */
export interface SeenRequest {
  method: string;
  path: string;
  /** True when `apikey` was exactly the publishable key the fake was created with. */
  apikeyMatched: boolean;
  /** The Authorization scheme (`Bearer`), or null when the header was absent. */
  authScheme: string | null;
  /** True when the bearer token was exactly `token`. */
  bearerIs(token: string): boolean;
  /** The `X-Supabase-Api-Version` header, or null. */
  apiVersion: string | null;
}

export interface FakeAuthUserServer {
  /** The origin to configure `authServerLiveness` with; `/auth/v1/user` is appended by the adapter. */
  url: string;
  /** Every request the fake received, oldest first. */
  seen: SeenRequest[];
  /** What it answers from now on. */
  respond(response: FakeUserResponse): void;
  close(): Promise<void>;
}

/** An in-process stand-in for `GET <SUPABASE_URL>/auth/v1/user` (M2-02 R2, Mechanism B). */
export async function fakeAuthUserServer(
  publishableKey: string = TEST_PUBLISHABLE_KEY,
): Promise<FakeAuthUserServer> {
  let next: FakeUserResponse = { status: 200, body: { id: DEFAULT_SUB, aud: 'authenticated' } };
  const seen: SeenRequest[] = [];
  const timers = new Set<NodeJS.Timeout>();

  const server: Server = createServer((request, response) => {
    // A delayed answer may arrive after the client aborted; a dead socket must
    // never become an unhandled error event that takes the test process down.
    response.on('error', () => {});
    const authorization = request.headers.authorization;
    const apikey = request.headers.apikey;
    const apiVersion = request.headers['x-supabase-api-version'];
    const [scheme, credential] = typeof authorization === 'string' ? authorization.split(' ', 2) : [];
    seen.push({
      method: request.method ?? '',
      path: (request.url ?? '').split('?', 1)[0] ?? '',
      apikeyMatched: apikey === publishableKey,
      authScheme: scheme ?? null,
      bearerIs: (token) => credential === token,
      apiVersion: typeof apiVersion === 'string' ? apiVersion : null,
    });

    const answer = next;
    const send = () => {
      response.writeHead(answer.status, {
        'content-type': 'application/json',
        'x-supabase-api-version': '2024-01-01',
      });
      response.end(typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body ?? {}));
    };
    if (answer.delayMs === undefined) {
      send();
      return;
    }
    const timer = setTimeout(() => {
      timers.delete(timer);
      // The client may already have aborted; writing to a dead socket must not throw.
      try {
        send();
      } catch {
        response.destroy();
      }
    }, answer.delayMs);
    timers.add(timer);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}`,
    seen,
    respond: (response) => {
      next = response;
    },
    close: async () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

export interface JwksServer {
  /** Use this as `SUPABASE_URL`: the issuer and the key-set path follow from it. */
  origin: string;
  /** How many times the key set has been fetched. */
  readonly requests: number;
  /** The key set to serve. Called after the identity is made, because its issuer needs `origin`. */
  publish(jwks: JSONWebKeySet): void;
  close(): Promise<void>;
}

/**
 * A tiny HTTP JWKS endpoint at `<origin>/auth/v1/.well-known/jwks.json`, so a test
 * can exercise the process's real `createRemoteJWKSet` wiring. It listens first
 * and takes its key set afterwards, because the identity's issuer is built from
 * the port this server ends up on.
 */
export async function serveJwks(): Promise<JwksServer> {
  const state: { requests: number; jwks: JSONWebKeySet } = { requests: 0, jwks: { keys: [] } };
  const server = createServer((request, response) => {
    if (request.url === '/auth/v1/.well-known/jwks.json') {
      state.requests += 1;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(state.jwks));
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' }).end('{}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${address.port}`,
    get requests() {
      return state.requests;
    },
    publish: (jwks) => {
      state.jwks = jwks;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
