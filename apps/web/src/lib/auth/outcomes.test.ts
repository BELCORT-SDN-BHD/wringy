import { describe, expect, it } from 'vitest';

import { messagesByLocale } from '@/i18n/messages';
import { LOCALES } from '@/domain/types';

import { OUTCOMES, isOutcome, outcomeFromCallbackQuery, outcomeFromExchangeError, signInPath } from './outcomes';

/** The query of a callback URL, as the handler reads it. */
const query = (search: string) => new URL(`https://app.wringy.test/auth/callback${search}`).searchParams;

describe('M2-AC02/1 outcomes: every way sign-in can end has a code and localized copy', () => {
  it('M2-AC02/1 outcomes: the nine codes are exactly the ones R11 lists', () => {
    expect([...OUTCOMES]).toEqual([
      'cancelled',
      'expired',
      'wrong_browser',
      'session_ended',
      'signed_out',
      'signed_out_unconfirmed',
      'not_allowed',
      'disabled',
      'unexpected',
    ]);
  });

  it('M2-AC02/1 outcomes: every code has a title and a description in all three locales', () => {
    for (const locale of LOCALES) {
      const outcomes = (
        messagesByLocale[locale].internal as unknown as {
          signIn: { outcomes: Record<string, { title?: string; description?: string }> };
        }
      ).signIn.outcomes;

      for (const code of OUTCOMES) {
        expect(outcomes[code]?.title, `${locale} ${code} title`).toBeTruthy();
        expect(outcomes[code]?.description, `${locale} ${code} description`).toBeTruthy();
      }
    }
  });

  it('M2-AC02/1 outcomes: the Chinese sign-out copy states the device scope as the founder wrote it', () => {
    const zh = (
      messagesByLocale['zh-Hans-MY'].internal as unknown as {
        signIn: { outcomes: { signed_out: { description: string } } };
      }
    ).signIn.outcomes;

    // kickoff-package.md §4.6 / M2-02 §3 step 6, verbatim.
    expect(zh.signed_out.description).toBe('已退出此设备；其他设备上的登录不受影响');
  });

  it('M2-AC02/1 outcomes: isOutcome accepts only the nine codes', () => {
    for (const code of OUTCOMES) expect(isOutcome(code)).toBe(true);
    for (const value of ['', 'ok', 'SIGNED_OUT', 'signed-out', null, undefined]) {
      expect(isOutcome(value as string | null | undefined), String(value)).toBe(false);
    }
  });

  // --- The callback query (the provider leg failed before any token existed) ---

  it('M2-AC02/1 cancel: error=access_denied is a cancelled sign-in', () => {
    expect(outcomeFromCallbackQuery(query('?error=access_denied&error_description=The+user+declined'))).toBe(
      'cancelled',
    );
  });

  it('M2-AC02/1 expired: error_code=flow_state_not_found is an expired sign-in', () => {
    expect(outcomeFromCallbackQuery(query('?error=server_error&error_code=flow_state_not_found'))).toBe('expired');
    // access_denied wins when both are present: the person's own cancel is the
    // more useful thing to say.
    expect(outcomeFromCallbackQuery(query('?error=access_denied&error_code=flow_state_not_found'))).toBe('cancelled');
  });

  it('M2-AC02/1 outcomes: any other error is unexpected, and a clean query is no outcome at all', () => {
    expect(outcomeFromCallbackQuery(query('?error=server_error'))).toBe('unexpected');
    expect(outcomeFromCallbackQuery(query('?error_code=something_new'))).toBe('unexpected');
    expect(outcomeFromCallbackQuery(query('?code=abc123'))).toBeNull();
    expect(outcomeFromCallbackQuery(query(''))).toBeNull();
  });

  // --- The exchange error (GoTrue answered POST /token?grant_type=pkce) -------

  it('M2-AC02/1 expired: flow_state_expired from the exchange is an expired sign-in', () => {
    expect(outcomeFromExchangeError({ name: 'AuthApiError', code: 'flow_state_expired', status: 422 })).toBe(
      'expired',
    );
  });

  it('M2-AC02/1 wrong_browser: bad_code_verifier and a missing verifier share the same copy', () => {
    expect(outcomeFromExchangeError({ name: 'AuthApiError', code: 'bad_code_verifier', status: 400 })).toBe(
      'wrong_browser',
    );
    // auth-js's own error, thrown when this browser holds no verifier cookie.
    expect(outcomeFromExchangeError({ name: 'AuthPKCECodeVerifierMissingError' })).toBe('wrong_browser');
    expect(outcomeFromExchangeError({ name: 'CustomAuthError', code: 'pkce_code_verifier_not_found' })).toBe(
      'wrong_browser',
    );
  });

  it('M2-AC02/1 outcomes: any other exchange failure is unexpected, never a guess', () => {
    for (const error of [
      { name: 'AuthApiError', code: 'validation_failed', status: 400 },
      { name: 'AuthRetryableFetchError' },
      new Error('boom'),
      null,
      undefined,
      'a string',
    ]) {
      expect(outcomeFromExchangeError(error), JSON.stringify(error)).toBe('unexpected');
    }
  });

  // --- The sign-in URL -------------------------------------------------------

  it('M2-AC02/1 outcomes: signInPath carries whatever it is given, and nothing it is not', () => {
    expect(signInPath()).toBe('/internal/sign-in');
    expect(signInPath({ outcome: 'cancelled' })).toBe('/internal/sign-in?outcome=cancelled');
    // A `next` that is given is always carried, even when it equals the default:
    // the proxy's contract is that its redirect names the path that was asked for.
    expect(signInPath({ next: '/internal' })).toBe('/internal/sign-in?next=%2Finternal');
    expect(signInPath({ next: '/internal/campaigns', outcome: 'session_ended' })).toBe(
      '/internal/sign-in?next=%2Finternal%2Fcampaigns&outcome=session_ended',
    );
    // Callers with nothing to return to pass none.
    expect(signInPath({ next: null, outcome: 'signed_out' })).toBe('/internal/sign-in?outcome=signed_out');
  });

  it('M2-AC02/1 outcomes: signInPath percent-encodes a next value, so it cannot add parameters', () => {
    const path = signInPath({ next: '/internal?probe=ok&outcome=signed_out' });
    const url = new URL(path, 'https://app.wringy.test');

    expect(url.searchParams.get('next')).toBe('/internal?probe=ok&outcome=signed_out');
    // The smuggled `outcome` stayed inside `next` instead of becoming its own parameter.
    expect(url.searchParams.get('outcome')).toBeNull();
  });
});
