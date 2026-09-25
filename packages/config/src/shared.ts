import { z } from 'zod';

/** Where a process runs. The api and worker also compare it with `ops.environment` (W2). */
export const WRINGY_ENVS = ['local', 'ci', 'staging', 'production'] as const;
export const wringyEnvSchema = z.enum(WRINGY_ENVS);
export type WringyEnv = z.output<typeof wringyEnvSchema>;

/** A PostgreSQL connection string. No default anywhere: it carries a password. */
export const postgresUrlSchema = z.url({ protocol: /^postgres(ql)?$/ });

/**
 * True when `url`'s host is this machine: `localhost`, an IPv4 address in
 * 127.0.0.0/8, or `::1`. A loopback URL can still be a tunnel to another
 * machine, so callers that hand out fixed development values check more than
 * this (packages/db `resolveBootstrapPlan` also requires the embedded
 * cluster's port).
 */
export function isLoopbackUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    return false;
  }
  return hostname === 'localhost' || hostname === '::1' || /^127(\.\d{1,3}){3}$/.test(hostname);
}

/** An http(s) base URL for server-to-server calls. */
export const httpUrlSchema = z.url({ protocol: /^https?$/ });

/**
 * An http(s) **origin** and nothing else: scheme, host and optional port, with
 * no path (not even a trailing slash), no query, no fragment and no credentials
 * — the canonical serialisation a browser sends in `Origin`. It is compared
 * with request headers by string (kickoff-package.md §4.5), so a redundant
 * default port (`http://x:80`) or an upper-case host is refused rather than
 * silently normalised, and `https://x.supabase.co/auth/v1` cannot be pasted
 * where a project origin belongs.
 */
export function isHttpOrigin(value: string): boolean {
  // Nothing after the authority, and no `@`, so a userinfo section cannot hide a host.
  if (!/^https?:\/\/[^/?#\@\s]+$/.test(value)) return false;
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

export const originSchema = z.string().refine(isHttpOrigin);

/**
 * A Supabase **publishable** key (`sb_publishable_…`, or a legacy anon JWT).
 * Publishable by design, never a `sb_secret_…` key: no secret key reaches the
 * web or the api (kickoff-package.md §4.8, §8.5). The shape is deliberately
 * loose — Supabase may change the prefix — but long enough that a placeholder
 * cannot pass.
 */
export const publishableKeySchema = z.string().regex(/^[\w.-]{20,}$/);

/**
 * Which implementation the web server renders (kickoff-package.md §8.6, ruling
 * D32): `demo` is M1 unchanged, `internal` is the server-backed internal build.
 */
export const APP_MODES = ['demo', 'internal'] as const;
export const appModeSchema = z.enum(APP_MODES);
export type AppMode = z.output<typeof appModeSchema>;

/**
 * How the api answers "is this session still live?" (M2-02 R2):
 * - `database`: `platform.session_is_live(session_id, user_id)` in the app
 *   database, which only works where that database *is* the Supabase project's;
 * - `auth_server`: `GET <SUPABASE_URL>/auth/v1/user` with the caller's token.
 * Required, with no default, because the wrong answer is a silent one.
 */
export const SESSION_LIVENESS_MODES = ['database', 'auth_server'] as const;
export const sessionLivenessSchema = z.enum(SESSION_LIVENESS_MODES);
export type SessionLiveness = z.output<typeof sessionLivenessSchema>;
