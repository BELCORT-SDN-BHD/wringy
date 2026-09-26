/**
 * What every organisation Route Handler does around its one API call (M2-03;
 * docs/m2-internal/m2-03-code-review.md R9 rev 2), in one place so the eight
 * handlers cannot drift from each other or from M2-02's order.
 *
 * The order is fixed: `guardRequest` (the demo build has no such endpoint; a
 * cross-site post is refused) → every dynamic segment parsed with the contracts'
 * `z.uuid()`, a failure answering `?outcome=forbidden` without calling the API
 * (Route Handlers receive their segments decoded, so an unparsed segment could
 * carry `/../` into the API path) → the access token read straight from the
 * session cookie, never refreshed (as `POST /internal/session-probe` explains) →
 * the API → a 303, so a reload never repeats the POST.
 *
 * The web decides nothing. It forwards the caller's token and the fields of the
 * form it rendered — never an org id from the body, since the path decides
 * (R5) — and names the API's answer with `refusalOutcome`.
 */

import type { NextResponse } from 'next/server';

import type { InternalAuthEnv } from '@/lib/auth/env';
import type { ApiResult } from '@/lib/auth/api-client';
import { cookieJar, guardRequest, seeOther, type CookieJar } from '@/lib/auth/route-support';
import { readStoredAccessToken } from '@/lib/auth/supabase-server';

import { END_SESSION_PATH, INTERNAL_PATH, withOutcome } from './org-paths';
import { END_SESSION, refusalOutcome, type OrgCommand, type OrgOutcome } from './outcomes';

/** The part of a zod schema this module uses; the contracts' params schemas satisfy it. */
export interface SegmentSchema<P> {
  safeParse(input: unknown): { success: true; data: P } | { success: false };
}

export type PreparedCommand<P> =
  | { readonly ok: false; readonly response: NextResponse }
  | {
      readonly ok: true;
      readonly env: InternalAuthEnv;
      readonly jar: CookieJar;
      /** `null` when the browser holds no session cookie; the handler answers `session_ended` without a call. */
      readonly token: string | null;
      readonly segments: P;
      /** The posted form, or `null` when the body was not a form at all. */
      readonly form: FormData | null;
    };

/**
 * Guard, parse the segments, read the token and the form. `segments` resolves
 * to `null` when a segment is not a uuid; a handler without dynamic segments
 * passes `noSegments`.
 */
export async function prepareCommand<P>(
  request: Request,
  segments: () => Promise<P | null>,
): Promise<PreparedCommand<P>> {
  const guard = guardRequest(request);
  if (!guard.ok) return guard;
  const { env } = guard;

  const parsed = await segments();
  if (parsed === null) return { ok: false, response: seeOther(withOutcome(INTERNAL_PATH, 'forbidden'), env.appOrigin) };

  const jar = await cookieJar();
  const token = await readStoredAccessToken(env.supabaseUrl, (name) => jar.read(name));
  const form = await readForm(request);
  return { ok: true, env, jar, token, segments: parsed, form };
}

/** The segments of a Route Handler's `params`, or `null` when any fails its schema. */
export async function parseSegments<P>(params: Promise<unknown>, schema: SegmentSchema<P>): Promise<P | null> {
  const parsed = schema.safeParse(await params);
  return parsed.success ? parsed.data : null;
}

/** For the two handlers with no dynamic segment. */
export const noSegments = (): Promise<Record<string, never>> => Promise.resolve({});

async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null; // Not a form body: every field reads as empty and the API decides.
  }
}

/** A text field of the posted form; absent, or a file, reads as the empty string. */
export function formText(form: FormData | null, name: string): string {
  const value = form?.get(name);
  return typeof value === 'string' ? value : '';
}

/** A 303 to `path?outcome=<outcome>`. */
export function answerWith(outcome: OrgOutcome, path: string, env: InternalAuthEnv): NextResponse {
  return seeOther(withOutcome(path, outcome), env.appOrigin);
}

/**
 * A 303 for a command the API did not carry out: to `/auth/end-session` for a
 * disabled account, otherwise back to `refusedTo` with the named outcome.
 */
export function answerRefusal(
  result: Exclude<ApiResult<unknown>, { kind: 'ok' }>,
  command: OrgCommand,
  refusedTo: string,
  env: InternalAuthEnv,
): NextResponse {
  const outcome = refusalOutcome(result, command);
  if (outcome === END_SESSION) return seeOther(END_SESSION_PATH, env.appOrigin);
  return answerWith(outcome, refusedTo, env);
}
