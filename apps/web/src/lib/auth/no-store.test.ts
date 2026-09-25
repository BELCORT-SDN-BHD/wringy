import { describe, expect, it } from 'vitest';

import { noStore, noStoreHeaders } from './no-store';

describe('M2-AC02/3 cache: no-store is Wringy’s own property, not a library’s', () => {
  it('M2-AC02/3 cache: noStoreHeaders names the three headers §4.7 requires', () => {
    expect(noStoreHeaders()).toEqual({
      'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
      Expires: '0',
      Pragma: 'no-cache',
    });
  });

  it('M2-AC02/3 cache: noStore sets all three on a response and returns it', () => {
    const response = new Response(null, { status: 303 });

    expect(noStore(response)).toBe(response);
    expect(response.headers.get('cache-control')).toBe('private, no-cache, no-store, must-revalidate, max-age=0');
    expect(response.headers.get('expires')).toBe('0');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });

  it('M2-AC02/3 cache: noStore overwrites a cacheable Cache-Control rather than adding to it', () => {
    const response = new Response(null, { headers: { 'cache-control': 'public, max-age=3600' } });

    noStore(response);

    // One header, not two: a shared cache must not be able to read the permissive one.
    expect(response.headers.get('cache-control')).toBe('private, no-cache, no-store, must-revalidate, max-age=0');
  });

  it('M2-AC02/3 cache: a fresh object each call, so no caller can mutate the shared set', () => {
    const first = noStoreHeaders();
    first['Cache-Control'] = 'public';
    expect(noStoreHeaders()['Cache-Control']).toBe('private, no-cache, no-store, must-revalidate, max-age=0');
  });
});
