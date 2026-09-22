import { describe, expect, it } from 'vitest';

import { EMAIL_KINDS, loadScenario } from '@/domain';
import type { NotificationKind } from '@/domain/types';

import { hasNotificationCopy, notificationValues } from './notification-copy';

/** Every kind the engine can emit, taken from the type's own union at runtime. */
const KINDS: NotificationKind[] = [
  'campaign.published',
  'campaign.readiness_blocked',
  'campaign.submissions_closed',
  'campaign.closed',
  'submission.accepted',
  'submission.baseline_unavailable',
  'submission.data_unavailable',
  'submission.resynced',
  'content.approved',
  'content.rejected',
  'claim.reserved',
  'claim.partial_offer',
  'claim.waitlisted',
  'waitlist.budget_available',
  'claim.confirmed',
  'claim.rejected',
  'claim.escalated',
  'claim.rejection_finalized',
  'metering.held',
  'appeal.filed',
  'appeal.upheld',
  'appeal.rejected',
  'payout.processing',
  'payout.paid',
  'payout.failed',
  'payout.unknown',
  'payout.reconciled',
  'deadline.metering_ended',
  'deadline.claim_deadline_extended',
  'deadline.claim_deadline_passed',
];

describe('notification copy', () => {
  it('has copy for every notification kind', () => {
    const missing = KINDS.filter((kind) => !hasNotificationCopy(kind));
    expect(missing).toEqual([]);
  });

  it('formats sen parameters as money and ISO parameters as absolute times', () => {
    const values = notificationValues(
      'claim.reserved',
      { amountSen: 500, seq: 1, isPartial: 'false', unreservedRemainderSen: 0 },
      'en-MY',
      'Unknown',
    );
    expect(values.amountSen).toBe('RM 5.00');
    expect(values.seq).toBe('1');

    const accepted = notificationValues(
      'submission.accepted',
      {
        campaignTitle: 'Demo',
        meteringEndsAt: '2026-09-08T12:00:00+08:00',
        claimDeadlineAt: '2026-09-15T12:00:00+08:00',
      },
      'en-MY',
      'Unknown',
    );
    expect(accepted.meteringEndsAt).toContain('UTC+08:00');
    expect(accepted.claimDeadlineAt).toContain('Sept 2026');
  });

  it('fills a declared parameter the event did not supply with the unknown label', () => {
    const values = notificationValues('content.rejected', {}, 'en-MY', 'Unknown');
    expect(values.reason).toBe('Unknown');
  });

  it('never turns a missing amount into zero', () => {
    const values = notificationValues('payout.paid', {}, 'en-MY', 'Unknown');
    expect(values.amountSen).toBe('Unknown');
    expect(values.amountSen).not.toContain('0');
  });

  it('localizes the engine codes a message interpolates, and only those', () => {
    // The sentence around the code is translated, so leaving the code English would
    // put `data_outage` inside a Malay or Chinese notification and its simulated
    // email (#10/P10). `reason` in a rejection is a person's words, so it stays.
    const tCommon = (key: string) => `copy:${key}`;

    const extended = notificationValues(
      'deadline.claim_deadline_extended',
      { submissionId: 'sub_1', reason: 'data_outage', newDeadlineAt: '2026-09-16T12:00:00+08:00' },
      'en-MY',
      'Unknown',
      tCommon,
    );
    expect(extended.reason).toBe('copy:extensionReason.data_outage');
    expect(extended.newDeadlineAt).toContain('UTC+08:00');

    const reconciled = notificationValues(
      'payout.reconciled',
      { attemptId: 'pa_1', outcome: 'confirmed_succeeded', note: 'statement shows it' },
      'en-MY',
      'Unknown',
      tCommon,
    );
    expect(reconciled.outcome).toBe('copy:reconcileOutcome.confirmed_succeeded');
    expect(reconciled.note).toBe('statement shows it');

    const unavailable = notificationValues(
      'submission.data_unavailable',
      { submissionId: 'sub_1', missingReason: 'source_unreachable' },
      'en-MY',
      'Unknown',
      tCommon,
    );
    expect(unavailable.missingReason).toBe('copy:missingReason.source_unreachable');

    // A typed rejection reason is never rewritten.
    const rejected = notificationValues(
      'claim.rejected',
      { claimId: 'cl_1', reason: 'views look off', appealDeadlineAt: '2026-09-08T12:00:00+08:00' },
      'en-MY',
      'Unknown',
      tCommon,
    );
    expect(rejected.reason).toBe('views look off');
  });

  it('covers every notification the scenarios actually produce', () => {
    const kinds = new Set<string>();
    for (const scenario of [
      'baseline',
      'main_flow_ready',
      'partial_budget',
      'waitlist',
      'rejection_appeal',
      'payout_unknown',
      'payout_failed',
      'deadline_extension',
      'campaign_closure',
      'data_outage',
    ] as const) {
      for (const notification of Object.values(loadScenario(scenario).notifications)) {
        kinds.add(notification.kind);
      }
    }

    expect(kinds.size).toBeGreaterThan(0);
    for (const kind of kinds) {
      expect(hasNotificationCopy(kind), `no copy for ${kind}`).toBe(true);
    }
  });

  it('has an email preview for every kind the engine marks as important', () => {
    for (const kind of EMAIL_KINDS) {
      expect(hasNotificationCopy(kind), `no copy for ${kind}`).toBe(true);
    }
  });
});
