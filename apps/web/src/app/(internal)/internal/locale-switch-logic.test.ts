import { describe, expect, it } from 'vitest';

import { guestCookieHolds } from '@/lib/locale/cookies';

import { IDLE, answerOf, choose, settle, switchForm, type SwitchAnswer, type SwitchState } from './locale-switch-logic';

/**
 * The in-place switch's decisions (M2-04; m2-04-code-review.md R5 rev 2, R13
 * "web unit"): one request in flight with a single pending value, the echo rule,
 * the refused-storage rule, and what each answer makes the provider do. Pure,
 * so every row is a direct call.
 */

const stored = () => true;
const refused = () => false;

const switched = (overrides: Partial<Extract<SwitchAnswer, { kind: 'switched' }>> = {}): SwitchAnswer => ({
  kind: 'switched',
  locale: 'ms-MY',
  scope: 'account',
  saved: true,
  reason: null,
  ...overrides,
});

/** A request for `locale` in flight. */
const inFlight = (locale: 'ms-MY' | 'zh-Hans-MY' | 'en-MY' = 'ms-MY'): SwitchState => choose(IDLE, locale).state;

describe('M2-AC04/2 switch: one request in flight, and a newer choice replaces the pending one', () => {
  it('M2-AC04/2 switch: a choice with nothing in flight is posted at once and announced as pending', () => {
    const step = choose(IDLE, 'zh-Hans-MY');
    expect(step.post).toBe('zh-Hans-MY');
    expect(step.effect).toBe('none');
    expect(step.state).toEqual({ inFlight: 'zh-Hans-MY', queued: null, shown: 'zh-Hans-MY', result: 'pending', reason: null });
  });

  it('M2-AC04/2 switch: choices made while one is in flight post nothing; the newest replaces the pending value', () => {
    const first = choose(inFlight('ms-MY'), 'zh-Hans-MY');
    expect(first.post).toBeNull();
    expect(first.state).toMatchObject({ inFlight: 'ms-MY', queued: 'zh-Hans-MY', shown: 'zh-Hans-MY' });

    const second = choose(first.state, 'en-MY');
    expect(second.post).toBeNull();
    expect(second.state).toMatchObject({ inFlight: 'ms-MY', queued: 'en-MY', shown: 'en-MY' });
  });

  it('M2-AC04/2 switch: the in-flight answer is stale once a newer choice is pending — nothing announced or refreshed, the newest is posted', () => {
    const pending = choose(inFlight('ms-MY'), 'en-MY').state;
    for (const answer of [switched({ locale: 'ms-MY' }), switched({ locale: 'ms-MY', scope: 'guest' }), { kind: 'failed' as const }]) {
      const step = settle(pending, answer, stored);
      expect(step.effect, JSON.stringify(answer)).toBe('none');
      expect(step.post, JSON.stringify(answer)).toBe('en-MY');
      expect(step.state, JSON.stringify(answer)).toMatchObject({ inFlight: 'en-MY', queued: null, result: 'pending' });
    }
  });

  it('M2-AC04/2 switch: two quick choices end with one value — the second answer is acted on, once', () => {
    let state = choose(IDLE, 'zh-Hans-MY').state;
    state = choose(state, 'ms-MY').state;
    const stale = settle(state, switched({ locale: 'zh-Hans-MY' }), stored);
    expect(stale).toMatchObject({ post: 'ms-MY', effect: 'none' });

    const fresh = settle(stale.state, switched({ locale: 'ms-MY' }), stored);
    expect(fresh).toMatchObject({ post: null, effect: 'refresh' });
    expect(fresh.state).toEqual({ inFlight: null, queued: null, shown: 'ms-MY', result: 'saved-account', reason: null });
  });
});

describe('M2-AC04/2 switch: the echo rule — only the answer to what this client last asked for is acted on', () => {
  it('M2-AC04/2 switch: a saved account answer for the asked value refreshes and says saved to the account', () => {
    const step = settle(inFlight('ms-MY'), switched(), stored);
    expect(step).toMatchObject({ post: null, effect: 'refresh' });
    expect(step.state).toMatchObject({ result: 'saved-account', shown: 'ms-MY', inFlight: null });
  });

  it('M2-AC04/2 switch: an answer naming another locale changes nothing and refreshes nothing', () => {
    const step = settle(inFlight('ms-MY'), switched({ locale: 'zh-Hans-MY' }), stored);
    expect(step).toMatchObject({ post: null, effect: 'none' });
    expect(step.state).toMatchObject({ result: 'not-switched', shown: null, inFlight: null });
  });

  it('M2-AC04/2 switch: a failed request (transport, a refusal, a redirect) keeps the old language and says so', () => {
    const step = settle(inFlight('ms-MY'), { kind: 'failed' }, stored);
    expect(step).toMatchObject({ post: null, effect: 'none' });
    expect(step.state).toEqual({ inFlight: null, queued: null, shown: null, result: 'not-switched', reason: null });
  });

  it('M2-AC04/2 switch: switched but not saved re-renders (the server shows the notice), and names the reason', () => {
    for (const reason of ['unavailable', 'unexpected', 'session_ended'] as const) {
      const step = settle(inFlight('ms-MY'), switched({ saved: false, reason }), stored);
      expect(step.effect, reason).toBe('refresh');
      expect(step.state, reason).toMatchObject({ result: 'not-saved', reason, shown: 'ms-MY' });
    }
    // A not-saved answer without a reason is still not a save.
    expect(settle(inFlight('ms-MY'), switched({ saved: false }), stored).state).toMatchObject({ result: 'not-saved', reason: 'unexpected' });
  });

  it('M2-AC04/2 switch: a disabled account leaves through end-session instead of re-rendering', () => {
    const step = settle(inFlight('ms-MY'), switched({ saved: false, reason: 'account_disabled' }), stored);
    expect(step.effect).toBe('end-session');
    expect(step.state).toMatchObject({ result: 'not-saved', reason: 'account_disabled' });
  });
});

describe('M2-AC04/2 switch: refused storage — a guest switch the browser would not store is not a switch', () => {
  it('M2-AC04/2 switch: a guest answer whose cookie the browser holds refreshes and says saved to this browser', () => {
    const step = settle(inFlight('ms-MY'), switched({ scope: 'guest' }), stored);
    expect(step).toMatchObject({ effect: 'refresh', post: null });
    expect(step.state).toMatchObject({ result: 'saved-guest', shown: 'ms-MY' });
  });

  it('M2-AC04/2 switch: a guest answer whose cookie is missing says refused and does not refresh — one language everywhere', () => {
    const asked: string[] = [];
    const step = settle(inFlight('ms-MY'), switched({ scope: 'guest' }), (locale) => {
      asked.push(locale);
      return false;
    });
    expect(asked).toEqual(['ms-MY']);
    expect(step).toMatchObject({ effect: 'none', post: null });
    expect(step.state).toEqual({ inFlight: null, queued: null, shown: null, result: 'refused', reason: null });
  });

  it('M2-AC04/2 switch: an account answer never consults the guest cookie', () => {
    let consulted = false;
    settle(inFlight('ms-MY'), switched(), () => {
      consulted = true;
      return false;
    });
    expect(consulted).toBe(false);
    expect(settle(inFlight('ms-MY'), switched(), refused).state.result).toBe('saved-account');
  });

  it('M2-AC04/2 switch: the cookie check matches wringy-locale exactly, not a longer name or another value', () => {
    expect(guestCookieHolds('wringy-locale=ms-MY', 'ms-MY')).toBe(true);
    expect(guestCookieHolds('a=1; wringy-locale=ms-MY; b=2', 'ms-MY')).toBe(true);
    expect(guestCookieHolds('wringy-locale=en-MY', 'ms-MY')).toBe(false);
    expect(guestCookieHolds('wringy-locale-x=ms-MY', 'ms-MY')).toBe(false);
    expect(guestCookieHolds('xwringy-locale=ms-MY', 'ms-MY')).toBe(false);
    expect(guestCookieHolds('', 'ms-MY')).toBe(false);
  });
});

describe('M2-AC04/2 switch: the handler’s answer is read defensively', () => {
  it('M2-AC04/2 switch: the R4 shape is read, and anything else is a failure', () => {
    expect(answerOf(200, { switched: true, locale: 'zh-Hans-MY', scope: 'guest', saved: true })).toEqual({
      kind: 'switched',
      locale: 'zh-Hans-MY',
      scope: 'guest',
      saved: true,
      reason: null,
    });
    expect(answerOf(200, { switched: true, locale: 'ms-MY', scope: 'account', saved: false, reason: 'session_ended' })).toMatchObject({
      reason: 'session_ended',
    });
    expect(answerOf(200, { switched: true, locale: 'ms-MY', scope: 'account', saved: false, reason: 'bogus' })).toMatchObject({
      reason: null,
    });
    for (const [status, body] of [
      [403, { error: { code: 'forbidden' } }],
      [404, { error: { code: 'not_found' } }],
      [503, { error: { code: 'not_configured' } }],
      [400, { error: { code: 'bad_request' } }],
      [200, null],
      [200, 'switched'],
      [200, { skipped: true }],
      [200, { switched: 'true', locale: 'ms-MY', scope: 'guest', saved: true }],
      [200, { switched: true, locale: 'en', scope: 'guest', saved: true }],
      [200, { switched: true, locale: 'ms-MY', scope: 'browser', saved: true }],
      [200, { switched: true, locale: 'ms-MY', scope: 'guest', saved: 'yes' }],
      [303, { switched: true, locale: 'ms-MY', scope: 'guest', saved: true }],
    ] as const) {
      expect(answerOf(status, body), `${status} ${JSON.stringify(body)}`).toEqual({ kind: 'failed' });
    }
  });

  it('M2-AC04/2 switch: the client posts exactly the no-JS form’s fields', () => {
    expect([...switchForm('choose', 'ms-MY', '/internal/orgs/x')]).toEqual([
      ['intent', 'choose'],
      ['locale', 'ms-MY'],
      ['next', '/internal/orgs/x'],
    ]);
    expect(switchForm('skip', 'en-MY', '/internal/sign-in').get('intent')).toBe('skip');
  });
});
