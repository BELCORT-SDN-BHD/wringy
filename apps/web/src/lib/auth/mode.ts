/**
 * Which implementation the web server renders (M2-02 R13; kickoff-package.md
 * §8.6; ruling D32): `demo` is the M1 prototype unchanged, `internal` is the
 * server-backed internal build with Supabase sign-in.
 *
 * Read straight from `process.env`, never through `loadWebEnv()`. The mode is
 * what decides whether the internal build's three variables are required at
 * all, so learning it must not depend on them being present: an env-less
 * container has to be able to find out that it is a demo container and still
 * render the page's `not-configured` state (R12). This module therefore never
 * throws, validates nothing else, and reads exactly one variable.
 *
 * Server-only: nothing here is imported from a Client Component, and
 * `pnpm depcruise` keeps `src/lib/auth/` out of the demo tree
 * (rule `internal-not-to-demo`).
 */

/** The same two values as `@wringy/config`'s `APP_MODES`, as a literal union so this module needs no schema. */
export type AppMode = 'demo' | 'internal';

/** The variable name, in one place, so the proxy and the tests cannot drift from the schema. */
export const APP_MODE_VARIABLE = 'WRINGY_APP_MODE';

/** A raw environment: `process.env`, or a plain object in a test. */
export type ModeSource = Readonly<Record<string, string | undefined>>;

/**
 * `internal` only when the variable is exactly that string. Anything else —
 * absent, empty, `Internal`, `internal ` with a space, a typo — is `demo`, the
 * safe default: the demo origin exposes no cookie-writing surface (R13), so
 * mis-reading the mode can never open one, only close one.
 */
export function appMode(source: ModeSource = process.env): AppMode {
  return source[APP_MODE_VARIABLE] === 'internal' ? 'internal' : 'demo';
}

/** Convenience for the mode guard every new route handler applies first (R13). */
export function isInternalMode(source?: ModeSource): boolean {
  return appMode(source) === 'internal';
}
