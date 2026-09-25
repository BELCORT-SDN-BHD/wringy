import { describe, expect, it } from 'vitest';

import { checkOrigin } from './origin';

const APP_ORIGIN = 'https://app.wringy.test';

/** A request with only the headers the rule reads. */
function requestWith(headers: Record<string, string>): Request {
  return new Request(`${APP_ORIGIN}/auth/sign-in`, { method: 'POST', headers });
}

describe('M2-AC02/3 origin: the Origin rule for every state-changing endpoint', () => {
  it('M2-AC02/3 origin: accepts a request whose Origin is exactly APP_ORIGIN', () => {
    expect(checkOrigin(requestWith({ origin: APP_ORIGIN }), APP_ORIGIN)).toBe('ok');
  });

  it('M2-AC02/3 origin: rejects a cross-site Origin', () => {
    expect(checkOrigin(requestWith({ origin: 'https://evil.example' }), APP_ORIGIN)).toBe('rejected');
  });

  it('M2-AC02/3 origin: rejects an Origin that only looks like APP_ORIGIN', () => {
    // Each of these is a different origin to a browser, so a substring or
    // "startsWith" check would let them through.
    for (const origin of [
      'https://app.wringy.test.evil.example',
      'https://evil.example/?x=https://app.wringy.test',
      'http://app.wringy.test', // the wrong scheme
      'https://app.wringy.test:8443', // the wrong port
      'https://APP.WRINGY.TEST', // not the canonical serialisation
      'https://app.wringy.test/', // a trailing slash is not sent in Origin
    ]) {
      expect(checkOrigin(requestWith({ origin }), APP_ORIGIN), origin).toBe('rejected');
    }
  });

  it('M2-AC02/3 origin: rejects Origin: null even when Sec-Fetch-Site says same-origin', () => {
    // A sandboxed iframe or an opaque origin sends the literal string "null".
    // It is a PRESENT header that is not APP_ORIGIN, so rule 1 rejects it and it
    // never reaches rule 2 — otherwise a sandboxed frame could forge same-origin.
    expect(checkOrigin(requestWith({ origin: 'null', 'sec-fetch-site': 'same-origin' }), APP_ORIGIN)).toBe(
      'rejected',
    );
  });

  it('M2-AC02/3 origin: with no Origin, accepts only Sec-Fetch-Site: same-origin', () => {
    expect(checkOrigin(requestWith({ 'sec-fetch-site': 'same-origin' }), APP_ORIGIN)).toBe('ok');

    for (const site of ['cross-site', 'same-site', 'none', '']) {
      expect(checkOrigin(requestWith({ 'sec-fetch-site': site }), APP_ORIGIN), site).toBe('rejected');
    }
  });

  it('M2-AC02/3 origin: rejects a request that sends neither header', () => {
    // A non-browser client cannot be shown to be same-origin, so it is refused
    // rather than trusted. Next's own Server-Action check warns and continues here.
    expect(checkOrigin(requestWith({}), APP_ORIGIN)).toBe('rejected');
  });

  it('M2-AC02/3 origin: an empty Origin header falls through to the Sec-Fetch-Site rule', () => {
    expect(checkOrigin(requestWith({ origin: '', 'sec-fetch-site': 'same-origin' }), APP_ORIGIN)).toBe('ok');
    expect(checkOrigin(requestWith({ origin: '', 'sec-fetch-site': 'cross-site' }), APP_ORIGIN)).toBe('rejected');
  });

  it('M2-AC02/3 origin: never derives the allowed origin from the request host', () => {
    // The rule is given APP_ORIGIN; a Host header naming somewhere else changes
    // nothing. This is the property the proxy's Location test checks end to end.
    const forged = new Request('https://evil.example/auth/sign-in', {
      method: 'POST',
      headers: { origin: 'https://evil.example', host: 'evil.example', 'x-forwarded-host': 'evil.example' },
    });
    expect(checkOrigin(forged, APP_ORIGIN)).toBe('rejected');
  });
});
