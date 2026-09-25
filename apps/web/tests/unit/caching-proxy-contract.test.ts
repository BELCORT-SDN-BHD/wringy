/**
 * The second half of the harness's own self-test (M2-02 R15).
 *
 * The M2-AC02/3 cache rows put an RFC 9111 **shared** cache in front of the web
 * instance and assert that it never hands one signed-in person another's page
 * (tests/e2e-internal/fixtures.ts `startCachingProxy`). A proxy that simply
 * never cached anything would pass that row while proving nothing — the same
 * trap as a fake auth server nobody checked. So this file drives the proxy
 * against a tiny upstream of its own and pins both halves of its behaviour:
 *
 * - a plainly cacheable response IS stored and served again from the store, so
 *   the proxy really is a cache;
 * - a `private, no-store` response is NOT stored, and the second visitor's
 *   request reaches the upstream and gets their own body — which is exactly what
 *   the E2E row asserts about `/internal`.
 *
 * No browser and no network beyond loopback: this runs in `pnpm --filter web test`.
 */
import { createServer, type Server } from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startCachingProxy, storableInSharedCache } from '../e2e-internal/fixtures';

/**
 * Two paths: one a shared cache may store, one it may not. `/private` answers
 * with the visitor's own name, taken from a header, so a cache hit would be
 * visible as the wrong name rather than as a missing assertion.
 */
let upstream: Server;
let upstreamOrigin = '';
let upstreamHits = 0;

beforeAll(async () => {
  upstream = createServer((request, response) => {
    upstreamHits += 1;
    const visitor = String(request.headers['x-visitor'] ?? 'nobody');
    if (request.url?.startsWith('/private')) {
      response.writeHead(200, {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'private, no-cache, no-store, must-revalidate, max-age=0',
        'set-cookie': 'session=opaque; Path=/; HttpOnly',
      });
      response.end(`private page for ${visitor}`);
      return;
    }
    response.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=60',
    });
    response.end(`public page for ${visitor}`);
  });
  await new Promise<void>((resolve, reject) => {
    upstream.once('error', reject);
    upstream.listen(0, '127.0.0.1', () => resolve());
  });
  const address = upstream.address();
  upstreamOrigin = `http://127.0.0.1:${address !== null && typeof address === 'object' ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    upstream.closeAllConnections();
    upstream.close(() => resolve());
  });
});

describe('M2-AC02/3 the shared-cache harness behaves like the cache it stands in for', () => {
  it('M2-AC02/3 simulated harness self-test: the shared-cache proxy stores what RFC 9111 allows and nothing more', async () => {
    const proxy = await startCachingProxy(upstreamOrigin);
    try {
      const hitsBefore = upstreamHits;

      // A `public, max-age=60` page: a shared cache may store it, so the second
      // visitor sees the FIRST visitor's body and the upstream is not asked again.
      const publicFirst = await fetch(`${proxy.origin}/public`, { headers: { 'x-visitor': 'alice' } });
      expect(publicFirst.status).toBe(200);
      expect(await publicFirst.text()).toBe('public page for alice');
      expect(publicFirst.headers.get('x-wringy-proxy')).toBe('stored');
      expect(proxy.storedKeys()).toContain('GET /public');

      const publicSecond = await fetch(`${proxy.origin}/public`, { headers: { 'x-visitor': 'bob' } });
      expect(publicSecond.headers.get('x-wringy-proxy'), 'the proxy really is a cache').toBe('hit');
      expect(await publicSecond.text()).toBe('public page for alice');
      expect(proxy.hits()).toBe(1);
      expect(upstreamHits, 'the cache hit did not reach the upstream').toBe(hitsBefore + 1);

      // A `private, no-store` page that also sets a cookie: exactly the shape
      // §4.7 requires of every private page of the internal build.
      const privateFirst = await fetch(`${proxy.origin}/private`, { headers: { 'x-visitor': 'alice' } });
      expect(await privateFirst.text()).toBe('private page for alice');
      expect(privateFirst.headers.get('x-wringy-proxy')).toBe('pass');
      expect(proxy.storedKeys()).not.toContain('GET /private');

      const privateSecond = await fetch(`${proxy.origin}/private`, { headers: { 'x-visitor': 'bob' } });
      expect(privateSecond.headers.get('x-wringy-proxy')).toBe('pass');
      expect(await privateSecond.text(), "Bob never receives Alice's private page").toBe('private page for bob');
      expect(proxy.hits(), 'the private page was never served from the store').toBe(1);
    } finally {
      await proxy.stop();
    }
  });

  it('M2-AC02/3 simulated harness self-test: the shared-cache verdict matches http-cache-semantics on the shapes that matter', () => {
    const get = { method: 'GET', url: '/internal', headers: {} };
    // What the internal build must send, and what a shared cache must refuse.
    expect(
      storableInSharedCache(get, {
        status: 200,
        headers: { 'cache-control': 'private, no-cache, no-store, must-revalidate, max-age=0', 'set-cookie': 'a=b' },
      }),
    ).toBe(false);
    expect(storableInSharedCache(get, { status: 200, headers: { 'cache-control': 'private' } })).toBe(false);
    expect(storableInSharedCache(get, { status: 200, headers: { 'cache-control': 'no-store' } })).toBe(false);
    // A 200 with NO cache-control at all is heuristically storable, which is the
    // whole reason the rule has to be asserted rather than assumed.
    expect(storableInSharedCache(get, { status: 200, headers: {} })).toBe(true);
    expect(storableInSharedCache(get, { status: 200, headers: { 'cache-control': 'public, max-age=60' } })).toBe(true);
  });
});
