/**
 * The internal build's organisation URLs and the invitation-link cookie, in one
 * module so the Route Handlers that redirect and the pages that read cannot drift
 * (M2-03; docs/m2-internal/m2-03-code-review.md R9 rev 2).
 *
 * Every id that reaches one of these builders has already been parsed with the
 * contracts' `z.uuid()` (a Route Handler receives its segments decoded, so an
 * unparsed `x%2F..` would arrive as `x/..`), so nothing here escapes or checks.
 */

/** The internal build's home: the session, the workspaces and the M2-01 sections. */
export const INTERNAL_PATH = '/internal';

/** The Route Handler that ends a refused session; a page or a 303 cannot write that cookie itself. */
export const END_SESSION_PATH = '/auth/end-session';

/** The accept page. The token rides in its query, which is why the page sends no Referer. */
export const ACCEPT_PATH = '/internal/invitations/accept';

/** The Accept form's target: one segment below the page, because a `route.ts` cannot share a page's segment. */
export const ACCEPT_CONFIRM_PATH = '/internal/invitations/accept/confirm';

export function orgPath(orgId: string): string {
  return `/internal/orgs/${orgId}`;
}

export function invitationPath(orgId: string, invitationId: string): string {
  return `/internal/orgs/${orgId}/invitations/${invitationId}`;
}

/** The Workspaces section's create form. */
export const CREATE_ORG_PATH = '/internal/orgs/create';

/** Where each of the org page's forms posts: one Route Handler per command. */
export const ORG_ACTIONS = {
  rename: (orgId: string) => `${orgPath(orgId)}/rename`,
  invite: (orgId: string) => `${orgPath(orgId)}/invitations/create`,
  revoke: (orgId: string, invitationId: string) => `${invitationPath(orgId, invitationId)}/revoke`,
  role: (orgId: string, userId: string) => `${orgPath(orgId)}/members/${userId}/role`,
  remove: (orgId: string, userId: string) => `${orgPath(orgId)}/members/${userId}/remove`,
  leave: (orgId: string) => `${orgPath(orgId)}/leave`,
} as const;

/** `path` with `?outcome=<code>`; the codes are fixed words, so nothing needs encoding. */
export function withOutcome(path: string, outcome: string): string {
  return `${path}?outcome=${outcome}`;
}

/**
 * The accept link an admin hands over: `APP_ORIGIN` plus the accept page, with
 * the token as its query. Built only on the invitation page, from the cookie the
 * create handler set — never by a Route Handler, and never into a redirect (R7).
 */
export function acceptLink(appOrigin: string, token: string): string {
  const url = new URL(ACCEPT_PATH, appOrigin);
  url.searchParams.set('token', token);
  return url.toString();
}

/**
 * The cookie that carries a just-created invitation's token from the create
 * handler to the invitation page (R9 rev 2). The token never travels in the
 * admin's URL, so the admin's history and Referer carry nothing, and a crafted
 * URL cannot make an admin's page show another invitation's link.
 */
export function inviteCookieName(invitationId: string): string {
  return `wringy-invite-${invitationId}`;
}

/** Ten minutes: long enough to copy the link, short enough not to linger. */
export const INVITE_COOKIE_MAX_AGE_SECONDS = 600;

/**
 * The cookie's options: httpOnly (no script ever reads it), `sameSite: lax`,
 * `Secure` except on a loopback origin, and a path of exactly the invitation
 * page, so no other page is sent the token.
 */
export function inviteCookieOptions(orgId: string, invitationId: string, secure: boolean): Record<string, unknown> {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: invitationPath(orgId, invitationId),
    maxAge: INVITE_COOKIE_MAX_AGE_SECONDS,
  };
}
