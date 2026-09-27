/**
 * `apps/web/src/domain/types.ts` (the M1 demo domain, no server dependency) and
 * `@wringy/contracts` (`packages/contracts/src/identity.ts`, the wire contract
 * the internal build validates against) each name the three locales as their
 * own literal list (M2-04 code review, Standards T8). Nothing pins the two
 * equal, so a locale added on one side and missed on the other would only
 * surface as a mismatch somewhere downstream — the demo accepting a language
 * the API refuses, or the reverse.
 *
 * `apps/web` does not merge the two lists into one: the demo domain is meant
 * to have no server dependency (kickoff decision 8; `apps/web/src/domain/types.ts`'s
 * own header, "No React, no browser APIs" — and no @wringy/contracts either,
 * which is a wire contract, not a domain type). `.dependency-cruiser.cjs` has
 * no rule forbidding `apps/web` from importing `@wringy/contracts` — only
 * `web-not-to-server-runtime` (db/pg/pg-boss/fastify) and
 * `worker-not-to-contracts` (apps/worker only) name that package, and
 * `@wringy/contracts` is already a declared dependency of `apps/web`, imported
 * from plenty of `src/` files and from a test one line away
 * (`src/app/(internal)/internal/api-read.test.ts`). It is also outside what
 * `pnpm depcruise` cruises at all: `scripts/check-dependency-direction.mjs`
 * cruises `apps/<name>/src` and `packages/<name>/src` only, never `tests/`.
 * So this file may import `@wringy/contracts` directly, the same as
 * `locale-cookie-names.test.ts` imports the E2E fixtures' literals, and pin
 * the two lists equal without merging them.
 */
import { LOCALES as CONTRACTS_LOCALES } from '@wringy/contracts';
import { describe, expect, it } from 'vitest';

import { LOCALES as DOMAIN_LOCALES } from '@/domain/types';

describe('M2-AC04/1 the three codes: the two lists that name them', () => {
  it('M2-AC04/1 the three codes: apps/web/src/domain/types.ts LOCALES equals @wringy/contracts LOCALES', () => {
    expect(DOMAIN_LOCALES).toEqual(CONTRACTS_LOCALES);
  });
});
