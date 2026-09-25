/**
 * `safeNextPath()`: the one place a return path from outside is turned into
 * something safe to redirect to (M2-02 R10; kickoff-package.md §4.2 step 4).
 *
 * The callback redirects to `APP_ORIGIN + safeNextPath(...)`, so this function's
 * only job is to guarantee that its result cannot change the origin of that
 * URL. The value arrives in the `wringy-auth-next` cookie, written from a form
 * field, so it is attacker-influenced input.
 *
 * Accepted: a root-relative path — one leading `/`, then anything that is not
 * another `/`, with its query and fragment kept, so a creator who was sent to
 * `/internal?probe=ok` comes back to exactly that page.
 *
 * Refused (each falls back to DEFAULT_NEXT_PATH):
 *  - `//evil.example/x` — a protocol-relative URL: a browser reads the host
 *    after `//`, so `APP_ORIGIN + '//evil.example'` leaves the origin;
 *  - `https://evil.example`, `javascript:alert(1)`, `mailto:` — anything with a
 *    scheme, which `new URL(value, base)` would resolve away from the base;
 *  - `\\evil.example` and any path containing a backslash — browsers normalise
 *    `\` to `/` in URLs, so a backslash is a disguised `//`;
 *  - a path not starting with `/` — it would resolve relative to the callback
 *    and is never what the app asked for;
 *  - anything with a CR or LF (or any other control character), which could
 *    split the `Location` header;
 *  - an absent, empty or over-long value.
 */

/** Where an absent, empty or refused `next` lands: the internal build's own home. */
export const DEFAULT_NEXT_PATH = '/internal';

/**
 * A bound on the value, so a cookie stuffed with a megabyte of path cannot
 * become a `Location` header. Longer than any real Wringy path.
 */
export const MAX_NEXT_PATH_LENGTH = 512;

/** A scheme at the start (`https:`, `javascript:`, …), per RFC 3986's `scheme` production. */
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Any C0 control, space or DEL. CR and LF are the dangerous ones — they could
 * split the `Location` header — and the rest have no business in a path either.
 * Written with hex escapes so the space at the top of the range is visible.
 */
const HAS_CONTROL_OR_SPACE = /[\x00-\x20\x7f]/;

export function safeNextPath(value: string | null | undefined): string {
  if (typeof value !== 'string') return DEFAULT_NEXT_PATH;
  if (value === '' || value.length > MAX_NEXT_PATH_LENGTH) return DEFAULT_NEXT_PATH;

  // A backslash is a disguised slash once a browser normalises the URL, so it is
  // refused anywhere in the value, not just at the start.
  if (value.includes('\\')) return DEFAULT_NEXT_PATH;
  if (HAS_CONTROL_OR_SPACE.test(value)) return DEFAULT_NEXT_PATH;
  if (HAS_SCHEME.test(value)) return DEFAULT_NEXT_PATH;

  // Exactly one leading slash: `/internal` yes, `internal` no, `//evil` no.
  if (!value.startsWith('/')) return DEFAULT_NEXT_PATH;
  if (value.startsWith('//')) return DEFAULT_NEXT_PATH;

  return value;
}
