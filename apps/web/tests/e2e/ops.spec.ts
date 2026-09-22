/**
 * Operations acceptance run (tickets #3, #4, #6, #7, #8 — the ops parts).
 *
 * What it is here to prove, in the order the work order lists it:
 *   1. one approval alone never shows a payment; both approvals confirm; the four
 *      buckets read 1995/0/5/0 on the claim page;
 *   2. a rejection needs a reason, holds the reservation, and cannot be released
 *      while the appeal window is open;
 *   3. an upheld appeal returns the claim to review with the same queue position
 *      and amount; a rejected appeal still holds the reservation until finalised;
 *   4. 48 hours without a decision escalates and never auto-approves;
 *   5. finance: start → processing → paid; a confirmed failure allows one
 *      controlled retry; an unknown result offers only reconciliation;
 *   6. a reviewer cannot start a payout and the ENGINE says so, not just the page;
 *   7. an unreadable source keeps its last trusted value and records the re-sync;
 *   8. readiness is what unblocks the merchant's publish.
 *
 * Demo states are built with the engine (`applyCommand`) exactly the way
 * `helpers.ts` builds a scenario, because several preconditions belong to the
 * merchant and creator pages that other wave-2 workers own. Every action under
 * test is then driven through the real operations UI.
 */

import { expect, test, type Page } from '@playwright/test';

import { applyCommand, loadScenario as buildScenarioState } from '../../src/domain';
import type { Command, DemoState, ScenarioId } from '../../src/domain/types';

import {
  advanceClock,
  confirmWith,
  dismissLocalePrompt,
  expectBuckets,
  expectNoHorizontalOverflow,
  injectState,
  readStoredState,
  setLocale,
  setProviderOutcome,
  settleToasts,
  signInAs,
  waitForHydration,
} from './helpers';
import { M1_EVIDENCE_DIR, captureFrame, evidencePath } from './evidence';

// ---------------------------------------------------------------------------
// Building a precondition
// ---------------------------------------------------------------------------

/**
 * A scenario plus extra commands, applied through the engine so a state the UI
 * could not reach fails the build instead of being asserted against.
 */
function build(scenarioId: ScenarioId, steps: Command[] = []): DemoState {
  let state = buildScenarioState(scenarioId);
  steps.forEach((command, index) => {
    const result = applyCommand(state, command, {
      commandId: `ops-spec:${scenarioId}:${index}:${command.type}`,
    });
    if (!result.ok) {
      throw new Error(
        `ops.spec build ${scenarioId} step ${index} [${command.type}]: ${result.code}${
          result.detail ? ` (${result.detail})` : ''
        }`,
      );
    }
    state = result.state;
  });
  return state;
}

async function load(page: Page, state: DemoState, path: string): Promise<void> {
  await injectState(page, state, path);
  await dismissLocalePrompt(page);
}

const onlyClaim = (state: DemoState) => {
  const claims = Object.values(state.claims);
  if (claims.length !== 1) throw new Error(`expected one claim, found ${claims.length}`);
  return claims[0];
};

const onlyObligation = (state: DemoState) => {
  const obligations = Object.values(state.obligations);
  if (obligations.length !== 1) {
    throw new Error(`expected one obligation, found ${obligations.length}`);
  }
  return obligations[0];
};

const submissionByUrl = (state: DemoState, needle: string) => {
  const found = Object.values(state.submissions).find((submission) =>
    submission.url.includes(needle),
  );
  if (!found) throw new Error(`no submission whose url contains ${needle}`);
  return found;
};

const DEMO_TIKTOK = '7400000000000000001';

/** The creator's own claim on the seeded Kopi Raya campaign. */
function claimOnMainFlow(): DemoState {
  const ready = buildScenarioState('main_flow_ready');
  const submission = submissionByUrl(ready, DEMO_TIKTOK);
  return build('main_flow_ready', [{ type: 'claim.request', submissionId: submission.id }]);
}

/** Same claim with the merchant's content approval already recorded. */
function claimWithContentApproved(): DemoState {
  const ready = buildScenarioState('main_flow_ready');
  const submission = submissionByUrl(ready, DEMO_TIKTOK);
  return build('main_flow_ready', [
    { type: 'claim.request', submissionId: submission.id },
    { type: 'session.switchWorkspace', workspace: 'merchant' },
    { type: 'submission.reviewContent', submissionId: submission.id, decision: 'approve', reason: null },
  ]);
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

// `expectBuckets`, `confirmWith`, `settleToasts` and `setProviderOutcome` are in
// `helpers.ts`: the acceptance run needs the same four, and two copies of an
// assertion about money is exactly the kind of thing that drifts.

/** The claim's own status badge in the page header. */
function claimStatus(page: Page) {
  return page.locator('[data-status-group="claim"]').first();
}

// ---------------------------------------------------------------------------
// 1 — two independent reviews
// ---------------------------------------------------------------------------

test.describe('the two reviews are independent', () => {
  test('metering approval alone shows no payment and no confirmation', async ({ page }) => {
    const ready = buildScenarioState('main_flow_ready');
    const submission = submissionByUrl(ready, DEMO_TIKTOK);
    const base = claimOnMainFlow();
    const claim = onlyClaim(base);

    // Approved by operations in the engine; the merchant has not reviewed yet.
    const state = build('main_flow_ready', [
      { type: 'claim.request', submissionId: submission.id },
      { type: 'session.signIn', userId: 'user-ops-reviewer' },
      { type: 'session.setOpsRole', role: 'ops_reviewer' },
      { type: 'claim.reviewMetering', claimId: claim.id, decision: 'approve', reason: null },
    ]);

    await load(page, state, `/ops/claims/${claim.id}`);
    await signInAs(page, 'ops_reviewer');
    await page.goto(`/ops/claims/${claim.id}`);
    await waitForHydration(page);

    await expect(page.locator('[data-status-group="metering"]').first()).toHaveAttribute(
      'data-status-code',
      'approved',
    );
    await expect(page.locator('[data-status-group="content"]').first()).toHaveAttribute(
      'data-status-code',
      'pending',
    );
    await expect(claimStatus(page)).toHaveAttribute('data-status-code', 'pending_review');
    await expect(page.getByTestId('ops-claim-confirmed')).toHaveCount(0);
    await expectBuckets(page, [199_500, 500, 0, 0]);
  });

  test('content approval alone shows no payment; both approvals confirm 1995/0/5/0', async ({
    page,
  }) => {
    const state = claimWithContentApproved();
    const claim = onlyClaim(state);

    await load(page, state, '/');
    await signInAs(page, 'ops_reviewer');
    await page.goto(`/ops/claims/${claim.id}`);
    await waitForHydration(page);

    // Content approved, metering still pending: nothing says paid or confirmed.
    await expect(page.locator('[data-status-group="content"]').first()).toHaveAttribute(
      'data-status-code',
      'approved',
    );
    await expect(claimStatus(page)).toHaveAttribute('data-status-code', 'pending_review');
    await expect(page.getByTestId('ops-claim-confirmed')).toHaveCount(0);
    await expectBuckets(page, [199_500, 500, 0, 0]);

    await page.getByTestId('ops-metering-approve').click();
    await confirmWith(page);

    await expect(claimStatus(page)).toHaveAttribute('data-status-code', 'confirmed_unpaid');
    await expect(page.getByTestId('ops-claim-confirmed')).toBeVisible();
    await expectBuckets(page, [199_500, 0, 500, 0]);

    // Confirmed is not paid: the obligation exists and no payout has run.
    const stored = await readStoredState(page);
    const obligations = Object.values(stored?.obligations ?? {});
    expect(obligations).toHaveLength(1);
    expect(obligations[0].status).toBe('open');
    expect(obligations[0].providerAvailableAt).toBeNull();
    expect(Object.keys(stored?.payoutAttempts ?? {})).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2 — rejection, the held reservation and the release
// ---------------------------------------------------------------------------

test('a rejection needs a reason, holds the reservation and is released only after the appeal window', async ({
  page,
}) => {
  const state = claimOnMainFlow();
  const claim = onlyClaim(state);

  await load(page, state, '/');
  await signInAs(page, 'ops_reviewer');
  await page.goto(`/ops/claims/${claim.id}`);
  await waitForHydration(page);

  // A rejection without a reason cannot be confirmed at all.
  await page.getByTestId('ops-metering-reject').click();
  const dialog = page.locator('[role="alertdialog"]');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('confirm-accept')).toBeDisabled();
  await confirmWith(page, 'Qualified views could not be verified inside the window.');

  await expect(claimStatus(page)).toHaveAttribute('data-status-code', 'rejected_appealable');
  await expect(page.getByTestId('ops-reservation-held')).toBeVisible();
  await expectBuckets(page, [199_500, 500, 0, 0]);

  // The release is refused while the appeal window runs, with the engine's reason.
  await expect(page.getByTestId('ops-finalize-blocked')).toHaveAttribute(
    'data-block',
    'appeal_window_open',
  );
  await expect(page.getByTestId('ops-finalize-open')).toBeDisabled();

  // The 7-calendar-day window is inclusive of its last instant, so a week lands
  // exactly ON the deadline and is still blocked; the extra hour passes it.
  await advanceClock(page, 'week');
  await page.goto(`/ops/claims/${claim.id}`);
  await expect(page.getByTestId('ops-finalize-blocked')).toHaveAttribute(
    'data-block',
    'appeal_window_open',
  );
  await advanceClock(page, 'hour');
  await page.goto(`/ops/claims/${claim.id}`);

  await expect(page.getByTestId('ops-finalize-blocked')).toHaveCount(0);
  await expect(page.getByTestId('ops-finalize-open')).toBeEnabled();

  await page.getByTestId('ops-finalize-open').click();
  await confirmWith(page, 'Appeal window closed with no appeal filed.');

  await expect(claimStatus(page)).toHaveAttribute('data-status-code', 'rejected_final');
  await expectBuckets(page, [200_000, 0, 0, 0]);

  // The audit row carries the actor and the reason that was typed.
  const audit = page.getByTestId('ops-audit');
  await expect(audit).toContainText('Ops Reviewer');
  await expect(audit).toContainText('Appeal window closed with no appeal filed.');

  // And the before/after badge is words, not the engine's status codes: these
  // used to render `rejected_appealable → rejected_final` inside a translated
  // page (`src/lib/status-copy.ts`).
  await expect(audit).toContainText('Rejected · reservation held → Rejected · final');
  await expect(audit).not.toContainText('rejected_appealable');
  await expect(audit).not.toContainText('rejected_final');

  const stored = await readStoredState(page);
  const finalized = Object.values(stored?.notifications ?? {}).filter(
    (notification) => notification.kind === 'claim.rejection_finalized',
  );
  expect(finalized.map((row) => row.recipientRole).sort()).toEqual(['creator', 'merchant']);
});

// ---------------------------------------------------------------------------
// 3 — appeals
// ---------------------------------------------------------------------------

test.describe('appeals', () => {
  /** `rejection_appeal` leaves the window open; the creator files the appeal. */
  function appealFiled(): DemoState {
    const rejected = buildScenarioState('rejection_appeal');
    const claim = onlyClaim(rejected);
    return build('rejection_appeal', [
      {
        type: 'appeal.file',
        claimId: claim.id,
        reason: 'The views were inside the window; please re-read the source.',
      },
    ]);
  }

  test('an upheld appeal returns the claim to review with the same position and amount', async ({
    page,
  }) => {
    const state = appealFiled();
    const claim = onlyClaim(state);
    const appeal = Object.values(state.appeals)[0];

    await load(page, state, '/');
    await signInAs(page, 'ops_reviewer');

    await page.goto('/ops/appeals');
    await waitForHydration(page);
    await expect(page.getByTestId('ops-appeals-list')).toContainText('Appeal open');
    await page.locator(`[data-appeal-id="${appeal.id}"]`).getByRole('link').click();

    await expect(page.getByTestId('ops-appeal-creator-reason')).toContainText(
      'please re-read the source',
    );
    await expect(page.getByTestId('ops-appeal-evidence')).toBeVisible();

    await page.getByTestId('ops-appeal-uphold').click();
    await confirmWith(page, 'The source confirms the window; the rejection was wrong.');

    await expect(page.locator('[data-status-group="appeal"]').first()).toHaveAttribute(
      'data-status-code',
      'upheld',
    );

    await page.goto(`/ops/claims/${claim.id}`);
    await expect(claimStatus(page)).toHaveAttribute('data-status-code', 'pending_review');
    await expect(page.locator('[data-status-group="metering"]').first()).toHaveAttribute(
      'data-status-code',
      'pending',
    );
    // Same queue position, same amount, reservation never released.
    await expect(page.getByTestId('ops-audit')).toContainText('Ops Reviewer');
    await expectBuckets(page, [199_500, 500, 0, 0]);

    const stored = await readStoredState(page);
    const after = stored?.claims[claim.id];
    expect(after?.seq).toBe(claim.seq);
    expect(after?.amountSen).toBe(claim.amountSen);
    expect(after?.validAt).toBe(claim.validAt);
  });

  test('a rejected appeal still holds the reservation until the rejection is finalised', async ({
    page,
  }) => {
    const state = appealFiled();
    const claim = onlyClaim(state);
    const appeal = Object.values(state.appeals)[0];

    await load(page, state, '/');
    await signInAs(page, 'ops_reviewer');
    await page.goto(`/ops/appeals/${appeal.id}`);
    await waitForHydration(page);

    await page.getByTestId('ops-appeal-reject').click();
    await confirmWith(page, 'The source still shows the views outside the window.');

    await expect(page.locator('[data-status-group="appeal"]').first()).toHaveAttribute(
      'data-status-code',
      'rejected',
    );
    const audit = page.getByTestId('ops-audit');
    await expect(audit).toContainText('Ops Reviewer');
    await expect(audit).toContainText('The source still shows the views outside the window.');

    await page.goto(`/ops/claims/${claim.id}`);
    await expect(claimStatus(page)).toHaveAttribute('data-status-code', 'rejected_appealable');
    await expect(page.getByTestId('ops-reservation-held')).toBeVisible();
    // Still held: nothing moved, and the release is now allowed but not automatic.
    await expectBuckets(page, [199_500, 500, 0, 0]);
    await expect(page.getByTestId('ops-finalize-blocked')).toHaveCount(0);
    await expect(page.getByTestId('ops-finalize-open')).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// 4 — the 48-hour target
// ---------------------------------------------------------------------------

test('48 hours without a decision escalates and never auto-approves', async ({ page }) => {
  const state = claimOnMainFlow();
  const claim = onlyClaim(state);

  await load(page, state, '/');
  await signInAs(page, 'ops_reviewer');
  await page.goto(`/ops/claims/${claim.id}`);
  await waitForHydration(page);
  await expect(page.getByTestId('ops-claim-escalated')).toHaveCount(0);

  await advanceClock(page, 'day');
  await advanceClock(page, 'day');
  await page.goto(`/ops/claims/${claim.id}`);

  await expect(page.getByTestId('ops-claim-escalated')).toBeVisible();
  // Escalation only: the claim is still pending and the amount is untouched.
  await expect(claimStatus(page)).toHaveAttribute('data-status-code', 'pending_review');
  await expect(page.locator('[data-status-group="metering"]').first()).toHaveAttribute(
    'data-status-code',
    'pending',
  );
  await expectBuckets(page, [199_500, 500, 0, 0]);

  await page.goto('/ops');
  await expect(page.locator('[data-queue-kind="escalated"]')).toBeVisible();
  await expect(page.getByTestId('ops-queue-count-escalated')).toContainText('1');

  const stored = await readStoredState(page);
  const escalations = Object.values(stored?.notifications ?? {}).filter(
    (notification) => notification.kind === 'claim.escalated',
  );
  expect(escalations).toHaveLength(1);
  expect(escalations[0].recipientRole).toBe('ops_reviewer');
});

// ---------------------------------------------------------------------------
// 5 — finance
// ---------------------------------------------------------------------------

test.describe('finance', () => {
  /** Both reviews approved, so an obligation exists and nothing has been paid. */
  function confirmedClaim(): DemoState {
    const withContent = claimWithContentApproved();
    const claim = onlyClaim(withContent);
    const ready = buildScenarioState('main_flow_ready');
    const submission = submissionByUrl(ready, DEMO_TIKTOK);

    return build('main_flow_ready', [
      { type: 'claim.request', submissionId: submission.id },
      { type: 'session.switchWorkspace', workspace: 'merchant' },
      {
        type: 'submission.reviewContent',
        submissionId: submission.id,
        decision: 'approve',
        reason: null,
      },
      { type: 'session.signIn', userId: 'user-ops-reviewer' },
      { type: 'session.setOpsRole', role: 'ops_reviewer' },
      { type: 'claim.reviewMetering', claimId: claim.id, decision: 'approve', reason: null },
    ]);
  }

  test('start puts an attempt in processing and a provider success pays 1995/0/0/5', async ({
    page,
  }) => {
    const state = confirmedClaim();
    const obligation = onlyObligation(state);
    const claim = onlyClaim(state);

    await load(page, state, '/');
    await signInAs(page, 'ops_finance');

    await page.goto('/ops/payouts');
    await waitForHydration(page);
    await expect(page.getByTestId('ops-payouts-list')).toContainText('Payable');
    await page.locator(`[data-obligation-id="${obligation.id}"]`).getByRole('link').last().click();

    await expect(page.getByTestId('ops-start-blocked')).toHaveCount(0);
    await page.getByTestId('ops-start-open').click();
    await confirmWith(page);

    const attempt = page.locator('[data-attempt-status]').first();
    await expect(attempt).toHaveAttribute('data-attempt-status', 'processing');

    const providerRef = await readStoredState(page).then((stored) => {
      const attempts = Object.values(stored?.payoutAttempts ?? {});
      expect(attempts).toHaveLength(1);
      return attempts[0].providerRef;
    });

    await setProviderOutcome(page, providerRef, 'Funds available');
    await page.goto(`/ops/payouts/${obligation.id}`);

    await expect(page.locator('[data-attempt-status]').first()).toHaveAttribute(
      'data-attempt-status',
      'succeeded',
    );
    await expect(page.getByTestId('ops-payout-settled')).toBeVisible();
    // "Paid" is the provider account. Bank settlement stays a separate unknown.
    await expect(page.getByTestId('ops-bank-settlement')).toContainText(
      'Bank settlement unknown',
    );
    await expect(page.getByTestId('ops-start-blocked')).toHaveAttribute('data-block', 'settled');
    await expect(page.getByTestId('ops-start-open')).toBeDisabled();

    await page.goto(`/ops/claims/${claim.id}`);
    await expect(claimStatus(page)).toHaveAttribute('data-status-code', 'paid');
    await expectBuckets(page, [199_500, 0, 0, 500]);

    // The engine refuses a second payment even though the page has no control for it.
    const stored = await readStoredState(page);
    expect(stored).not.toBeNull();
    const refusal = applyCommand(
      stored as DemoState,
      { type: 'payout.start', obligationId: obligation.id },
      { commandId: 'ops-spec:second-start' },
    );
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) expect(refusal.code).toBe('already_settled');
  });

  test('a confirmed failure allows one controlled retry with a reason', async ({ page }) => {
    const state = buildScenarioState('payout_failed');
    const obligation = onlyObligation(state);

    await load(page, state, '/');
    await signInAs(page, 'ops_finance');
    await page.goto(`/ops/payouts/${obligation.id}`);
    await waitForHydration(page);

    await expect(page.locator('[data-attempt-status="failed"]')).toBeVisible();
    await expect(page.getByTestId('ops-start-blocked')).toHaveAttribute('data-block', 'failed');
    await expect(page.getByTestId('ops-start-open')).toBeDisabled();
    await expect(page.getByTestId('ops-reconcile')).toHaveCount(0);

    await page.getByTestId('ops-retry-open').click();
    await confirmWith(page, 'Creator confirmed the corrected account number.');

    await expect(page.locator('[data-attempt-status]')).toHaveCount(2);
    await expect(page.locator('[data-attempt-status="processing"]')).toBeVisible();
    await expect(page.getByTestId('ops-audit')).toContainText(
      'Creator confirmed the corrected account number.',
    );

    // A new attempt means a new request key, not a resend of the old one.
    const stored = await readStoredState(page);
    const keys = Object.values(stored?.payoutAttempts ?? {}).map((row) => row.requestKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('an unknown result offers reconciliation only, and settles exactly once', async ({
    page,
  }) => {
    const state = buildScenarioState('payout_unknown');
    const obligation = onlyObligation(state);
    const claim = onlyClaim(state);

    await load(page, state, '/');
    await signInAs(page, 'ops_finance');
    await page.goto(`/ops/payouts/${obligation.id}`);
    await waitForHydration(page);

    await expect(page.locator('[data-attempt-status="unknown"]')).toBeVisible();
    await expect(page.getByTestId('ops-start-blocked')).toHaveAttribute('data-block', 'unknown');
    await expect(page.getByTestId('ops-start-open')).toBeDisabled();
    await expect(page.getByTestId('ops-payout-retry')).toHaveCount(0);
    await expect(page.getByTestId('ops-reconcile')).toBeVisible();
    await expect(page.getByTestId('ops-no-pay-again')).toContainText('no pay-again control');

    // Reaching the payout by the attempt id, which is how the queue links it.
    const attemptId = Object.values(state.payoutAttempts)[0].id;
    await page.goto(`/ops/payouts/${attemptId}`);
    await expect(page.getByTestId('ops-reconcile')).toBeVisible();

    await page.getByTestId('ops-reconcile-outcome').click();
    await page.locator('[data-outcome="confirmed_succeeded"]').click();
    await page.getByTestId('ops-reconcile-open').click();
    await confirmWith(page, 'Provider statement shows the original transaction settled.');

    await expect(page.locator('[data-attempt-status]').first()).toHaveAttribute(
      'data-attempt-status',
      'succeeded',
    );
    await expect(page.getByTestId('ops-payout-settled')).toBeVisible();
    await expect(page.getByTestId('ops-reconcile')).toHaveCount(0);

    await page.goto(`/ops/claims/${claim.id}`);
    await expect(claimStatus(page)).toHaveAttribute('data-status-code', 'paid');
    await expectBuckets(page, [199_500, 0, 0, 500]);

    // Settled once: still one attempt, and the ledger moved confirmed → paid once.
    const stored = await readStoredState(page);
    expect(Object.keys(stored?.payoutAttempts ?? {})).toHaveLength(1);
    expect(
      (stored?.ledger ?? []).filter((entry) => entry.reason === 'payout_settled'),
    ).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 6 — role checks are the engine's, not the page's
// ---------------------------------------------------------------------------

test.describe('capability separation', () => {
  test('a reviewer cannot start a payout and the engine says so', async ({ page }) => {
    const state = buildScenarioState('payout_unknown');
    const obligation = onlyObligation(state);

    await load(page, state, '/');
    await signInAs(page, 'ops_reviewer');
    await page.goto(`/ops/payouts/${obligation.id}`);
    await waitForHydration(page);

    // Forbidden, labelled as a simulated check, with the engine's own code.
    await expect(page.getByTestId('ops-finance-forbidden')).toBeVisible();
    await expect(page.locator('[data-app-state="forbidden"]')).toBeVisible();
    await expect(page.getByTestId('ops-engine-denial')).toContainText('forbidden');
    await expect(page.getByTestId('ops-reconcile')).toHaveCount(0);
    await expect(page.getByTestId('ops-start-open')).toHaveCount(0);

    const before = await readStoredState(page);
    await page.getByTestId('ops-finance-probe').click();

    await expect(page.getByTestId('ops-command-error')).toBeVisible();
    await expect(page.locator('[data-error-code="forbidden"]')).toBeVisible();

    // A refused command records nothing.
    const after = await readStoredState(page);
    expect(after?.audit.length).toBe(before?.audit.length);
    expect(Object.keys(after?.payoutAttempts ?? {}).length).toBe(
      Object.keys(before?.payoutAttempts ?? {}).length,
    );
  });

  test('a creator and a merchant cannot open the operations workspace', async ({ page }) => {
    const state = claimOnMainFlow();

    await load(page, state, '/');
    await signInAs(page, 'creator');
    await page.goto('/ops');
    await expect(page.locator('[data-app-state="forbidden"]')).toBeVisible();
    await expect(page.getByTestId('ops-queue-groups')).toHaveCount(0);

    await signInAs(page, 'merchant');
    await page.goto('/ops/claims');
    await expect(page.locator('[data-app-state="forbidden"]')).toBeVisible();
    await expect(page.getByTestId('ops-claims-list')).toHaveCount(0);

    await page.goto('/ops/exceptions');
    await expect(page.locator('[data-app-state="forbidden"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 7 — unreadable sources and deadline extensions
// ---------------------------------------------------------------------------

test.describe('data availability', () => {
  test('an unreadable source keeps its last trusted value and records the re-sync', async ({
    page,
  }) => {
    const state = buildScenarioState('data_outage');
    const submission = submissionByUrl(state, DEMO_TIKTOK);

    await load(page, state, '/');
    await signInAs(page, 'ops_reviewer');
    await page.goto(`/ops/submissions/${submission.id}`);
    await waitForHydration(page);

    // Last trusted value with its time; never 0 views for a missing read.
    await expect(page.locator('[data-app-state="data-unavailable"]')).toBeVisible();
    await expect(page.locator('[data-app-state="data-unavailable"]')).toContainText('1,000');
    await expect(page.locator('[data-app-state="data-unavailable"]')).toContainText('Last trusted');
    await expect(page.getByTestId('ops-resync-outage')).toBeVisible();
    // The untrusted read is in the table as an untrusted read, not as a number.
    await expect(page.getByTestId('ops-snapshots')).toContainText('Not trusted');

    await page.getByTestId('ops-resync-open').click();
    await confirmWith(page, 'Creator reported the post is still public.');

    await expect(page.getByTestId('ops-resync-result')).toContainText('Source still unreadable');
    const audit = page.getByTestId('ops-audit');
    await expect(audit).toContainText('Re-sync requested');
    await expect(audit).toContainText('Creator reported the post is still public.');
    await expect(audit).toContainText('Ops Reviewer');

    await page.goto('/ops/exceptions');
    await expect(page.locator('[data-exception-kind="data_unavailable"]')).toBeVisible();
    await expect(page.locator('[data-exception-kind="data_unavailable"]')).toContainText(
      'Creator reported the post is still public.',
    );
  });

  test('an outage across the metering end grants the published grace again', async ({ page }) => {
    const state = buildScenarioState('deadline_extension');
    const submission = submissionByUrl(state, DEMO_TIKTOK);

    await load(page, state, '/');
    await signInAs(page, 'ops_reviewer');
    await page.goto(`/ops/submissions/${submission.id}`);
    await waitForHydration(page);

    const extensions = page.getByTestId('ops-extensions');
    await expect(extensions).toContainText('Data outage');
    await expect(extensions).not.toContainText('No extension has been granted.');

    // The effective deadline is later than the base one, and it is stated as a date.
    const stored = await readStoredState(page);
    const after = stored?.submissions[submission.id];
    expect(after?.extensions).toHaveLength(1);
    expect(after?.extensions[0].reason).toBe('data_outage');
    expect(
      new Date(after?.extensions[0].newDeadlineAt ?? 0).getTime(),
    ).toBeGreaterThan(new Date(after?.claimDeadlineAt ?? 0).getTime());

    await expect(page.getByTestId('ops-effective-deadline')).toContainText('UTC+08:00');

    await page.goto('/ops/exceptions');
    await expect(page.locator('[data-exception-kind="extension"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 8 — readiness is the publish gate
// ---------------------------------------------------------------------------

test('marking a campaign ready is what lets the merchant publish it', async ({ page }) => {
  const DRAFT = 'cmp-kopi-draft';
  const baseline = buildScenarioState('baseline');

  // Before: the engine refuses the publish for exactly this reason.
  const blocked = applyCommand(
    applyCommand(baseline, { type: 'session.switchWorkspace', workspace: 'merchant' }, {
      commandId: 'ops-spec:readiness:workspace',
    }).state,
    { type: 'campaign.publish', campaignId: DRAFT },
    { commandId: 'ops-spec:readiness:publish-blocked' },
  );
  expect(blocked.ok).toBe(false);
  if (!blocked.ok) expect(blocked.code).toBe('campaign_not_ready');

  await load(page, baseline, '/');
  await signInAs(page, 'ops_reviewer');
  await page.goto(`/ops/campaigns/${DRAFT}/readiness`);
  await waitForHydration(page);

  await expect(page.getByTestId('ops-readiness-blocking')).toHaveAttribute('data-blocked', 'true');
  await expect(page.getByTestId('ops-readiness-blocking')).toContainText(
    'Funding evidence is not confirmed.',
  );
  await expect(page.getByTestId('ops-readiness-blocking')).toContainText(
    'The data source is not confirmed.',
  );

  await page.getByTestId('ops-readiness-ready-funding').click();
  await confirmWith(page);
  await expect(page.getByTestId('ops-readiness-state-funding')).toContainText('Confirmed');

  await page.getByTestId('ops-readiness-ready-data-source').click();
  await confirmWith(page);
  await expect(page.getByTestId('ops-readiness-state-data-source')).toContainText('Confirmed');

  await expect(page.getByTestId('ops-readiness-blocking')).toHaveAttribute('data-blocked', 'false');
  await expect(page.getByTestId('ops-audit')).toContainText('Readiness set');

  // After: the same publish now succeeds, and the campaign reaches the public
  // catalogue. Publishing is the merchant's page, so it runs through the engine.
  const readied = await readStoredState(page);
  expect(readied).not.toBeNull();
  const signedIn = applyCommand(
    readied as DemoState,
    { type: 'session.signIn', userId: 'user-demo' },
    { commandId: 'ops-spec:readiness:sign-in' },
  );
  const asMerchant = applyCommand(
    signedIn.state,
    { type: 'session.switchWorkspace', workspace: 'merchant' },
    { commandId: 'ops-spec:readiness:merchant' },
  );
  const published = applyCommand(
    asMerchant.state,
    { type: 'campaign.publish', campaignId: DRAFT },
    { commandId: 'ops-spec:readiness:publish' },
  );
  expect(published.ok).toBe(true);
  const guest = applyCommand(published.state, { type: 'session.signOut' }, {
    commandId: 'ops-spec:readiness:sign-out',
  });

  await load(page, guest.state, '/campaigns');
  await expect(page.getByRole('listitem').filter({ hasText: 'Cold Brew' })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

test('the work queue filters, groups and does not scroll sideways at 320px', async ({ page }) => {
  // A queue with reviewer work, finance work and a readiness item at once.
  const state = buildScenarioState('campaign_closure');

  await load(page, state, '/');
  await signInAs(page, 'ops_reviewer');
  await page.goto('/ops');
  await waitForHydration(page);

  await expect(page.getByTestId('ops-queue-total')).toContainText('items waiting');
  await expect(page.getByTestId('ops-queue-groups')).toBeVisible();
  await expect(page.locator('[data-queue-kind="readiness"]')).toBeVisible();
  await expect(page.locator('[data-queue-kind="appeal"]')).toBeVisible();
  await expect(page.locator('[data-queue-kind="payout"]')).toBeVisible();

  // The finance tab keeps only the payout kinds.
  await page.getByTestId('ops-queue-scope').getByRole('tab', { name: 'Finance' }).click();
  await expect(page.locator('[data-queue-kind="payout"]')).toBeVisible();
  await expect(page.locator('[data-queue-kind="appeal"]')).toHaveCount(0);

  // The kind filter narrows further, through the official Select.
  await page.getByTestId('ops-queue-scope').getByRole('tab', { name: 'All' }).click();
  await page.getByTestId('ops-queue-kind').click();
  await page.getByRole('option', { name: 'Appeal', exact: true }).click();
  await expect(page.locator('[data-queue-kind="appeal"]')).toBeVisible();
  await expect(page.locator('[data-queue-kind="readiness"]')).toHaveCount(0);

  await expectNoHorizontalOverflow(page);

  /**
   * A filter that matched nothing is its own page condition: state-policy.md keeps
   * no-match and first-run-empty apart by text, and reference-contract.md's
   * filtered-no-result row asks for the filter to be kept plus a clear action.
   * Saying "nothing is waiting" while the badge above counts items would state the
   * opposite of the truth.
   */
  await page.getByTestId('ops-queue-kind').click();
  await page.getByRole('option', { name: 'Campaign readiness', exact: true }).click();
  await page.getByTestId('ops-queue-scope').getByRole('tab', { name: 'Finance' }).click();
  await expect(page.getByTestId('ops-queue-groups')).toHaveCount(0);
  await expect(page.getByTestId('ops-queue-total')).toContainText('items waiting');
  const noMatch = page.locator('[data-app-state="no-match"]');
  await expect(noMatch).toBeVisible();
  await expect(noMatch).not.toContainText('Nothing is waiting');
  await expect(page.locator('[data-app-state="empty"]')).toHaveCount(0);
  // The filters stay as they are, and clearing them is one press away.
  await expect(
    page.getByTestId('ops-queue-scope').getByRole('tab', { name: 'Finance' }),
  ).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('ops-queue-clear-filters').click();
  await expect(page.getByTestId('ops-queue-groups')).toBeVisible();

  // The 320px spot check acceptance P10 asks for, on the busiest ops page.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/ops');
  await waitForHydration(page);
  await expect(page.getByTestId('ops-queue-groups')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/**
 * The shared `i18n.spec.ts` walks the wave-1 shell pages only, and next-intl
 * reports a missing key through `console.error` instead of throwing — so an ops
 * page could quietly render a raw key path. This walks every operations page in
 * all three languages with the console under watch.
 */
for (const locale of ['en-MY', 'ms-MY', 'zh-Hans-MY'] as const) {
  test(`every operations page renders in ${locale} without a missing message`, async ({ page }) => {
    // A dozen navigations per language; one test per language keeps each inside
    // the default timeout and lets the three run in parallel.
    test.slow();

    const problems: string[] = [];
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        /MISSING_MESSAGE|INSUFFICIENT_PATH|INVALID_MESSAGE|INVALID_KEY|MISSING_FORMAT/.test(
          message.text(),
        )
      ) {
        problems.push(`${page.url()}: ${message.text()}`);
      }
    });

    // `payout_unknown` fills the queue, a submission, a confirmed claim and an
    // unknown payout; `campaign_closure` is the only preset with an appeal.
    const unknown = buildScenarioState('payout_unknown');
    const unknownClaim = onlyClaim(unknown);
    const obligation = onlyObligation(unknown);
    const submission = submissionByUrl(unknown, DEMO_TIKTOK);

    const closure = buildScenarioState('campaign_closure');
    const appeal = Object.values(closure.appeals)[0];

    const paths = [
      '/ops',
      '/ops/readiness',
      '/ops/campaigns/cmp-kopi-draft/readiness',
      '/ops/submissions',
      `/ops/submissions/${submission.id}`,
      '/ops/claims',
      `/ops/claims/${unknownClaim.id}`,
      '/ops/appeals',
      '/ops/payouts',
      `/ops/payouts/${obligation.id}`,
      '/ops/exceptions',
    ];

    await load(page, unknown, '/');
    await signInAs(page, 'ops_finance');
    await page.goto('/settings');
    await waitForHydration(page);
    await settleToasts(page);
    await setLocale(page, locale);

    for (const path of paths) {
      await page.goto(path);
      await waitForHydration(page);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expectNoHorizontalOverflow(page);
    }

    await load(page, closure, '/');
    await signInAs(page, 'ops_reviewer');
    await page.goto('/settings');
    await waitForHydration(page);
    await settleToasts(page);
    await setLocale(page, locale);
    await page.goto(`/ops/appeals/${appeal.id}`);
    await waitForHydration(page);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expectNoHorizontalOverflow(page);

    expect(problems).toEqual([]);
  });
}

// ---------------------------------------------------------------------------
// Acceptance screenshots
// ---------------------------------------------------------------------------

test('operations acceptance screenshots', async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  const shot = (name: string) =>
    captureFrame(page, {
      // Tracked under docs/m1-prototype/screenshots only with WRINGY_EVIDENCE_SHOTS=1 (evidence.ts).
      path: evidencePath(M1_EVIDENCE_DIR, `ops-${name}-${suffix}.png`),
      fullPage: false,
    });

  // Queue, exceptions: the closure scenario fills both.
  await load(page, buildScenarioState('campaign_closure'), '/');
  await signInAs(page, 'ops_reviewer');
  await page.goto('/ops');
  await waitForHydration(page);
  await shot('queue');

  await page.goto('/ops/exceptions');
  await waitForHydration(page);
  await shot('exceptions');

  const closure = buildScenarioState('campaign_closure');
  const appeal = Object.values(closure.appeals)[0];
  await page.goto(`/ops/appeals/${appeal.id}`);
  await waitForHydration(page);
  await shot('appeal');

  // Claim review with a decision still to make.
  const claimState = claimWithContentApproved();
  const claim = onlyClaim(claimState);
  await load(page, claimState, '/');
  await signInAs(page, 'ops_reviewer');
  await page.goto(`/ops/claims/${claim.id}`);
  await waitForHydration(page);
  await shot('claim-review');

  // The payout whose result is unknown: reconcile only, no pay-again.
  const unknown = buildScenarioState('payout_unknown');
  const obligation = onlyObligation(unknown);
  await load(page, unknown, '/');
  await signInAs(page, 'ops_finance');
  await page.goto(`/ops/payouts/${obligation.id}`);
  await waitForHydration(page);
  await shot('payout-unknown');
});
