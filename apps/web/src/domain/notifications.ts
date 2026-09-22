// Business event → notification recipients, deep link and simulated email.
//
// Prototype spec: "同事件通知正确角色，已读状态保持；重要邮件展示"模拟邮件预览"不发送".
// One business event reaches each role that is entitled to see it, in that role's
// own context, with that role's own link. Dedup is on (eventId, recipientUserId),
// so re-deriving the same event (e.g. a clock effect re-evaluated on every advance)
// never produces a second row.

import type {
  DemoState,
  NotificationKind,
  Role,
  User,
} from './types';

export interface NotificationContext {
  campaignId?: string;
  submissionId?: string;
  claimId?: string;
  appealId?: string;
  obligationId?: string;
  attemptId?: string;
  /** The creator whose record this is; required for creator-routed kinds. */
  creatorId?: string;
}

export type NotificationRole = Exclude<Role, 'guest'>;

export interface NotificationDraft {
  recipientUserId: string;
  recipientRole: NotificationRole;
  kind: NotificationKind;
  href: string | null;
  email: { to: string } | null;
}

interface Routing {
  creator: boolean;
  merchant: boolean;
  ops: 'ops_reviewer' | 'ops_finance' | null;
}

const NONE: Routing = { creator: false, merchant: false, ops: null };

/**
 * creator → own records; merchant → members of the campaign's org;
 * ops → reviewer for review/appeal/data items, finance for payout items.
 */
const ROUTING: Record<NotificationKind, Routing> = {
  'campaign.published': { ...NONE, merchant: true },
  'campaign.readiness_blocked': { ...NONE, merchant: true, ops: 'ops_reviewer' },
  'campaign.submissions_closed': { ...NONE, merchant: true },
  'campaign.closed': { ...NONE, merchant: true },
  'submission.accepted': { creator: true, merchant: true, ops: null },
  'submission.baseline_unavailable': { creator: true, merchant: false, ops: 'ops_reviewer' },
  'submission.data_unavailable': { creator: true, merchant: false, ops: 'ops_reviewer' },
  'submission.resynced': { creator: true, merchant: false, ops: 'ops_reviewer' },
  'content.approved': { creator: true, merchant: true, ops: null },
  'content.rejected': { creator: true, merchant: true, ops: null },
  'claim.reserved': { creator: true, merchant: true, ops: 'ops_reviewer' },
  'claim.partial_offer': { creator: true, merchant: false, ops: null },
  'claim.waitlisted': { creator: true, merchant: true, ops: null },
  'waitlist.budget_available': { creator: true, merchant: false, ops: null },
  'claim.confirmed': { creator: true, merchant: true, ops: 'ops_finance' },
  'claim.rejected': { creator: true, merchant: true, ops: 'ops_reviewer' },
  'claim.escalated': { ...NONE, ops: 'ops_reviewer' },
  'claim.rejection_finalized': { creator: true, merchant: true, ops: null },
  'metering.held': { creator: true, merchant: false, ops: 'ops_reviewer' },
  'appeal.filed': { creator: false, merchant: true, ops: 'ops_reviewer' },
  'appeal.upheld': { creator: true, merchant: true, ops: 'ops_reviewer' },
  'appeal.rejected': { creator: true, merchant: true, ops: 'ops_reviewer' },
  'payout.processing': { creator: true, merchant: false, ops: 'ops_finance' },
  'payout.paid': { creator: true, merchant: true, ops: 'ops_finance' },
  'payout.failed': { creator: true, merchant: false, ops: 'ops_finance' },
  'payout.unknown': { ...NONE, ops: 'ops_finance' },
  'payout.reconciled': { creator: true, merchant: false, ops: 'ops_finance' },
  'deadline.metering_ended': { creator: true, merchant: true, ops: null },
  'deadline.claim_deadline_extended': { creator: true, merchant: true, ops: 'ops_reviewer' },
  'deadline.claim_deadline_passed': { creator: true, merchant: false, ops: null },
};

/** Important events also render a "simulated email preview"; nothing is ever sent. */
export const EMAIL_KINDS: readonly NotificationKind[] = [
  'campaign.published',
  'submission.accepted',
  'claim.reserved',
  'claim.confirmed',
  'claim.rejected',
  'appeal.upheld',
  'appeal.rejected',
  'payout.paid',
  'payout.failed',
  'waitlist.budget_available',
  'deadline.claim_deadline_extended',
];

export function hasEmailPreview(kind: NotificationKind): boolean {
  return EMAIL_KINDS.includes(kind);
}

/** In-app deep link for one role's view of the event. */
export function hrefFor(
  role: NotificationRole,
  kind: NotificationKind,
  ctx: NotificationContext,
): string | null {
  if (role === 'creator') {
    if (kind.startsWith('payout.')) return '/creator/payments';
    if (ctx.claimId && (kind.startsWith('claim.') || kind.startsWith('appeal.') || kind === 'metering.held')) {
      return `/creator/claims/${ctx.claimId}`;
    }
    if (ctx.submissionId) return `/creator/submissions/${ctx.submissionId}`;
    if (ctx.claimId) return `/creator/claims/${ctx.claimId}`;
    return null;
  }
  if (role === 'merchant') {
    // Content decisions and metering facts live on the submission; money and queue
    // events (claims, offers, waitlist, appeals, payouts) live in the campaign view
    // next to the four budget columns.
    const contentScoped =
      kind.startsWith('submission.') || kind.startsWith('content.') || kind.startsWith('deadline.');
    if (contentScoped && ctx.submissionId) return `/merchant/submissions/${ctx.submissionId}`;
    if (ctx.campaignId) return `/merchant/campaigns/${ctx.campaignId}`;
    if (ctx.submissionId) return `/merchant/submissions/${ctx.submissionId}`;
    return null;
  }
  // ops_reviewer / ops_finance
  if (kind === 'campaign.readiness_blocked' && ctx.campaignId) {
    return `/ops/campaigns/${ctx.campaignId}/readiness`;
  }
  if (kind.startsWith('payout.') || kind === 'claim.confirmed') {
    if (ctx.attemptId) return `/ops/payouts/${ctx.attemptId}`;
    if (ctx.obligationId) return `/ops/payouts/${ctx.obligationId}`;
  }
  if (kind.startsWith('appeal.') && ctx.appealId) return `/ops/appeals/${ctx.appealId}`;
  if (ctx.claimId) return `/ops/claims/${ctx.claimId}`;
  if (ctx.submissionId) return `/ops/submissions/${ctx.submissionId}`;
  if (ctx.campaignId) return `/ops/campaigns/${ctx.campaignId}/readiness`;
  return null;
}

function orgMembers(state: DemoState, orgId: string | null): User[] {
  if (orgId === null) return [];
  return Object.values(state.users)
    .filter((user) => user.orgIds.includes(orgId))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function opsUsers(state: DemoState, capability: 'ops_reviewer' | 'ops_finance'): User[] {
  return Object.values(state.users)
    .filter((user) => user.opsCapability === capability)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Who gets told about this event, in which role context, with which link.
 *
 * types.ts makes (eventId, recipientUserId, recipientRole) unique, so one row per
 * role context. Demo User owns both the creator workspace and the Kopi Kita org, and
 * the prototype spec requires that each role sees the same record from its own side
 * ("同事件通知正确角色"), so such an event gives them a creator row AND a merchant row,
 * each with that role's own link. `selectNotificationsFor(state, userId, role)`
 * narrows to the role the UI is currently showing.
 */
export function deriveNotificationDrafts(
  state: DemoState,
  kind: NotificationKind,
  ctx: NotificationContext,
): NotificationDraft[] {
  const routing = ROUTING[kind];
  if (!routing) return [];
  const drafts: NotificationDraft[] = [];
  const email = hasEmailPreview(kind);

  const push = (user: User | undefined, role: NotificationRole) => {
    if (!user) return;
    if (drafts.some((draft) => draft.recipientUserId === user.id && draft.recipientRole === role)) {
      return;
    }
    drafts.push({
      recipientUserId: user.id,
      recipientRole: role,
      kind,
      href: hrefFor(role, kind, ctx),
      email: email ? { to: user.email } : null,
    });
  };

  if (routing.creator && ctx.creatorId) push(state.users[ctx.creatorId], 'creator');

  if (routing.merchant) {
    const campaignId = ctx.campaignId;
    const orgId = campaignId ? (state.campaigns[campaignId]?.orgId ?? null) : null;
    for (const member of orgMembers(state, orgId)) push(member, 'merchant');
  }

  if (routing.ops) {
    for (const user of opsUsers(state, routing.ops)) push(user, routing.ops);
  }

  return drafts;
}
