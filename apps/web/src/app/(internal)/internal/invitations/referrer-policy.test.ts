import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The referrer policy of the two invitation pages (M2-03; m2-03-code-review.md
 * R7, R9 rev 3).
 *
 * The accept page carries the invitation token in its URL, so a Referer must
 * never carry the page's path or query — and its own Accept and sign-out forms
 * must still pass the M2-02 Origin rule. Under `no-referrer` the Fetch standard
 * sends `Origin: null` on a non-GET request, which the rule refuses (found by a
 * Chromium walk on 2026-09-26: the Accept POST answered 403), so the accept page
 * uses `strict-origin`: the origin only, never the path or the query, and
 * nothing at all on an https → http downgrade.
 *
 * The invitation page uses `strict-origin` too (rev 3). It posts nothing itself,
 * but a `<meta name="referrer">` governs the whole document, and its "Back to the
 * organisation" link is an App Router soft navigation that keeps the document:
 * under `no-referrer` every form on the org page and on `/internal` then posted
 * `Origin: null` and was refused until a full reload. So no page of this build
 * may use `no-referrer`; the E2E narrow-screen row submits a form right after
 * that soft navigation.
 */

const { metadata: acceptMetadata } = await import('./accept/page');
const { metadata: invitationMetadata } = await import('../orgs/[orgId]/invitations/[invitationId]/page');

/** Every source file under `src/app`, for the rule that holds for all of them. */
function appSources(directory = fileURLToPath(new URL('../../../', import.meta.url))): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return appSources(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('M2-AC03/3 invitation link: no Referer ever carries the token, and every form still passes the Origin rule', () => {
  it('M2-AC03/3 invitation link: the accept page sends at most the origin as a Referer, and not no-referrer', () => {
    expect(acceptMetadata.referrer).toBe('strict-origin');
  });

  it('M2-AC03/3 invitation link: the invitation page sends at most the origin too, so the pages it soft-navigates to keep a real Origin', () => {
    expect(invitationMetadata.referrer).toBe('strict-origin');
  });

  it('M2-AC03/3 invitation link: no page of this build sets no-referrer, which would make the rest of its document post Origin: null', () => {
    const sources = appSources();
    expect(sources.length).toBeGreaterThan(20);
    const offenders = sources.filter((path) => /['"]no-referrer['"]/.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
