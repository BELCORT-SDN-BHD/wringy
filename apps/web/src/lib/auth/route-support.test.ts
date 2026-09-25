import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The cookie jar, driven the way `@supabase/ssr` drives it.
 *
 * `route-handlers.test.ts` mocks the Supabase client, so it cannot see the one
 * thing the library asks the jar that the handlers themselves never ask:
 * `getAll`. `applyServerStorage` decides what to remove with
 * `removeCookies.filter((name) => currentByName.has(name))`, where
 * `currentByName` is built from `getAll` alone. A `getAll` that reported only the
 * incoming cookies would tell the library that the session written earlier in the
 * same response does not exist, so `signOut()` would clear nothing and a refused
 * callback would leave the browser holding a session for an account the API just
 * refused (M2-02 R10; the internal suite's `not_allowed`, `disabled` and
 * `unexpected` rows are what caught it).
 *
 * `next/headers` only works inside a real request, so the incoming cookie store
 * is the one thing mocked here. Everything else is the real jar.
 */

const incoming = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [...incoming].map(([name, value]) => ({ name, value })),
      get: (name: string) => (incoming.has(name) ? { name, value: incoming.get(name) } : undefined),
    }),
}));

const { cookieJar } = await import('./route-support');

/** The name `@supabase/ssr` stores a session under on a loopback fake (`sb-<first label>-auth-token`). */
const SESSION = 'sb-127-auth-token';

/**
 * The second argument the library hands `setAll`: its own cache headers on the
 * first cookie write of a client's life, and `{}` on every later one. The jar
 * ignores them — `noStore()` is applied unconditionally instead (R20) — so what
 * they contain does not matter here, only that a caller passes something.
 */
const LIBRARY_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};
const NO_HEADERS = {};

/** What `NextResponse.cookies` does with the buffered writes: last write per name wins. */
function applied(jar: Awaited<ReturnType<typeof cookieJar>>): Map<string, { value: string; maxAge?: unknown }> {
  const out = new Map<string, { value: string; maxAge?: unknown }>();
  jar.applyTo({
    cookies: {
      set: (name: string, value: string, options?: Record<string, unknown>) => {
        out.set(name, { value, maxAge: options?.maxAge });
        return undefined;
      },
    },
  });
  return out;
}

describe('M2-AC02/1 cookie jar: what the browser will hold, not only what it sent', () => {
  beforeEach(() => {
    incoming.clear();
  });

  it('M2-AC02/1 cookie jar: read answers what arrived, and says nothing about a buffered write', async () => {
    incoming.set('wringy-auth-next', '%2Finternal');
    const jar = await cookieJar();

    expect(jar.read('wringy-auth-next')).toBe('%2Finternal');
    jar.set(SESSION, 'base64-written-now', { path: '/' });
    expect(jar.read(SESSION), 'read is the request, not the response').toBeUndefined();
  });

  it('M2-AC02/1 cookie jar: getAll reports a cookie buffered earlier in the same response', async () => {
    const jar = await cookieJar();

    expect(jar.adapter.getAll()).toEqual([]);
    jar.adapter.setAll([{ name: SESSION, value: 'base64-session', options: { path: '/' } }], LIBRARY_HEADERS);

    // This is the line `applyServerStorage` needs to be true before it will
    // remove anything: the session it just wrote has to be visible.
    expect(jar.adapter.getAll()).toEqual([{ name: SESSION, value: 'base64-session' }]);
  });

  it('M2-AC02/1 cookie jar: an expiry takes a name out of getAll instead of giving it an empty value', async () => {
    incoming.set(SESSION, 'base64-old-session');
    const jar = await cookieJar();

    jar.expire(SESSION, { path: '/' });

    // An empty value here would make the library re-read '' as a session and try
    // to parse it; absent is the honest answer.
    expect(jar.adapter.getAll()).toEqual([]);
  });

  it('M2-AC02/1 cookie jar: a later write replaces an earlier one for the same name', async () => {
    const jar = await cookieJar();

    jar.adapter.setAll([{ name: SESSION, value: 'base64-first', options: { path: '/' } }], LIBRARY_HEADERS);
    jar.adapter.setAll([{ name: SESSION, value: 'base64-second', options: { path: '/' } }], NO_HEADERS);

    expect(jar.adapter.getAll()).toEqual([{ name: SESSION, value: 'base64-second' }]);
    expect(applied(jar).get(SESSION)?.value).toBe('base64-second');
  });

  it('M2-AC02/1 cookie jar: the sign-out fallback expires a session written in this very response', async () => {
    const jar = await cookieJar();

    // What the refused callback does: exchange writes the session, then the
    // refusal has to take it away again.
    jar.adapter.setAll(
      [
        { name: SESSION, value: 'base64-session', options: { path: '/' } },
        { name: `${SESSION}.0`, value: 'base64-chunk', options: { path: '/' } },
      ],
      LIBRARY_HEADERS,
    );
    jar.expireSupabaseCookies(false);

    const writes = applied(jar);
    expect(writes.get(SESSION)).toEqual({ value: '', maxAge: 0 });
    expect(writes.get(`${SESSION}.0`)).toEqual({ value: '', maxAge: 0 });
    expect(jar.adapter.getAll(), 'no session cookie survives the refusal').toEqual([]);
  });

  it('M2-AC02/1 cookie jar: the fallback leaves a cookie that is not a session cookie alone', async () => {
    incoming.set('wringy-auth-next', '%2Finternal');
    incoming.set(SESSION, 'base64-old-session');
    const jar = await cookieJar();

    jar.expireSupabaseCookies(false);

    const writes = applied(jar);
    expect(writes.get(SESSION)).toEqual({ value: '', maxAge: 0 });
    expect(writes.has('wringy-auth-next'), 'the return path is not a session cookie').toBe(false);
  });

  it('M2-AC02/1 cookie jar: wrote() is false until something is buffered', async () => {
    incoming.set(SESSION, 'base64-old-session');
    const jar = await cookieJar();

    expect(jar.wrote()).toBe(false);
    jar.expireSupabaseCookies(false);
    expect(jar.wrote()).toBe(true);
  });
});
