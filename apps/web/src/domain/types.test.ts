import { describe, expect, it } from 'vitest';

import { LOCALES } from './types';

describe('domain types', () => {
  it('declares the three M1 locales', () => {
    expect(LOCALES.length).toBe(3);
  });
});
