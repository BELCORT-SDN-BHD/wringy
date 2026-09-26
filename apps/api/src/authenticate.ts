/**
 * Who is calling: Supabase access-token verification for every authenticated
 * route (kickoff-package.md §4.4; M2-02 R8, R9, R18).
 *
 * The identity is the **verified token and nothing else**. `X-User-Id`, `X-Role`
 * and a `userId`, `orgId` or `role` in the body are never read here or anywhere
 * else; the actor comes from claims jose has checked against the project's JWKS.
 * `user_metadata` and `app_metadata` are never used for authorisation: the
 * display name is taken from them for display only, and the address that decides
 * the sign-in gate is the top-level `email` claim GoTrue sets from the identity
 * store, never a metadata field a provider could set.
 *
 * Two safety properties are worth stating, because getting them wrong is how an
 * auth layer becomes a denial-of-service or an open door:
 *
 * 1. **Every token fault is one answer.** No/invalid bearer, a wrong issuer or
 *    audience, an algorithm outside `ES256`, a missing required claim, a role
 *    other than `authenticated`, an anonymous token, a token from Supabase's
 *    OAuth-server feature (`client_id`), an unknown key id and a bad signature all
 *    answer 401 `unauthenticated` with one fixed message. Only an expired token is
 *    told apart (`auth.expired`), because the web must sign in again rather than
 *    report a fault.
 * 2. **A JWKS blip is never a sign-out.** When the key set cannot be fetched or
 *    times out, the answer is 503 `auth_unavailable`, retryable. `no matching key`
 *    is *not* such a failure: it means this token names a key the project does not
 *    publish, which is the token's fault (401).
 *
 * The profile is loaded in the same hook, so no route can forget it: a disabled
 * profile is refused everywhere (403 `account.disabled`, ruling D12), and a
 * verified subject with no profile row may only call the one route that creates
 * it (`POST /identity/sign-in`, which declares `config: { allowMissingProfile: true }`).
 *
 * Nothing here is logged but a reason word. The token and the session id never
 * reach a log line, and a jose claim-validation error is never logged as an
 * object, because it carries the whole decoded payload (the session id with it).
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { errors as joseErrors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

import type { Profile } from '@wringy/contracts';

import { errorBody } from './errors';

/**
 * An async onRequest hook. To refuse a request it sends the reply and returns
 * it (`return reply.code(401).send(...)`), which stops the route there.
 */
export type AuthenticateHook = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

/** The signed-in caller, as the verified token states them. */
export interface Actor {
  /** The token's `sub`: the only identity, and `app.profiles.id`. */
  userId: string;
  /** The token's `session_id`, for the liveness check on commands (§4.6). Never logged. */
  sessionId: string;
  /** The top-level `email` claim, or null when the token carries none. Never from metadata. */
  email: string | null;
  /** `user_metadata.full_name` or `user_metadata.name`; display only. */
  displayName: string | null;
  /** The raw bearer token, for the auth-server liveness adapter. Never logged. */
  token: string;
  /** The token's own `exp`, so a page can say how long this tab stays signed in. */
  expiresAt: Date;
}

/** Reads `app.profiles` by the verified subject; null when the person has never signed in. */
export type ReadProfile = (userId: string) => Promise<Profile | null>;

declare module 'fastify' {
  interface FastifyInstance {
    /** Runs before every authenticated route; required in BuildAppOptions (R8). */
    authenticate: AuthenticateHook;
  }

  interface FastifyRequest {
    /** Set by the authentication hook on every request it lets through. */
    actor?: Actor;
    /** The caller's profile, loaded by the same hook; null only on POST /identity/sign-in. */
    profile?: Profile | null;
  }

  interface FastifyContextConfig {
    /**
     * This route may be reached by a verified subject with no profile row. Only
     * `POST /identity/sign-in` sets it: it is the route that creates the row.
     */
    allowMissingProfile?: boolean;
  }
}

/** `Vary` value for responses of routes behind the hook; `/health` must not carry it (R18). */
export const VARY_AUTHORIZATION = 'Authorization';

/**
 * The actor of a request that came through the hook. Absent means a route was
 * registered outside an authenticated scope, which is a wiring bug, not a client
 * error: it ends as 500, never as an unauthenticated read.
 */
export function actorOf(request: FastifyRequest): Actor {
  if (request.actor === undefined) {
    throw new Error('this route ran without the authentication hook; register it in an authenticated scope');
  }
  return request.actor;
}

/**
 * The profile loaded by the hook. Throws on a route that declared
 * `allowMissingProfile` and therefore may see none — such a route reads
 * `request.profile` itself.
 */
export function profileOf(request: FastifyRequest): Profile {
  const profile = request.profile;
  if (profile === undefined || profile === null) {
    throw new Error('this route ran without a profile; it must not declare allowMissingProfile');
  }
  return profile;
}

/**
 * jose error codes that mean **this token** is not acceptable. Everything else
 * jose can throw (a timed-out or unreachable key set, a key set that is not one,
 * a transport failure with no code at all) is an availability problem, answered
 * 503 so a blip cannot sign anybody out. `ERR_JWKS_NO_MATCHING_KEY` is here on
 * purpose: it is the token naming a key the project does not publish.
 */
const TOKEN_REJECTED_CODES = new Set([
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JOSE_NOT_SUPPORTED',
  'ERR_JWK_INVALID',
  'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
  'ERR_JWKS_NO_MATCHING_KEY',
  'ERR_JWS_INVALID',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWT_INVALID',
]);

/** The claims the API insists on; jose refuses the token when one is absent. */
const REQUIRED_CLAIMS = ['sub', 'exp', 'iat', 'session_id', 'role', 'aal'];

/** Seconds of clock skew allowed on `exp` and `nbf`. */
const CLOCK_TOLERANCE_SECONDS = 5;

/** The audience Supabase puts in a signed-in user's access token. */
const AUDIENCE = 'authenticated';

/**
 * The only accepted `role` claim. It is a PostgreSQL role name, not a Wringy
 * role: it says "a signed-in user of this project", nothing about capabilities.
 */
const AUTHENTICATED_ROLE = 'authenticated';

/** The one accepted algorithm: the project signs ES256, so no shared secret exists anywhere. */
const ALGORITHMS = ['ES256'];

export interface SupabaseAuthenticateOptions {
  /** `${SUPABASE_URL}/auth/v1`, the project's token issuer. */
  issuer: string;
  /** The project's key set: `createRemoteJWKSet` in the process, a local set in tests. */
  jwks: JWTVerifyGetKey;
  readProfile: ReadProfile;
}

/**
 * `Bearer <token>`, case-insensitive scheme, exactly one token and nothing else.
 * What a token *is* is not decided here: jose owns that, so an `alg: none` JWT or
 * a truncated one is refused by the verifier rather than by a regular expression
 * that might disagree with it.
 */
function bearerOf(header: string | string[] | undefined): string | undefined {
  if (typeof header !== 'string') return undefined;
  return /^Bearer\s+(\S+)$/i.exec(header.trim())?.[1];
}

function stringClaim(payload: JWTPayload, name: string): string | null {
  const value = payload[name];
  return typeof value === 'string' && value !== '' ? value : null;
}

/** `user_metadata.full_name`, else `user_metadata.name`. Display only, never authorisation. */
function displayNameOf(payload: JWTPayload): string | null {
  const metadata = payload.user_metadata;
  if (metadata === null || typeof metadata !== 'object') return null;
  const { full_name: fullName, name } = metadata as { full_name?: unknown; name?: unknown };
  if (typeof fullName === 'string' && fullName !== '') return fullName;
  return typeof name === 'string' && name !== '' ? name : null;
}

/**
 * The real hook. Verifies the bearer token against `jwks`, builds
 * `request.actor`, then loads `request.profile` and applies R4 and R9.
 */
export function createSupabaseAuthenticate({ issuer, jwks, readProfile }: SupabaseAuthenticateOptions): AuthenticateHook {
  return async (request, reply) => {
    const refuse = (reason: string) => {
      // A reason word only: no token, no session id, no claim values.
      request.log.info({ reason }, 'request not authenticated');
      return reply.code(401).send(errorBody('unauthenticated'));
    };

    const token = bearerOf(request.headers.authorization);
    if (token === undefined) return refuse('no_bearer_token');

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, jwks, {
        issuer,
        audience: AUDIENCE,
        algorithms: ALGORITHMS,
        requiredClaims: REQUIRED_CLAIMS,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      }));
    } catch (error) {
      if (error instanceof joseErrors.JWTExpired) {
        request.log.info({ reason: 'expired' }, 'request not authenticated');
        return reply.code(401).send(errorBody('auth.expired'));
      }
      const code = error instanceof joseErrors.JOSEError ? error.code : undefined;
      if (code !== undefined && TOKEN_REJECTED_CODES.has(code)) return refuse(code);
      // Not the token's fault: the key set could not be fetched, parsed or reached.
      // The code only — a jose claim error would carry the decoded payload with it.
      request.log.warn({ code: code ?? 'transport_failure' }, 'token verification unavailable');
      return reply.code(503).send(errorBody('auth_unavailable'));
    }

    // Claims jose cannot check for us. `role` is a PostgreSQL role, not a Wringy role.
    if (payload.role !== AUTHENTICATED_ROLE) return refuse('role_not_authenticated');
    if (payload.is_anonymous === true) return refuse('anonymous_token');
    if ('client_id' in payload) return refuse('oauth_client_token');

    const userId = stringClaim(payload, 'sub');
    const sessionId = stringClaim(payload, 'session_id');
    const expiresAt = typeof payload.exp === 'number' ? new Date(payload.exp * 1000) : undefined;
    // requiredClaims already guarantees these; the narrowing keeps the actor honest.
    if (userId === null || sessionId === null || expiresAt === undefined) return refuse('claim_shape');

    request.actor = {
      userId,
      sessionId,
      email: stringClaim(payload, 'email'),
      displayName: displayNameOf(payload),
      token,
      expiresAt,
    };

    // A database failure here becomes 503 database_unavailable through the error
    // handler, never a 401: an unreachable database is not a failed sign-in.
    const profile = await readProfile(userId);
    if (profile !== null && profile.status === 'disabled') {
      request.log.info({ reason: 'account_disabled' }, 'request refused');
      return reply.code(403).send(errorBody('account.disabled'));
    }
    if (profile === null && request.routeOptions.config.allowMissingProfile !== true) {
      request.log.info({ reason: 'profile_missing' }, 'request refused');
      return reply.code(403).send(errorBody('profile.missing'));
    }
    request.profile = profile;
  };
}
