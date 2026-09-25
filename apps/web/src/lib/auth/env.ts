/**
 * The environment the internal build's sign-in needs, as one narrowed value
 * (M2-02 R12, R14).
 *
 * `webEnvSchema` makes `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and
 * `APP_ORIGIN` optional fields with a `superRefine` that requires them when
 * `WRINGY_APP_MODE=internal`, so the demo build, the M1 Playwright suite and the
 * env-less image smoke keep working. That leaves their type as
 * `string | undefined` even in internal mode, which every caller would
 * otherwise have to re-check. This module does that check once and hands back a
 * value whose three fields are plain `string`s.
 *
 * It never throws. An unusable environment is `{ ok: false }`, which the proxy
 * turns into "pass the request through" (so the page renders its
 * `not-configured` state rather than a crash) and a route handler turns into a
 * 404 or an `unexpected` outcome. Only variable NAMES are ever reported, by
 * `EnvError`; no value reaches a log or a page.
 */

import { loadWebEnv, tryLoadEnv, type EnvProblem } from '@wringy/config/web';

import { appMode, type ModeSource } from './mode';

/** Everything the sign-in flow reads from the environment, all present. */
export interface InternalAuthEnv {
  /** This deployment's own origin. Every redirect is built from it, never from a request header. */
  readonly appOrigin: string;
  /** The Supabase project's origin (no path): the Auth server and the JWKS live under it. */
  readonly supabaseUrl: string;
  /** Publishable by design (kickoff-package.md §4.8); no `sb_secret_…` key exists in the web. */
  readonly publishableKey: string;
  /** The Fastify API, for the server-to-server calls the handlers and pages make. */
  readonly apiInternalUrl: string;
}

/**
 * `ok: false` carries why, for the page that lists missing variables by name.
 * `mode` is `demo` when the build simply is not the internal one — not a
 * misconfiguration, just a different build.
 */
export type InternalAuthEnvResult =
  | { readonly ok: true; readonly env: InternalAuthEnv }
  | { readonly ok: false; readonly reason: 'demo-mode' | 'invalid-env'; readonly problems: readonly EnvProblem[] };

export function internalAuthEnv(source: ModeSource = process.env): InternalAuthEnvResult {
  if (appMode(source) !== 'internal') return { ok: false, reason: 'demo-mode', problems: [] };

  const loaded = tryLoadEnv(() => loadWebEnv(source));
  if (!loaded.ok) return { ok: false, reason: 'invalid-env', problems: loaded.error.problems };

  const { APP_ORIGIN, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, API_INTERNAL_URL } = loaded.env;

  // The schema's superRefine already requires these three in internal mode, so
  // this is a type narrowing rather than a second rule. Keeping it means a
  // future schema change cannot silently hand a caller `undefined`.
  if (APP_ORIGIN === undefined || SUPABASE_URL === undefined || SUPABASE_PUBLISHABLE_KEY === undefined) {
    return { ok: false, reason: 'invalid-env', problems: [] };
  }

  return {
    ok: true,
    env: {
      appOrigin: APP_ORIGIN,
      supabaseUrl: SUPABASE_URL,
      publishableKey: SUPABASE_PUBLISHABLE_KEY,
      apiInternalUrl: API_INTERNAL_URL,
    },
  };
}
