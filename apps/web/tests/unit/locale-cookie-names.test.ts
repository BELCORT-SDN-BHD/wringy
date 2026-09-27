/**
 * The E2E harness and the web name the four language cookies the same way
 * (M2-04; docs/m2-internal/m2-04-code-review.md §3's cookie table).
 *
 * `tests/e2e-internal/fixtures.ts` holds the names as literals, because its
 * tsconfig is plain Node and it may import nothing from `src/`. Every `locale`
 * row arranges or inspects a cookie through those literals, and the fixtures
 * answer the prompt for every other project through one of them; a rename in
 * `src/lib/locale/cookies.ts` that the fixtures missed would leave the rows
 * arranging a cookie the app never reads. This row is what keeps the two from
 * drifting.
 */
import { describe, expect, it } from 'vitest';

import {
  GUEST_LOCALE_COOKIE,
  LOCALE_CARRY_COOKIE,
  LOCALE_PROMPT_COOKIE,
  LOCALE_SESSION_COOKIE,
} from '@/lib/locale/cookies';

import { LOCALE_COOKIES } from '../e2e-internal/fixtures';

describe('M2-AC04/1 harness: the language cookie names', () => {
  it('M2-AC04/1 harness: the four cookie names the E2E fixtures write are the ones src/lib/locale/cookies.ts exports', () => {
    expect(LOCALE_COOKIES).toEqual({
      guest: GUEST_LOCALE_COOKIE,
      session: LOCALE_SESSION_COOKIE,
      carry: LOCALE_CARRY_COOKIE,
      prompt: LOCALE_PROMPT_COOKIE,
    });
  });
});
