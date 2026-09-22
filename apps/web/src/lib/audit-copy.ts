/**
 * One readable label per command type, for every timeline that renders the
 * engine's audit rows.
 *
 * Before this existed, the ops timelines had their own map under
 * `ops.auditActions` and the merchant and creator timelines rendered
 * `entry.action` raw — so the same event read "Metering review decided" on one
 * page and `claim.reviewMetering` on another. The audit trail is the record a
 * merchant, a creator and operations are all supposed to be able to read, so it
 * gets one vocabulary.
 *
 * The map is `Record<CommandType, …>` and not `Partial<…>`: adding a command to
 * `types.ts` without copy for it is a type error here, which is the only way to
 * stop a raw command code reaching a page again.
 *
 * Keys live under `common.actions.<command type with the dot replaced by an
 * underscore>` because next-intl reads a `.` in a key as nesting, and a lookup
 * that misses logs `MISSING_MESSAGE` to the console — which `i18n.spec.ts` fails
 * the run on.
 */

import type { CommandType } from '@/domain/types';

/** Command type → key suffix under `common.actions`. */
const AUDIT_ACTION_KEY: Record<CommandType, string> = {
  'session.signIn': 'session_signIn',
  'session.signOut': 'session_signOut',
  'session.setLocale': 'session_setLocale',
  'session.dismissLocalePrompt': 'session_dismissLocalePrompt',
  'session.switchWorkspace': 'session_switchWorkspace',
  'session.setOpsRole': 'session_setOpsRole',

  'demo.advanceClock': 'demo_advanceClock',
  'demo.setClock': 'demo_setClock',
  'demo.addQualifiedViews': 'demo_addQualifiedViews',
  'demo.setDataOutage': 'demo_setDataOutage',
  'demo.setReadiness': 'demo_setReadiness',
  'demo.setPayoutOutcome': 'demo_setPayoutOutcome',
  'demo.loadScenario': 'demo_loadScenario',
  'demo.reset': 'demo_reset',

  'campaign.createDraft': 'campaign_createDraft',
  'campaign.updateDraft': 'campaign_updateDraft',
  'campaign.publish': 'campaign_publish',
  'campaign.pause': 'campaign_pause',
  'campaign.resume': 'campaign_resume',
  'campaign.closeSubmissions': 'campaign_closeSubmissions',
  'campaign.close': 'campaign_close',
  'submission.reviewContent': 'submission_reviewContent',

  'connection.connect': 'connection_connect',
  'connection.reconnect': 'connection_reconnect',
  'submission.create': 'submission_create',
  'claim.request': 'claim_request',
  'claim.consentPartial': 'claim_consentPartial',
  'claim.declinePartial': 'claim_declinePartial',
  'waitlist.resubmit': 'waitlist_resubmit',
  'appeal.file': 'appeal_file',

  'submission.resync': 'submission_resync',
  'claim.reviewMetering': 'claim_reviewMetering',
  'claim.finalizeRejection': 'claim_finalizeRejection',
  'appeal.resolve': 'appeal_resolve',

  'payout.start': 'payout_start',
  'payout.reconcile': 'payout_reconcile',
  'payout.retry': 'payout_retry',

  'notification.markRead': 'notification_markRead',
  'notification.markAllRead': 'notification_markAllRead',
};

/**
 * The key under `common.actions` for an audit row's action.
 *
 * `AuditEntry.action` is typed `string`, not `CommandType`, because a persisted
 * state written by an older build can carry a command this build no longer has.
 * Such a row falls back to the generic label rather than rendering its code.
 */
export function auditActionKey(action: string): string {
  return AUDIT_ACTION_KEY[action as CommandType] ?? 'other';
}

/**
 * The label for an audit row's action.
 *
 * `translate` is the caller's `useTranslations('common.actions')`, passed in so
 * this module stays free of React and can be unit-tested against the catalogue.
 */
export function formatAuditAction(action: string, translate: (key: string) => string): string {
  return translate(auditActionKey(action));
}

/** Every key this module can ask for, so a test can check the catalogue covers it. */
export const AUDIT_ACTION_KEYS: readonly string[] = [
  ...new Set(Object.values(AUDIT_ACTION_KEY)),
  'other',
];
