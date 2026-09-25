import { describe, expect, it } from 'vitest';

import { InvalidEmailError, normalizeEmail } from './allowlist';

describe('M2-AC02/2 normalizeEmail', () => {
  it('M2-AC02/2 trims, lower-cases and applies Unicode NFC, so one address is one row', () => {
    expect(normalizeEmail('  Tester@Example.com\t')).toBe('tester@example.com');
    // NFC composes: `Ä` written as U+00C4 and as `A` + U+0308 COMBINING DIAERESIS
    // are the same mailbox spelled two ways, and become one key.
    expect(normalizeEmail('teÄster@Example.test')).toBe('teäster@example.test');
    expect(normalizeEmail('teÄster@Example.test')).toBe('teäster@example.test');
    expect(normalizeEmail('teÄster@example.test')).toBe(normalizeEmail('teÄster@example.test'));
    // Idempotent: normalising a normal form changes nothing.
    expect(normalizeEmail(normalizeEmail('teÄSTER@Example.TEST'))).toBe('teäster@example.test');
  });

  it('M2-AC02/2 does not compatibility-fold, so a look-alike code point is a different address', () => {
    // NFC, not NFKC (R5 rev 3). NFKC would rewrite each of these into the listed
    // ASCII spelling, so two distinct mailboxes would share one key and listing
    // one would admit the other.
    // U+FB01 LATIN SMALL LIGATURE FI.
    expect(normalizeEmail('aﬁle@example.com')).toBe('aﬁle@example.com');
    expect(normalizeEmail('aﬁle@example.com')).not.toBe('afile@example.com');
    // U+FF43 FULLWIDTH LATIN SMALL LETTER C.
    expect(normalizeEmail('aliｃe@example.com')).not.toBe('alice@example.com');
    // U+FF2A FULLWIDTH LATIN CAPITAL LETTER J lower-cases to its full-width small form.
    expect(normalizeEmail('Ｊohn@example.com')).toBe('ｊohn@example.com');
    expect(normalizeEmail('Ｊohn@example.com')).not.toBe('john@example.com');
    // U+212A KELVIN SIGN is a *canonical* singleton of `K`, so NFC folds it and
    // NFC-vs-NFKC makes no difference there: the pair that must stay apart is the
    // compatibility one above.
    expect(normalizeEmail('Kelvin@example.com')).toBe('kelvin@example.com');
  });

  it('M2-AC02/2 rewrites no dots and no plus tag: those are different addresses', () => {
    expect(normalizeEmail('a.b@example.com')).toBe('a.b@example.com');
    expect(normalizeEmail('ab@example.com')).toBe('ab@example.com');
    expect(normalizeEmail('a+tester@example.com')).toBe('a+tester@example.com');
    expect(normalizeEmail('a.b@example.com')).not.toBe(normalizeEmail('ab@example.com'));
  });

  it('M2-AC02/2 refuses an empty value and one without @, and never echoes the value', () => {
    // A full-width `＠` (U+FF20) is not an `@`: NFC leaves it alone, so the value
    // has no separator and is refused rather than silently rewritten.
    for (const bad of ['', '   ', '\t\n', 'tester＠example.com']) {
      expect(() => normalizeEmail(bad), bad).toThrow(InvalidEmailError);
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
    for (const raw of ['Ｊohn.Doe+x@Example.COM ', 'A@B.CO', 'ünïcode@Exämple.COM', 'Ä@b.co']) {
      const normalized = normalizeEmail(raw);
      expect(normalized).not.toBe('');
      expect(normalized).toBe(normalized.toLowerCase());
    }
  });
});
