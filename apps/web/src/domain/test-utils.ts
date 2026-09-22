// Test helpers. Not imported by application code.
//
// The harness keeps one DemoState and applies commands through the real engine, so
// tests exercise exactly the path the store uses. Command ids are generated per call
// so that idempotency is tested on purpose, never by accident.

import { applyCommand } from './engine';
import { createSeedState } from './seed';
import type { Command, CommandResult, DemoState, ErrorCode } from './types';

export interface Harness {
  readonly state: DemoState;
  /** Applies a command and fails loudly when the engine rejects it. */
  ok(command: Command, commandId?: string): Extract<CommandResult, { ok: true }>;
  /** Applies a command expecting a specific failure. */
  fail(command: Command, code: ErrorCode, commandId?: string): Extract<CommandResult, { ok: false }>;
  /** Applies a command and returns whatever happened. */
  apply(command: Command, commandId?: string): CommandResult;
  /** Replaces the held state (used after a scenario load). */
  set(state: DemoState): void;
  readonly commandCount: number;
}

export function createHarness(initial: DemoState = createSeedState()): Harness {
  let state = initial;
  let counter = 0;

  const nextId = (): string => {
    counter += 1;
    return `test-${counter}`;
  };

  return {
    get state() {
      return state;
    },
    get commandCount() {
      return counter;
    },
    set(next: DemoState) {
      state = next;
    },
    apply(command, commandId) {
      const result = applyCommand(state, command, { commandId: commandId ?? nextId() });
      // The store always takes result.state: on failure the engine returns the
      // unchanged state, except for a partial offer found stale.
      state = result.state;
      return result;
    },
    ok(command, commandId) {
      const result = applyCommand(state, command, { commandId: commandId ?? nextId() });
      if (!result.ok) {
        throw new Error(
          `expected ${command.type} to succeed, got ${result.code}${result.detail ? ` (${result.detail})` : ''}`,
        );
      }
      state = result.state;
      return result;
    },
    fail(command, code, commandId) {
      const result = applyCommand(state, command, { commandId: commandId ?? nextId() });
      if (result.ok) {
        throw new Error(`expected ${command.type} to fail with ${code}, but it succeeded`);
      }
      if (result.code !== code) {
        throw new Error(
          `expected ${command.type} to fail with ${code}, got ${result.code}${result.detail ? ` (${result.detail})` : ''}`,
        );
      }
      state = result.state;
      return result;
    },
  };
}

/** The single submission owned by `creatorId` in `campaignId`. */
export function findSubmission(
  state: DemoState,
  campaignId: string,
  creatorId: string,
): DemoState['submissions'][string] {
  const submission = Object.values(state.submissions).find(
    (entry) => entry.campaignId === campaignId && entry.creatorId === creatorId,
  );
  if (!submission) throw new Error(`no submission for ${creatorId} in ${campaignId}`);
  return submission;
}

export function findSubmissionByUrl(state: DemoState, url: string): DemoState['submissions'][string] {
  const submission = Object.values(state.submissions).find((entry) => entry.url === url);
  if (!submission) throw new Error(`no submission with url ${url}`);
  return submission;
}

export function claimsOf(state: DemoState, submissionId: string) {
  return Object.values(state.claims)
    .filter((claim) => claim.submissionId === submissionId)
    .sort((a, b) => a.seq - b.seq);
}

export function latestClaim(state: DemoState, submissionId: string) {
  const claims = claimsOf(state, submissionId);
  const claim = claims[claims.length - 1];
  if (!claim) throw new Error(`no claim for submission ${submissionId}`);
  return claim;
}

export function onlyOffer(state: DemoState, submissionId: string) {
  const offer = Object.values(state.partialOffers).find(
    (entry) => entry.submissionId === submissionId && entry.status === 'open',
  );
  if (!offer) throw new Error(`no open offer for submission ${submissionId}`);
  return offer;
}

export function onlyWaitlistEntry(state: DemoState, submissionId: string) {
  const entry = Object.values(state.waitlist).find(
    (candidate) => candidate.submissionId === submissionId,
  );
  if (!entry) throw new Error(`no waitlist entry for submission ${submissionId}`);
  return entry;
}

export function obligationOf(state: DemoState, claimId: string) {
  const obligation = Object.values(state.obligations).find((entry) => entry.claimId === claimId);
  if (!obligation) throw new Error(`no obligation for claim ${claimId}`);
  return obligation;
}

export function latestAttemptOf(state: DemoState, obligationId: string) {
  const attempts = Object.values(state.payoutAttempts)
    .filter((attempt) => attempt.obligationId === obligationId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const attempt = attempts[attempts.length - 1];
  if (!attempt) throw new Error(`no payout attempt for obligation ${obligationId}`);
  return attempt;
}

export function appealOf(state: DemoState, claimId: string) {
  const appeal = Object.values(state.appeals).find((entry) => entry.claimId === claimId);
  if (!appeal) throw new Error(`no appeal for claim ${claimId}`);
  return appeal;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

export const URLS = {
  demoTiktok: 'https://www.tiktok.com/@demouser/video/7400000000000000001',
  demoTiktokAlt: 'https://vt.tiktok.com/ZS1234567/',
  demoTiktokSame: 'https://m.tiktok.com/@demouser/video/7400000000000000001?is_from_webapp=1',
  demoTiktokSecond: 'https://www.tiktok.com/@demouser/video/7400000000000000002',
  demoInstagram: 'https://www.instagram.com/reel/CxAbCdEfGhI/',
  demoYoutube: 'https://www.youtube.com/watch?v=demoClosure01',
  benTiktok: 'https://www.tiktok.com/@bentan/video/7400000000000000101',
} as const;
