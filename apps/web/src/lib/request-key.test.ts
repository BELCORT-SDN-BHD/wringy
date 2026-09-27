import { webcrypto } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { newRequestKey, type KeySource } from './request-key';

/**
 * The request-key mint (M2-04; m2-04-code-review.md R8 rev 2, R13 "web unit"):
 * both branches, because a phone on the LAN reaching a dev server is not a
 * secure context and has no `crypto.randomUUID` (record §1).
 */

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('M2-AC04/3 request key: every create form gets a v4 key, in a secure context or not', () => {
  it('M2-AC04/3 request key: a secure context uses crypto.randomUUID', () => {
    let calls = 0;
    const source: KeySource = {
      randomUUID: () => {
        calls += 1;
        return '5b0e7c1a-3f2d-4c8e-9a1b-2c3d4e5f6a7b';
      },
      getRandomValues: () => {
        throw new Error('the fallback must not run where randomUUID exists');
      },
    };
    expect(newRequestKey(source)).toBe('5b0e7c1a-3f2d-4c8e-9a1b-2c3d4e5f6a7b');
    expect(calls).toBe(1);
  });

  it('M2-AC04/3 request key: without randomUUID, a v4 uuid is built from getRandomValues', () => {
    const insecure: KeySource = { getRandomValues: (array) => webcrypto.getRandomValues(array) };
    const keys = new Set<string>();
    for (let round = 0; round < 200; round += 1) {
      const key = newRequestKey(insecure);
      expect(key).toMatch(V4);
      keys.add(key);
    }
    expect(keys.size).toBe(200);
  });

  it('M2-AC04/3 request key: the fallback sets the version and variant bits whatever the bytes are', () => {
    for (const fill of [0x00, 0xff, 0x5a]) {
      const key = newRequestKey({ getRandomValues: (array) => array.fill(fill) });
      expect(key, `bytes 0x${fill.toString(16)}`).toMatch(V4);
    }
    expect(newRequestKey({ getRandomValues: (array) => array.fill(0) })).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('M2-AC04/3 request key: the default source is the platform’s Web Crypto', () => {
    expect(newRequestKey()).toMatch(V4);
    expect(newRequestKey()).not.toBe(newRequestKey());
  });
});
