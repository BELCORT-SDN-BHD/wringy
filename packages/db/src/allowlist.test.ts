import { describe, expect, it } from 'vitest';

import { InvalidEmailError, normalizeEmail } from './allowlist';

describe('M2-AC02/2 normalizeEmail', () => {
  it('M2-AC02/2 trims, lower-cases and applies Unicode NFKC, so one address is one row', () => {
    // U+FF2A FULLWIDTH LATIN CAPITAL LETTER J and U+FF20 FULLWIDTH COMMERCIAL AT.
    expect(normalizeEmail('Ｊohn.Doe+x@Example.COM ')).toBe('john.doe+x@example.com');
    expect(normalizeEmail('  Tester@Example.com\t')).toBe('tester@example.com');
    expect(normalizeEmail('tester＠example.com')).toBe('tester@example.com');
    // Idempotent: normalising a normal form changes nothing.
    expect(normalizeEmail(normalizeEmail('Ｊohn.Doe+x@Example.COM '))).toBe('john.doe+x@example.com');
  });

  it('M2-AC02/2 rewrites no dots and no plus tag: those are different addresses', () => {
    expect(normalizeEmail('a.b@example.com')).toBe('a.b@example.com');
    expect(normalizeEmail('ab@example.com')).toBe('ab@example.com');
    expect(normalizeEmail('a+tester@example.com')).toBe('a+tester@example.com');
    expect(normalizeEmail('a.b@example.com')).not.toBe(normalizeEmail('ab@example.com'));
  });

  it('M2-AC02/2 refuses an empty value and one without @, and never echoes the value', () => {
    for (const bad of ['', '   ', '\t\n']) {
      expect(() => normalizeEmail(bad)).toThrow(InvalidEmailError);
    }
    const secret = 'tester-DO-NOT-LEAK';
    let caught: unknown;
    try {
      normalizeEmail(secret);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidEmailError);
    expect((caught as Error).message).not.toContain(secret);
  });

  it('M2-AC02/2 produces a value the table CHECK accepts: non-empty and already lower-cased', () => {
    for (const raw of ['Ｊohn.Doe+x@Example.COM ', 'A@B.CO', 'ünïcode@Exämple.COM']) {
      const normalized = normalizeEmail(raw);
      expect(normalized).not.toBe('');
      expect(normalized).toBe(normalized.toLowerCase());
    }
  });
});
