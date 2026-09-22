// A deliberate dependency-direction violation (kickoff-package.md §8.7, §6.7).
//
// scripts/check-dependency-direction.mjs copies this file to
// apps/web/src/lib/__dependency-violation__.ts, runs dependency-cruiser, asserts
// that the rule `web-not-to-server-runtime` rejects it, and deletes the copy.
// It is never compiled or shipped from this folder.
import { createPool } from '@wringy/db';

export const leakedPool = createPool;
