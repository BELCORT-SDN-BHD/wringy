import { describe, expect, it } from 'vitest';

import { scramSha256Verifier } from './scram';

describe('scramSha256Verifier', () => {
  it('produces the pg_authid SCRAM-SHA-256 format and never contains the password', () => {
    const password = 'local-password-123';
    const verifier = scramSha256Verifier(password);
    expect(verifier).toMatch(/^SCRAM-SHA-256\$4096:[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=:[A-Za-z0-9+/]{43}=$/);
    expect(verifier).not.toContain(password);
  });

  it('is salted: the same password gives a different verifier each time', () => {
    expect(scramSha256Verifier('same-password-1')).not.toBe(scramSha256Verifier('same-password-1'));
  });

  it('is deterministic for a fixed salt', () => {
    const salt = Buffer.alloc(16, 7);
    expect(scramSha256Verifier('fixed-password-1', salt)).toBe(scramSha256Verifier('fixed-password-1', salt));
  });

  it('refuses passwords SASLprep could rewrite', () => {
    expect(() => scramSha256Verifier('with space-1234')).toThrow(/printable ASCII/);
    expect(() => scramSha256Verifier('pässword-12345')).toThrow(/printable ASCII/);
  });
});
