import { describe, expect, it } from 'vitest';

/**
 * The referrer policy of the two invitation pages (M2-03; m2-03-code-review.md
 * R7, R9 rev 2).
 *
 * The accept page carries the invitation token in its URL, so a Referer must
 * never carry the page's path or query — and its own Accept and sign-out forms
 * must still pass the M2-02 Origin rule. Under `no-referrer` the Fetch standard
 * sends `Origin: null` on a non-GET request, which the rule refuses (found by a
 * Chromium walk on 2026-09-26: the Accept POST answered 403), so the accept page
 * uses `strict-origin`: the origin only, never the path or the query, and
 * nothing at all on an https → http downgrade. The invitation page posts
 * nothing and keeps `no-referrer`.
 */

const { metadata: acceptMetadata } = await import('./accept/page');
const { metadata: invitationMetadata } = await import('../orgs/[orgId]/invitations/[invitationId]/page');

describe('M2-AC03/3 invitation link: no Referer ever carries the token, and the accept forms still pass the Origin rule', () => {
  it('M2-AC03/3 invitation link: the accept page sends at most the origin as a Referer, and not no-referrer', () => {
    expect(acceptMetadata.referrer).toBe('strict-origin');
  });

  it('M2-AC03/3 invitation link: the invitation page, which posts nothing, sends no Referer at all', () => {
    expect(invitationMetadata.referrer).toBe('no-referrer');
  });
});
