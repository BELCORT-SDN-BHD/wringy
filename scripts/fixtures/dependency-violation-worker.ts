// A deliberate dependency-direction violation (kickoff-package.md §8.1, §8.7).
//
// scripts/check-dependency-direction.mjs copies this file to
// apps/worker/src/__dependency-violation__.ts, runs dependency-cruiser, asserts
// that the rule `worker-not-to-contracts` rejects it, and deletes the copy.
// It is never compiled or shipped from this folder.
import { healthResponseSchema } from '@wringy/contracts';

export const leakedContract = healthResponseSchema;
