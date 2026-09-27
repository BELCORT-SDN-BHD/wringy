import { describe, expect, it } from 'vitest';

import type { Locale } from '@/i18n/config';

import { unsavedChoiceValue } from './cookies';
import { resolveLocale, type ResolveInput } from './resolve';

/**
 * The resolution order (M2-04; m2-04-code-review.md R3 rev 2, R13 "web unit"):
 * the five steps, every pair of steps against each other, the shared-device
 * table and the prompt rule. Pure, so every row is a direct call.
 */

/** Nothing known: a signed-out visitor with no cookies and no Accept-Language. */
const NOTHING: ResolveInput = {
  signedIn: false,
  holdsSessionCookie: false,
  sessionChoice: undefined,
  accountPreference: 'unknown',
  accountPreferenceSetAt: null,
  guestChoice: undefined,
  acceptLanguage: null,
  promptDone: false,
};

const signedIn = (overrides: Partial<ResolveInput> = {}): ResolveInput => ({
  ...NOTHING,
  signedIn: true,
  holdsSessionCookie: true,
  accountPreference: null,
  ...overrides,
});

/** When the account's preference was set, in the rows that do not care about the instant. */
const ACCOUNT_SET_AT = '2026-09-27T01:00:00.000Z';
const ACCOUNT_SET_MS = Date.parse(ACCOUNT_SET_AT);

/** An account holding `locale`, set at `setAt` (the API's instant). */
const account = (locale: Locale, setAt: string = ACCOUNT_SET_AT): Partial<ResolveInput> => ({
  accountPreference: locale,
  accountPreferenceSetAt: setAt,
});

/** A `wringy-locale-session` value as the handler writes it; by default made a minute after the account's instant. */
const stamped = (locale: Locale, at: number = ACCOUNT_SET_MS + 60_000): string => unsavedChoiceValue({ locale, at });

describe('M2-AC04/1 order: the language is resolved in localization-v1’s order', () => {
  it('M2-AC04/1 order: each of the five steps decides on its own', () => {
    expect(resolveLocale(signedIn({ sessionChoice: stamped('zh-Hans-MY') }))).toMatchObject({ locale: 'zh-Hans-MY', source: 'session' });
    expect(resolveLocale(signedIn(account('ms-MY')))).toMatchObject({ locale: 'ms-MY', source: 'account' });
    expect(resolveLocale({ ...NOTHING, guestChoice: 'zh-Hans-MY' })).toMatchObject({ locale: 'zh-Hans-MY', source: 'guest' });
    expect(resolveLocale({ ...NOTHING, acceptLanguage: 'ms-MY' })).toMatchObject({ locale: 'ms-MY', source: 'browser' });
    expect(resolveLocale(NOTHING)).toMatchObject({ locale: 'en-MY', source: 'default' });
  });

  it('M2-AC04/1 order: every earlier step overrides every later one', () => {
    // One distinct language per step, so the winner is visible in the locale too.
    const steps = {
      session: { sessionChoice: stamped('zh-Hans-MY') },
      account: account('ms-MY'),
      guest: { guestChoice: 'en-MY' },
      browser: { acceptLanguage: 'zh-CN' },
    };
    const order = ['session', 'account', 'guest', 'browser'] as const;
    for (const [index, earlier] of order.entries()) {
      for (const later of order.slice(index + 1)) {
        const input = signedIn({ ...steps[earlier], ...steps[later] });
        expect(resolveLocale(input).source, `${earlier} over ${later}`).toBe(earlier);
      }
      // …and over the default.
      expect(resolveLocale(signedIn(steps[earlier])).source, `${earlier} over default`).toBe(earlier);
    }
  });

  it('M2-AC04/1 order: a browser that suggests nothing falls through to English', () => {
    expect(resolveLocale({ ...NOTHING, acceptLanguage: 'zh-Hant-TW' })).toMatchObject({ locale: 'en-MY', source: 'default' });
    expect(resolveLocale({ ...NOTHING, acceptLanguage: 'fr-FR, de;q=0.9' })).toMatchObject({ locale: 'en-MY', source: 'default' });
  });

  it('M2-AC04/1 order: an invalid cookie value counts as absent', () => {
    const stamp = ACCOUNT_SET_MS + 60_000;
    for (const bad of ['', 'en', 'zh-hans-my', 'zh-Hant-MY', 'EN-MY', 'ms-MY ', '<script>']) {
      const session = `${bad}.${stamp}`;
      expect(resolveLocale(signedIn({ sessionChoice: session, ...account('ms-MY') })).source, `session ${session}`).toBe('account');
      expect(resolveLocale({ ...NOTHING, guestChoice: bad, acceptLanguage: 'zh-CN' }).source, `guest ${bad}`).toBe('browser');
    }
  });

  it('M2-AC04/1 order: a session choice without a well-formed stamp counts as absent, so a choice of unknown age never outranks the account', () => {
    // `ms-MY` alone is the value written before the stamp existed.
    for (const bad of ['ms-MY', 'ms-MY.', 'ms-MY.abc', 'ms-MY.-1', 'ms-MY.1.2', 'ms-MY.1e12', 'ms-MY. 1', 'ms-MY.1234567890123456', '.1790000000000']) {
      expect(resolveLocale(signedIn({ sessionChoice: bad, ...account('zh-Hans-MY') })), bad).toMatchObject({
        locale: 'zh-Hans-MY',
        source: 'account',
        unsaved: null,
      });
    }
  });

  it('M2-AC04/1 shared device: a session cookie with no token is ignored — it belongs to nobody', () => {
    const resolved = resolveLocale({ ...NOTHING, sessionChoice: stamped('zh-Hans-MY'), guestChoice: 'ms-MY' });
    expect(resolved).toMatchObject({ locale: 'ms-MY', source: 'guest', unsaved: null });
  });

  it('M2-AC04/1 shared device: signed out, the browser only suggests (ms → Malay, zh-Hant → English)', () => {
    expect(resolveLocale({ ...NOTHING, acceptLanguage: 'ms' })).toMatchObject({ locale: 'ms-MY', source: 'browser' });
    expect(resolveLocale({ ...NOTHING, acceptLanguage: 'zh-Hant' })).toMatchObject({ locale: 'en-MY', source: 'default' });
  });

  it('M2-AC04/1 shared device: signed out there is no account to ask, whatever the caller passed', () => {
    const resolved = resolveLocale({ ...NOTHING, accountPreference: 'ms-MY', guestChoice: 'zh-Hans-MY' });
    expect(resolved).toMatchObject({ locale: 'zh-Hans-MY', source: 'guest', accountPreference: 'unknown' });
  });
});

describe('M2-AC04/2 account: the account’s preference and an unsaved choice', () => {
  it('M2-AC04/2 account: a guest cookie from this browser never outranks the account (guest zh + account ms → ms)', () => {
    const resolved = resolveLocale(signedIn({ guestChoice: 'zh-Hans-MY', ...account('ms-MY') }));
    expect(resolved).toMatchObject({ locale: 'ms-MY', source: 'account', accountPreference: 'ms-MY', unsaved: null });
  });

  it('M2-AC04/2 account: a fresh unsaved choice outranks the account and says so (session en + account ms → en)', () => {
    const resolved = resolveLocale(signedIn({ sessionChoice: stamped('en-MY'), ...account('ms-MY') }));
    expect(resolved).toMatchObject({ locale: 'en-MY', source: 'session', unsaved: 'en-MY', accountPreference: 'ms-MY' });
  });

  it('M2-AC04/2 account: a session choice the account already holds is saved, not unsaved (session zh + account zh → account)', () => {
    // A save that failed here, then the same language saved on another device: no "not saved" notice beside "Saved".
    const resolved = resolveLocale(signedIn({ sessionChoice: stamped('zh-Hans-MY'), ...account('zh-Hans-MY') }));
    expect(resolved).toMatchObject({ locale: 'zh-Hans-MY', source: 'account', accountPreference: 'zh-Hans-MY', unsaved: null });
    // Only a preference known to be the same counts: none saved, or a read that failed, leaves the choice unsaved.
    expect(resolveLocale(signedIn({ sessionChoice: stamped('zh-Hans-MY'), accountPreference: null }))).toMatchObject({
      source: 'session',
      unsaved: 'zh-Hans-MY',
    });
    expect(resolveLocale(signedIn({ sessionChoice: stamped('zh-Hans-MY'), accountPreference: 'unknown' }))).toMatchObject({
      source: 'session',
      unsaved: 'zh-Hans-MY',
    });
  });

  it('M2-AC04/2 account: a session choice older than the account’s localePrefSetAt does not decide — a newer explicit choice made anywhere wins', () => {
    // This browser's save of Malay failed a minute before the account was set to Chinese elsewhere.
    const older = resolveLocale(signedIn({ sessionChoice: stamped('ms-MY', ACCOUNT_SET_MS - 60_000), ...account('zh-Hans-MY') }));
    expect(older).toMatchObject({ locale: 'zh-Hans-MY', source: 'account', unsaved: null, showPrompt: false });
    // One millisecond older is older; the same instant is not later than the stamp, so the choice still decides.
    expect(resolveLocale(signedIn({ sessionChoice: stamped('ms-MY', ACCOUNT_SET_MS - 1), ...account('zh-Hans-MY') })).source).toBe('account');
    expect(resolveLocale(signedIn({ sessionChoice: stamped('ms-MY', ACCOUNT_SET_MS), ...account('zh-Hans-MY') }))).toMatchObject({
      locale: 'ms-MY',
      source: 'session',
      unsaved: 'ms-MY',
    });
    // An account whose instant nobody knows (the read failed) or that holds nothing cannot make the choice older.
    for (const unknownOrNone of [{ accountPreference: 'unknown' as const }, { accountPreference: null }]) {
      expect(resolveLocale(signedIn({ sessionChoice: stamped('ms-MY', 0), ...unknownOrNone })).source, JSON.stringify(unknownOrNone)).toBe(
        'session',
      );
    }
  });

  it('M2-AC04/2 account: equal, then diverged — a spent unsaved choice does not come back when the account moves on', () => {
    // Device A: saving Malay fails at `failedAt`, so A holds wringy-locale-session=ms-MY.<failedAt>.
    const failedAt = ACCOUNT_SET_MS;
    const deviceA = (accountLocale: Locale, setAt: number) =>
      resolveLocale(signedIn({ sessionChoice: stamped('ms-MY', failedAt), ...account(accountLocale, new Date(setAt).toISOString()) }));

    // Device B saves Malay: A's choice is what the account holds, so the account decides and nothing says "not saved".
    expect(deviceA('ms-MY', failedAt + 5_000)).toMatchObject({ locale: 'ms-MY', source: 'account', unsaved: null });
    // Device B then saves Chinese: A follows the account. It never shows Malay as "not saved" again,
    // whose Retry would write the older choice over the newer one.
    expect(deviceA('zh-Hans-MY', failedAt + 10_000)).toMatchObject({ locale: 'zh-Hans-MY', source: 'account', unsaved: null });
  });

  it('M2-AC04/2 account: a failed account read with a guest cookie falls through to the guest cookie', () => {
    const resolved = resolveLocale(signedIn({ accountPreference: 'unknown', guestChoice: 'zh-Hans-MY', acceptLanguage: 'ms' }));
    expect(resolved).toMatchObject({ locale: 'zh-Hans-MY', source: 'guest', accountPreference: 'unknown' });
  });

  it('M2-AC04/2 account: a failed account read with no guest cookie is the browser’s suggestion, and never a prompt', () => {
    const resolved = resolveLocale(signedIn({ accountPreference: 'unknown', acceptLanguage: 'ms-MY' }));
    expect(resolved).toMatchObject({ locale: 'ms-MY', source: 'browser', showPrompt: false });
  });

  it('M2-AC04/2 account: unsaved is reported only when the session cookie decided', () => {
    for (const input of [
      signedIn(account('ms-MY')),
      signedIn({ guestChoice: 'ms-MY' }),
      signedIn({ acceptLanguage: 'ms' }),
      { ...NOTHING, sessionChoice: stamped('ms-MY') },
    ]) {
      expect(resolveLocale(input).unsaved, JSON.stringify(input)).toBeNull();
    }
  });
});

describe('M2-AC04/1 prompt: asked only while the language is a suggestion, and never of someone with a saved preference', () => {
  it('M2-AC04/1 prompt: a signed-out visitor on a suggestion or the default is asked, once per browsing session', () => {
    expect(resolveLocale({ ...NOTHING, acceptLanguage: 'ms' }).showPrompt).toBe(true);
    expect(resolveLocale(NOTHING).showPrompt).toBe(true);
    expect(resolveLocale({ ...NOTHING, acceptLanguage: 'ms', promptDone: true }).showPrompt).toBe(false);
    expect(resolveLocale({ ...NOTHING, promptDone: true }).showPrompt).toBe(false);
  });

  it('M2-AC04/1 prompt: a signed-in person is asked only when the account is known to hold no preference', () => {
    expect(resolveLocale(signedIn({ accountPreference: null, acceptLanguage: 'ms' })).showPrompt).toBe(true);
    expect(resolveLocale(signedIn({ accountPreference: null })).showPrompt).toBe(true);
    // The API blinked: this person may well have a saved preference, so they are not asked.
    expect(resolveLocale(signedIn({ accountPreference: 'unknown', acceptLanguage: 'ms' })).showPrompt).toBe(false);
    expect(resolveLocale(signedIn({ accountPreference: 'unknown' })).showPrompt).toBe(false);
  });

  it('M2-AC04/1 prompt: a session cookie the render did not verify is an account nobody read, so nobody is asked (the sign-in and not-found pages)', () => {
    // Those pages render without a token whatever the jar holds (read.ts): the language is resolved as a guest's…
    const unverified = { ...NOTHING, holdsSessionCookie: true };
    expect(resolveLocale({ ...unverified, acceptLanguage: 'ms' })).toMatchObject({
      locale: 'ms-MY',
      source: 'browser',
      accountPreference: 'unknown',
      unsaved: null,
      showPrompt: false,
    });
    expect(resolveLocale(unverified)).toMatchObject({ source: 'default', showPrompt: false });
    // …whatever the caller passed for the account: without a token there is none to ask, so "none" is not known either.
    expect(resolveLocale({ ...unverified, accountPreference: null }).showPrompt).toBe(false);
    // …and the order is the guest's, unchanged: the guest cookie decides, a leftover session choice still counts for nobody.
    expect(resolveLocale({ ...unverified, guestChoice: 'zh-Hans-MY', sessionChoice: stamped('ms-MY') })).toMatchObject({
      locale: 'zh-Hans-MY',
      source: 'guest',
      unsaved: null,
    });
    // No session cookie at all is a guest, who is asked.
    expect(resolveLocale({ ...NOTHING, acceptLanguage: 'ms' }).showPrompt).toBe(true);
  });

  it('M2-AC04/1 prompt: an explicit choice anywhere means no prompt', () => {
    expect(resolveLocale(signedIn(account('ms-MY'))).showPrompt).toBe(false);
    expect(resolveLocale(signedIn({ sessionChoice: stamped('ms-MY') })).showPrompt).toBe(false);
    expect(resolveLocale({ ...NOTHING, guestChoice: 'ms-MY' }).showPrompt).toBe(false);
    expect(resolveLocale(signedIn({ guestChoice: 'ms-MY' })).showPrompt).toBe(false);
  });
});
