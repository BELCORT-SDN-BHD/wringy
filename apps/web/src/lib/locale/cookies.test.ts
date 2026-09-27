import { describe, expect, it } from 'vitest';

import { LOCALE_SESSION_COOKIE, readUnsavedChoice, unsavedChoiceValue, writeUnsaved, type CookieOptions } from './cookies';

/**
 * The unsaved choice's stamped value (M2-04 W7 N1): `<locale>.<epoch ms>`, so the
 * resolution can tell a choice that a newer account save has overtaken. The
 * cookie names themselves are pinned by `tests/unit/locale-cookie-names.test.ts`.
 */

describe('M2-AC04/2 account: the unsaved choice carries the instant it was made', () => {
  it('M2-AC04/2 account: the value is the locale and the epoch milliseconds, and reads back as written', () => {
    for (const locale of ['en-MY', 'ms-MY', 'zh-Hans-MY'] as const) {
      const value = unsavedChoiceValue({ locale, at: 1_790_000_000_123 });
      expect(value).toBe(`${locale}.1790000000123`);
      expect(readUnsavedChoice(value)).toEqual({ locale, at: 1_790_000_000_123 });
    }
  });

  it('M2-AC04/2 account: an unstamped, malformed or foreign value reads as no choice at all', () => {
    for (const raw of [undefined, null, '', 'ms-MY', 'ms-MY.', 'ms-MY.x', 'ms-MY.-5', 'ms-MY.5.5', 'en.5', 'zh-Hant-MY.5', 'MS-MY.5']) {
      expect(readUnsavedChoice(raw), String(raw)).toBeNull();
    }
  });

  it('M2-AC04/2 account: writeUnsaved stamps the choice with the web clock as it writes it', () => {
    const writes: { name: string; value: string; options: CookieOptions }[] = [];
    const jar = { set: (name: string, value: string, options: CookieOptions) => writes.push({ name, value, options }), expire: () => {} };

    const before = Date.now();
    writeUnsaved(jar, 'zh-Hans-MY', false);
    const after = Date.now();

    expect(writes).toHaveLength(1);
    expect(writes[0]?.name).toBe(LOCALE_SESSION_COOKIE);
    const read = readUnsavedChoice(writes[0]?.value);
    expect(read?.locale).toBe('zh-Hans-MY');
    expect(read?.at).toBeGreaterThanOrEqual(before);
    expect(read?.at).toBeLessThanOrEqual(after);
  });
});
