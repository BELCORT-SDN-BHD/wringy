import { describe, expect, it } from 'vitest';

import { signInPath } from '@/lib/auth/outcomes';

import nextConfig from '../../next.config';

/**
 * `next dev`'s request log never prints an invitation token (M2-03;
 * m2-03-code-review.md R7, R9 rev 3). Next tests each ignore pattern against the
 * raw request URL (`next/dist/server/dev/log-requests.js`,
 * `ignoreLoggingIncomingRequests`), so these rows test the configured patterns
 * the same way, against the URLs a browser really sends: the accept link itself
 * and the sign-in redirect whose `next` carries it percent-encoded.
 */

const TOKEN = 'inviteToken_0123456789-abcdefghijklmnopqrst';
const ACCEPT = `/internal/invitations/accept?token=${TOKEN}`;

function ignored(url: string): boolean {
  const logging = nextConfig.logging;
  const patterns = logging === false || logging === undefined ? [] : (logging.incomingRequests as { ignore?: RegExp[] }).ignore ?? [];
  return patterns.some((pattern) => pattern.test(url));
}

describe('M2-AC03/3 invitation link: the dev request log never prints the token', () => {
  it('M2-AC03/3 invitation link: the accept URL and the sign-in redirect that carries it in next are not logged', () => {
    const signIn = signInPath({ next: ACCEPT, outcome: 'session_ended' });
    expect(signIn).toContain('%3Ftoken%3D');
    for (const url of [ACCEPT, `/internal/invitations/accept?utm=x&token=${TOKEN}`, signIn, signInPath({ next: ACCEPT })]) {
      expect(ignored(url), url.replace(TOKEN, '<token>')).toBe(true);
    }
  });

  it('M2-AC03/3 invitation link: ordinary requests are still logged', () => {
    for (const url of ['/internal', '/internal?outcome=joined', '/internal/orgs/0c0ffee0-0000-4000-8000-00000000000a', signInPath({ next: '/internal' })]) {
      expect(ignored(url), url).toBe(false);
    }
  });
});
