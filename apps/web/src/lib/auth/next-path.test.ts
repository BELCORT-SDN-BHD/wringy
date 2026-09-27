import { describe, expect, it } from 'vitest';

import { DEFAULT_NEXT_PATH, MAX_NEXT_PATH_LENGTH, safeNextPath } from './next-path';

const APP_ORIGIN = 'https://app.wringy.test';

describe('M2-AC02/3 callback: the return path can never leave APP_ORIGIN', () => {
  it('M2-AC02/3 callback: keeps a root-relative path, with its query and fragment', () => {
    expect(safeNextPath('/internal')).toBe('/internal');
    expect(safeNextPath('/internal?probe=ok')).toBe('/internal?probe=ok');
    expect(safeNextPath('/internal/campaigns/abc-123?tab=rules#rules')).toBe(
      '/internal/campaigns/abc-123?tab=rules#rules',
    );
  });

  it('M2-AC02/3 callback: next=//evil.example never leaves APP_ORIGIN', () => {
    // A protocol-relative URL: the browser reads the host after `//`.
    expect(safeNextPath('//evil.example')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('//evil.example/internal')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('///evil.example')).toBe(DEFAULT_NEXT_PATH);
  });

  it('M2-AC02/3 callback: next=https://evil.example never leaves APP_ORIGIN', () => {
    for (const value of [
      'https://evil.example',
      'http://evil.example/internal',
      'javascript:alert(1)',
      'mailto:someone@evil.example',
      'data:text/html,<script>1</script>',
      'HTTPS://evil.example',
    ]) {
      expect(safeNextPath(value), value).toBe(DEFAULT_NEXT_PATH);
    }
  });

  it('M2-AC02/3 callback: refuses a backslash, which a browser reads as a slash', () => {
    expect(safeNextPath('\\\\evil.example')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('/\\evil.example')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('/internal\\..\\evil')).toBe(DEFAULT_NEXT_PATH);
  });

  it('M2-AC02/3 callback: refuses CR and LF, so no value can split the Location header', () => {
    expect(safeNextPath('/internal\r\nSet-Cookie: a=b')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('/internal\nX: y')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('/internal\tx')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('/internal x')).toBe(DEFAULT_NEXT_PATH);
  });

  it('M2-AC02/3 callback: refuses anything that is not root-relative, and anything absent or over-long', () => {
    for (const value of ['internal', '../internal', '?probe=ok', '#top', '']) {
      expect(safeNextPath(value), JSON.stringify(value)).toBe(DEFAULT_NEXT_PATH);
    }
    expect(safeNextPath(null)).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath(undefined)).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath(`/${'a'.repeat(MAX_NEXT_PATH_LENGTH)}`)).toBe(DEFAULT_NEXT_PATH);
  });

  it('M2-AC02/3 callback: whatever it returns, resolving it against APP_ORIGIN keeps the origin', () => {
    // The property the callback actually depends on, checked over the hostile
    // inputs above and the good ones together.
    const values = [
      '/internal',
      '/internal?probe=ok',
      '//evil.example',
      'https://evil.example',
      '\\\\evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '/internal\r\nSet-Cookie: a=b',
      'internal',
      '',
      // Dot segments that resolve to `//evil.example`: in one step the host is still APP_ORIGIN's.
      '/internal/..//evil.example',
      '/.//evil.example/x',
      '/%2e%2e//evil.example',
    ];
    for (const value of values) {
      const url = new URL(safeNextPath(value), APP_ORIGIN);
      expect(url.origin, value).toBe(APP_ORIGIN);
    }
  });

  it('M2-AC02/3 callback: a resolved pathname parsed again is checked again, because dot segments can leave //host', () => {
    // Why a caller that re-parses the reduced pathname runs safeNextPath twice
    // (the locale handler's returnPathname): the first pass accepts the value…
    const accepted = safeNextPath('/internal/..//evil.example');
    const reduced = new URL(accepted, APP_ORIGIN).pathname;
    expect(reduced).toBe('//evil.example');
    // …and the second refuses what it reduced to.
    expect(safeNextPath(reduced)).toBe(DEFAULT_NEXT_PATH);
  });
});
