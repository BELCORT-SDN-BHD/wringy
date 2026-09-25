/**
 * Server-to-server calls to the Fastify API that carry the caller's identity
 * (M2-02 R10, R19).
 *
 * The web never implements a business rule and never trusts an identity header
 * from a client: it forwards the verified access token as
 * `Authorization: Bearer <token>` and lets Fastify verify it, resolve the actor
 * and answer (kickoff-package.md §4.1). The token comes from `proxy.ts` through
 * `ACCESS_TOKEN_HEADER` for a page, or from the session cookie for a route
 * handler; either way it is read here and never logged, rendered or put in a URL.
 *
 * Like `api-read.ts`, this module **classifies rather than leaks**: it never
 * throws, every failure becomes a named result, and the log line carries a route,
 * a classification and a code — never a URL, a body, a token or a stack.
 *
 * It differs from `api-read.ts` in one way that matters: a 401 or 403 keeps the
 * API's own error code, so a caller can tell `account.disabled` from
 * `session.revoked` from `sign_in.not_allowed` and pick the right outcome (R4,
 * R9, R11). A page state alone could not carry that.
 */

import { headers } from 'next/headers';

import { ACCESS_TOKEN_HEADER } from './wire';

/** OPERATIONAL limit on one API call (not a business rule), matching `api-read.ts`. */
export const API_REQUEST_TIMEOUT_MS = 5_000;

/**
 * How a call failed in a way that has no code to show: the same three page
 * states `api-read.ts` uses, so one vocabulary covers every read and write.
 * `api-read.ts` re-exports this type.
 */
export type ApiFailure = 'api-unreachable' | 'api-unavailable' | 'unexpected';

/**
 * The outcome of one call.
 *
 * - `ok`: a 200 whose body matched the contract schema.
 * - `error`: the API refused with a status and, when it sent the standard
 *   envelope, its `code`. Used for 401/403, where the code decides what the
 *   person is told.
 * - `failure`: nothing usable came back. A 503 is `api-unavailable` (the API's
 *   database), an unreachable or stalled API is `api-unreachable`, anything else
 *   — including a 200 that breaks the contract — is `unexpected`.
 */
export type ApiResult<T> =
  | { readonly kind: 'ok'; readonly data: T }
  | { readonly kind: 'error'; readonly status: number; readonly code: string | null }
  | { readonly kind: 'failure'; readonly failure: ApiFailure };

/** The part of a zod schema this module uses; `@wringy/contracts`' schemas satisfy it. */
export interface ResponseSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

export interface ApiFetchOptions<T> {
  /** The API's internal base URL (`API_INTERNAL_URL`). Explicit, so this module reads no environment. */
  readonly baseUrl: string;
  /** The caller's verified access token. Absent means "no session": the API answers 401. */
  readonly token: string | null;
  readonly method?: 'GET' | 'POST';
  /** Validates a 200 body. A 200 that fails it is `unexpected`, never rendered. */
  readonly schema: ResponseSchema<T>;
  readonly timeoutMs?: number;
}

/** A network or abort code for the server log; never a URL, a message or a stack. */
function failureCode(error: unknown): string {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current !== null && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const { code, name } = current as { code?: unknown; name?: unknown };
    if (typeof code === 'string' && /^[A-Z0-9_]+$/.test(code)) return code;
    if (name === 'AbortError' || name === 'TimeoutError') return name;
    current = (current as { cause?: unknown }).cause;
  }
  return 'unknown';
}

/** One line per failed call: the method, the route and a code. No base URL, no body, no token. */
function logFailure(method: string, path: string, detail: string): void {
  console.warn(`[internal] ${method} ${path} failed: ${detail}`);
}

/**
 * The `code` from the standard error envelope `{ error: { code, message } }`,
 * or `null` when the body is not that shape. The `message` is never read: it is
 * for an operator's log, not for a decision or a page.
 */
export function errorCodeOf(body: unknown): string | null {
  if (body === null || typeof body !== 'object') return null;
  const { error } = body as { error?: unknown };
  if (error === null || typeof error !== 'object') return null;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' && code !== '' ? code : null;
}

/** Maps an HTTP answer to a result. Pure, so it is unit-tested directly. */
export function classifyApiResult<T>(status: number, body: unknown, schema: ResponseSchema<T>): ApiResult<T> {
  if (status === 200) {
    const parsed = schema.safeParse(body);
    return parsed.success ? { kind: 'ok', data: parsed.data } : { kind: 'failure', failure: 'unexpected' };
  }
  // The two statuses whose code the caller acts on (R9): which account, which session.
  if (status === 401 || status === 403) return { kind: 'error', status, code: errorCodeOf(body) };
  // Every 503 is retryable and must never be read as "signed out" (R9).
  if (status === 503) return { kind: 'failure', failure: 'api-unavailable' };
  return { kind: 'failure', failure: 'unexpected' };
}

/**
 * Call `path` on the API with the caller's Bearer token and validate a 200 body.
 * Never throws. The limit covers the body too, so an API that sends headers and
 * then stalls is `api-unreachable` rather than a hung page.
 */
export async function apiFetch<T>(
  path: string,
  { baseUrl, token, method = 'GET', schema, timeoutMs = API_REQUEST_TIMEOUT_MS }: ApiFetchOptions<T>,
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const requestHeaders: Record<string, string> = { accept: 'application/json' };
    if (token !== null && token !== '') requestHeaders.authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
        method,
        cache: 'no-store',
        signal: controller.signal,
        headers: requestHeaders,
      });
    } catch (error) {
      logFailure(method, path, `api-unreachable (${failureCode(error)})`);
      return { kind: 'failure', failure: 'api-unreachable' };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (controller.signal.aborted || failureCode(error) !== 'unknown') {
        logFailure(method, path, `api-unreachable (${failureCode(error)})`);
        return { kind: 'failure', failure: 'api-unreachable' };
      }
      body = undefined; // Not JSON: classified by status below.
    }

    const result = classifyApiResult(response.status, body, schema);
    if (result.kind === 'failure') logFailure(method, path, `${result.failure} (HTTP ${response.status})`);
    else if (result.kind === 'error') logFailure(method, path, `${result.code ?? 'no code'} (HTTP ${result.status})`);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The access token `proxy.ts` put on this request, for a Server Component.
 *
 * `headers()` is read-only and returns the **forwarded** request headers, which
 * is exactly what the proxy rewrote: it always overwrites or removes this header,
 * so nothing a client sent can appear here. `null` means the proxy saw no
 * session, which for a matched `/internal` GET means it already redirected.
 */
export async function accessTokenFromHeaders(): Promise<string | null> {
  const token = (await headers()).get(ACCESS_TOKEN_HEADER);
  return token !== null && token !== '' ? token : null;
}
