import { describe, expect, it } from 'vitest';

import {
  isSecureOrigin,
  isSupabaseAuthCookie,
  readStoredAccessToken,
  sessionCookieOptions,
  sessionStorageKey,
  withSessionCookieOptions,
} from './supabase-server';

const SUPABASE_URL = 'https://abcdefghijklm.supabase.co';
const STORAGE_KEY = 'sb-abcdefghijklm-auth-token';

/** The cookie value `@supabase/ssr` writes: `base64-` plus base64url of the session JSON. */
function encodeSession(session: unknown): string {
  return `base64-${Buffer.from(JSON.stringify(session), 'utf8').toString('base64url')}`;
}

/** A cookie jar as a plain lookup, the way the probe handler passes one in. */
function cookies(entries: Record<string, string>) {
  return (name: string) => entries[name];
}

describe('M2-AC02/3 cache: cookie security follows the origin, not a library default', () => {
  it('M2-AC02/3 cache: Secure is off only for a loopback development origin', () => {
    expect(isSecureOrigin('http://127.0.0.1:3100')).toBe(false);
    expect(isSecureOrigin('http://localhost:3100')).toBe(false);
    expect(isSecureOrigin('http://127.0.0.5')).toBe(false);
    expect(isSecureOrigin('http://[::1]:3100')).toBe(false);
  });

  it('M2-AC02/3 cache: every other origin gets Secure, and an unparseable one fails closed', () => {
    for (const origin of [
      'https://app.wringy.test',
      'https://127.0.0.1', // https is always secure, loopback or not
      'http://staging.wringy.test', // not loopback: Secure, even though it is http
      'http://127.0.0.1.evil.example',
      'not a url',
      '',
    ]) {
      expect(isSecureOrigin(origin), origin).toBe(true);
    }
  });

  it('M2-AC02/3 cache: session cookies are httpOnly, lax and site-wide', () => {
    // httpOnly is the point: @supabase/ssr defaults it to false for a browser
    // client, and Wringy creates none, so no token is readable from JavaScript.
    expect(sessionCookieOptions(true)).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    expect(sessionCookieOptions(false)).toEqual({ httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
  });

  it('M2-AC02/3 cache: the library’s own cookie options are overridden, so httpOnly cannot be lost', () => {
    // @supabase/ssr defaults httpOnly to false and would send it on every session
    // cookie. This is the wrapper that stops that reaching a real Set-Cookie.
    const written = withSessionCookieOptions(
      [
        { name: 'sb-abcdefghijklm-auth-token', value: 'v', options: { httpOnly: false, path: '/', maxAge: 34_560_000 } },
        { name: 'sb-abcdefghijklm-auth-token-code-verifier', value: 'v', options: {} },
      ],
      true,
    );

    for (const cookie of written) {
      expect(cookie.options.httpOnly, cookie.name).toBe(true);
      expect(cookie.options.secure, cookie.name).toBe(true);
      expect(cookie.options.sameSite, cookie.name).toBe('lax');
      expect(cookie.options.path, cookie.name).toBe('/');
    }
    // Names and values are passed through untouched.
    expect(written.map((cookie) => cookie.name)).toEqual([
      'sb-abcdefghijklm-auth-token',
      'sb-abcdefghijklm-auth-token-code-verifier',
    ]);
    // A library option Wringy does not override is kept.
    expect(written[0].options.maxAge).toBe(34_560_000);
  });

  it('M2-AC02/3 cache: a loopback origin gets the same options with Secure off', () => {
    const [cookie] = withSessionCookieOptions([{ name: 'sb-x-auth-token', value: 'v', options: {} }], false);

    expect(cookie.options).toEqual({ httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
  });

  it('M2-AC02/3 cache: maxAge is deliberately not set, because the library overrides it', () => {
    // The library replaces whatever is passed with its own fixed 400 days
    // (accepted under D14, recorded in known-issues). Naming it here would look
    // like a control that does not exist.
    expect(sessionCookieOptions(true)).not.toHaveProperty('maxAge');
  });
});

describe('M2-AC02/2 isolation: the probe reads the stored token without any refresh', () => {
  it('M2-AC02/2 isolation: the storage key is derived from the project URL and is always an sb-* name', () => {
    expect(sessionStorageKey(SUPABASE_URL)).toBe(STORAGE_KEY);
    expect(sessionStorageKey('http://127.0.0.1:54321')).toBe('sb-127-auth-token');
    expect(isSupabaseAuthCookie(sessionStorageKey(SUPABASE_URL))).toBe(true);
    expect(isSupabaseAuthCookie('wringy-locale')).toBe(false);
    expect(isSupabaseAuthCookie('wringy-auth-next')).toBe(false);
  });

  it('M2-AC02/2 isolation: reads the access token out of a base64url session cookie', async () => {
    const jar = cookies({ [STORAGE_KEY]: encodeSession({ access_token: 'token-abc', refresh_token: 'r' }) });

    await expect(readStoredAccessToken(SUPABASE_URL, jar)).resolves.toBe('token-abc');
  });

  it('M2-AC02/2 isolation: reassembles a session split across numbered chunks', async () => {
    const encoded = encodeSession({ access_token: 'token-chunked' });
    const half = Math.ceil(encoded.length / 2);
    const jar = cookies({
      [`${STORAGE_KEY}.0`]: encoded.slice(0, half),
      [`${STORAGE_KEY}.1`]: encoded.slice(half),
    });

    await expect(readStoredAccessToken(SUPABASE_URL, jar)).resolves.toBe('token-chunked');
  });

  it('M2-AC02/2 isolation: reads a plain (unencoded) session cookie too', async () => {
    const jar = cookies({ [STORAGE_KEY]: JSON.stringify({ access_token: 'token-plain' }) });

    await expect(readStoredAccessToken(SUPABASE_URL, jar)).resolves.toBe('token-plain');
  });

  it('M2-AC02/2 isolation: an absent, damaged or token-less cookie is null, never a throw', async () => {
    // Every one of these must fail closed: the probe then answers
    // `unauthenticated` instead of calling the API with nonsense.
    const cases: Record<string, string>[] = [
      {},
      { [STORAGE_KEY]: '' },
      { [STORAGE_KEY]: 'base64-!!!not-base64url!!!' },
      { [STORAGE_KEY]: 'base64-' + Buffer.from('not json', 'utf8').toString('base64url') },
      { [STORAGE_KEY]: encodeSession({ refresh_token: 'r' }) },
      { [STORAGE_KEY]: encodeSession({ access_token: '' }) },
      { [STORAGE_KEY]: encodeSession({ access_token: 42 }) },
      { [STORAGE_KEY]: encodeSession(null) },
      { 'sb-other-auth-token': encodeSession({ access_token: 'wrong-project' }) },
    ];

    for (const entries of cases) {
      await expect(readStoredAccessToken(SUPABASE_URL, cookies(entries)), JSON.stringify(entries)).resolves.toBeNull();
    }
  });

  it('M2-AC02/2 isolation: reading the token touches nothing but the cookies it was given', async () => {
    // No Supabase client is created, so there is no network call and no refresh:
    // the only thing this function can do is read. A refresh here would rotate the
    // refresh token under a POST and break concurrent tabs.
    const seen: string[] = [];
    const jar = (name: string) => {
      seen.push(name);
      return name === STORAGE_KEY ? encodeSession({ access_token: 'token-abc' }) : undefined;
    };

    await expect(readStoredAccessToken(SUPABASE_URL, jar)).resolves.toBe('token-abc');
    expect(seen).toEqual([STORAGE_KEY]);
  });
});
