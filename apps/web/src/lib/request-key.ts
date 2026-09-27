/**
 * One request key: a v4 uuid a create form carries so a language switch can
 * keep it and nothing re-posts it (M2-04; m2-04-code-review.md R8 rev 2; kickoff
 * §8.11 "drafts and request keys survive a language switch").
 *
 * `crypto.randomUUID` exists only in a secure context: it is there on
 * `http://127.0.0.1` and `https://`, and undefined for a phone on the LAN
 * reaching a dev server by address, while `crypto.getRandomValues` exists in
 * both (record §1). So the fallback builds the same v4 shape from 16 random
 * bytes. The demo's own helper (`store/command-id.ts`) cannot be imported from
 * the internal build (`internal-not-to-demo`), hence this one.
 *
 * No Route Handler reads the field and no header carries it in this ticket:
 * M2-05 adds the `X-Request-Key` header together with `request_dedup`, its
 * consumer.
 */

/** The part of Web Crypto this uses; a test hands in a fake. */
export interface KeySource {
  randomUUID?: () => string;
  getRandomValues<T extends Uint8Array>(array: T): T;
}

export function newRequestKey(source: KeySource = globalThis.crypto): string {
  if (typeof source.randomUUID === 'function') return source.randomUUID();

  const bytes = source.getRandomValues(new Uint8Array(16));
  // RFC 9562 §5.4: version 4 in the high nibble of byte 6, variant 10xx in byte 8.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
