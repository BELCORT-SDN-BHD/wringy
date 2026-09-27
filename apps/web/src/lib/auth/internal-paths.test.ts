import { describe, expect, it } from 'vitest';

import { internalRouteOf, isUnder, NOT_FOUND_PATH, rendersSignedOut, SIGN_IN_PATH, type InternalRoute } from './internal-paths';

/**
 * The internal build's routing shape (M2-02 R12; M2-04 T4): one classification
 * that `proxy.ts` routes by and `POST /internal/locale` reads, so the two cannot
 * disagree about which pages render signed out. `route-handlers.test.ts` (the
 * locale handler's drift guard) runs the real proxy against the same predicate.
 */

describe('M2-AC02/3 cache: every path belongs to exactly one route of the internal build', () => {
  it('M2-AC02/3 cache: each route, with the anchored match that keeps look-alikes outside', () => {
    const rows: [string, InternalRoute][] = [
      ['/', 'root'],
      ['/auth', 'auth'],
      ['/auth/callback', 'auth'],
      ['/auth/no-such-handler', 'auth'],
      ['/authors', 'outside'],
      ['/campaigns', 'outside'],
      ['/internal-tools', 'outside'],
      [SIGN_IN_PATH, 'public'],
      [NOT_FOUND_PATH, 'public'],
      ['/internal', 'private'],
      ['/internal/orgs/abc', 'private'],
      ['/internal/sign-in/x', 'private'],
      ['/internal/__not-found/x', 'private'],
      ['/internal/sign-in-help', 'private'],
    ];
    for (const [pathname, route] of rows) expect(internalRouteOf(pathname), pathname).toBe(route);
  });

  it('M2-AC04/1 shared device: a page renders signed out exactly when the proxy forwards it no token', () => {
    for (const pathname of [SIGN_IN_PATH, NOT_FOUND_PATH, '/campaigns', '/internal-tools', '/auth/no-such-handler']) {
      expect(rendersSignedOut(pathname), pathname).toBe(true);
    }
    // `/` is only ever a redirect to `/internal`, a signed-in page: a choice posted from it is not a guest's.
    for (const pathname of ['/', '/internal', '/internal/orgs/abc', '/internal/sign-in/x', '/internal/__not-found/x']) {
      expect(rendersSignedOut(pathname), pathname).toBe(false);
    }
  });

  it('M2-AC02/3 cache: under is anchored, never a bare prefix', () => {
    expect(isUnder('/internal', '/internal')).toBe(true);
    expect(isUnder('/internal/x', '/internal')).toBe(true);
    expect(isUnder('/internal-tools', '/internal')).toBe(false);
    expect(isUnder('/internalx/y', '/internal')).toBe(false);
  });
});
