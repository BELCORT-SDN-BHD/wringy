/**
 * Server-to-server reads of the Fastify API for the `/internal` page
 * (kickoff-package.md §8.3: Browser → Next server component → Fastify → PostgreSQL).
 *
 * Runs only in the Next server: the page is a Server Component, the base URL
 * is the web process's own API_INTERNAL_URL, and nothing here reaches the
 * browser bundle. Every read is uncached (`cache: 'no-store'`) and bounded by
 * INTERNAL_API_TIMEOUT_MS. The body is validated with the @wringy/contracts
 * schema, so the page renders only fields the contract names.
 *
 * A failed read becomes one of three explicit page states, never an empty list
 * or a zero:
 * - `api-unreachable`: the request did not complete (refused, reset, timed out);
 * - `api-unavailable`: the API answered 503 (its database is unavailable);
 * - `unexpected`: any other status, or a 200 whose body breaks the contract.
 */

/** OPERATIONAL limit on one API read from the page (not a business rule). */
export const INTERNAL_API_TIMEOUT_MS = 5_000;

export type ApiFailure = 'api-unreachable' | 'api-unavailable' | 'unexpected';

export type ApiRead<T> = { ok: true; data: T } | { ok: false; failure: ApiFailure };

/** The part of a zod schema this module uses; @wringy/contracts' schemas satisfy it. */
export interface ResponseSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

/** Maps an HTTP answer to data or a page state. Pure, so it is unit-tested. */
export function classifyApiResponse<T>(status: number, body: unknown, schema: ResponseSchema<T>): ApiRead<T> {
  if (status === 503) return { ok: false, failure: 'api-unavailable' };
  if (status !== 200) return { ok: false, failure: 'unexpected' };
  const parsed = schema.safeParse(body);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, failure: 'unexpected' };
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

function logFailure(path: string, failure: ApiFailure, detail: string): void {
  // One line per failed read in the web server's log: the route, the page state
  // and a code. The base URL and any response body stay out of it.
  console.warn(`[internal] GET ${path} failed: ${failure} (${detail})`);
}

/**
 * GET `path` from the API at `baseUrl` and validate the 200 body with `schema`.
 * Never throws: every failure is an ApiRead with a page state.
 */
export async function readInternalApi<T>(baseUrl: string, path: string, schema: ResponseSchema<T>): Promise<ApiRead<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INTERNAL_API_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
        cache: 'no-store',
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
    } catch (error) {
      logFailure(path, 'api-unreachable', failureCode(error));
      return { ok: false, failure: 'api-unreachable' };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      // The connection dropped or timed out mid-body: the read did not complete.
      if (controller.signal.aborted || failureCode(error) !== 'unknown') {
        logFailure(path, 'api-unreachable', failureCode(error));
        return { ok: false, failure: 'api-unreachable' };
      }
      body = undefined; // Not JSON: classified by status below.
    }

    const result = classifyApiResponse(response.status, body, schema);
    if (!result.ok) logFailure(path, result.failure, `HTTP ${response.status}`);
    return result;
  } finally {
    clearTimeout(timer);
  }
}
