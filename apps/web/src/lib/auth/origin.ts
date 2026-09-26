/**
 * The Origin rule for every state-changing web endpoint (M2-02 R1;
 * kickoff-package.md §4.5 rules 1–2).
 *
 * Next.js checks `Origin` automatically for Server Actions only, and lets a
 * missing `Origin` through with a warning. Wringy writes no Server Actions
 * (R1: every write path is a Route Handler), so this rule is Wringy's own code
 * and every new handler applies it right after the mode guard.
 *
 * The allowed origin is `APP_ORIGIN` from the environment. It is never derived
 * from `Host` or `X-Forwarded-Host`, both of which a client controls.
 *
 * The two rules, in order:
 *
 *  1. `Origin` present → it must equal `APP_ORIGIN` exactly, by string. The
 *     header carries a canonical serialisation (no path, no trailing slash) and
 *     `@wringy/config`'s `originSchema` accepts only that same serialisation for
 *     `APP_ORIGIN`, so a string comparison is the whole check and no
 *     normalisation step can disagree with it. `Origin: null` — what a browser
 *     sends from a sandboxed iframe or an opaque origin — is a present header
 *     that does not equal `APP_ORIGIN`, so it is rejected here rather than
 *     falling through to rule 2.
 *  2. `Origin` absent → accept only `Sec-Fetch-Site: same-origin`. Every
 *     browser Wringy supports sends `Sec-Fetch-Site` on form posts; a
 *     cross-site post carries `cross-site` (or `same-site` for a sibling
 *     subdomain), and a non-browser client that sends neither header is
 *     rejected because it cannot be shown to be same-origin.
 *
 * A rejected request never reaches Fastify (§4.5 rule 4): the caller answers
 * 403 before doing any work, which the handler tests assert by showing that the
 * upstream mock was never called.
 */

/** Just the headers this rule reads, so a `Request` and a `NextRequest` both fit. */
interface OriginBearing {
  readonly headers: { get(name: string): string | null };
}

export type OriginCheck = 'ok' | 'rejected';

export function checkOrigin(request: OriginBearing, appOrigin: string): OriginCheck {
  const origin = request.headers.get('origin');

  // Rule 1. `Origin: null` lands here too: it is present, and it is not APP_ORIGIN.
  if (origin !== null && origin !== '') {
    return origin === appOrigin ? 'ok' : 'rejected';
  }

  // Rule 2. No Origin at all: only the browser's own same-origin signal passes.
  return request.headers.get('sec-fetch-site') === 'same-origin' ? 'ok' : 'rejected';
}
