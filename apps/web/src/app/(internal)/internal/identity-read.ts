/**
 * What a page of the internal build does with an identity-carrying read
 * (M2-02 R4, R11; extended to the M2-03 pages by m2-03-code-review.md R9 rev 2).
 *
 * A refusal of the caller is not a page state: it means this person should not
 * be looking at this page at all. A disabled account leaves through
 * `GET /auth/end-session`, the Route Handler that owns the cookie write (a
 * Server Component cannot write one); a 401 goes to the sign-in page with
 * `session_ended`. Everything else a read can answer becomes one of the three
 * M2-01 page states, so a page never renders a refusal it did not name as
 * nothing at all.
 */

import { redirect } from 'next/navigation';

import type { ApiFailure, ApiResult } from '@/lib/auth/api-client';
import { signInPath } from '@/lib/auth/outcomes';

import type { ApiRead } from './api-read';
import { END_SESSION_PATH } from './org-paths';

/**
 * Redirects when `result` refuses the caller. `redirect()` throws, so the call
 * sits outside any try/catch.
 */
export function redirectIfCallerRefused(result: ApiResult<unknown> | null): void {
  if (result === null || result.kind !== 'error') return;
  if (result.status === 403 && result.code === 'account.disabled') redirect(END_SESSION_PATH);
  if (result.status === 401) redirect(signInPath({ outcome: 'session_ended' }));
}

/**
 * A result as the sections read it: its data, or a page state. A refusal that
 * is not about the caller (and was not handled by the page first) is
 * `unexpected`, never an empty section.
 */
export function readOf<T>(result: ApiResult<T>): ApiRead<T> {
  if (result.kind === 'ok') return { ok: true, data: result.data };
  const failure: ApiFailure = result.kind === 'failure' ? result.failure : 'unexpected';
  return { ok: false, failure };
}

/**
 * `GET /orgs/:orgId` as an org page reads it (M2-03; R9 rev 2): the org, the
 * in-place `forbidden` state for the API's 403 `org.forbidden` (not a member,
 * no longer a member, or no such org — one answer), or a page state. Call
 * `redirectIfCallerRefused` first.
 */
export type OrgRead<T> = { kind: 'ok'; data: T } | { kind: 'forbidden' } | { kind: 'failure'; failure: ApiFailure };

export function orgReadOf<T>(result: ApiResult<T>): OrgRead<T> {
  if (result.kind === 'error' && result.status === 403 && result.code === 'org.forbidden') return { kind: 'forbidden' };
  const read = readOf(result);
  return read.ok ? { kind: 'ok', data: read.data } : { kind: 'failure', failure: read.failure };
}
