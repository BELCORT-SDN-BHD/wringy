// Demo permission checks.
//
// These run inside the engine, not only by hiding buttons (kickoff decision 7:
// "Permission checks run in the engine (not only by hiding buttons) and are
// labelled as demo checks, not production security"). Ticket #6 requires that a
// role without the capability cannot execute a controlled action.
//
// Separation of ops capabilities is deliberate (implementation-spec §3 admin_scopes:
// "review与finance独立，不设隐含全局通行证"):
//   ops_reviewer → claim.reviewMetering, claim.finalizeRejection, appeal.resolve, submission.resync
//   ops_finance  → payout.start, payout.reconcile, payout.retry

import type { Actor, Command, CommandType, DemoState, ErrorCode, Role } from './types';

export const GUEST_ACTOR: Actor = { userId: '', role: 'guest', orgId: null };

/**
 * Who is acting right now.
 *
 * `session.opsRole` overrides the workspace role, but only when the signed-in demo
 * user actually carries that capability (`user.opsCapability`). A stale ops role on
 * a user without the capability therefore falls back to the workspace role instead
 * of silently granting ops powers.
 */
export function resolveActor(state: DemoState): Actor {
  const userId = state.session.userId;
  if (userId === null) return GUEST_ACTOR;
  const user = state.users[userId];
  if (!user) return GUEST_ACTOR;

  const opsRole = state.session.opsRole;
  if (opsRole !== null && user.opsCapability === opsRole) {
    return { userId: user.id, role: opsRole, orgId: null };
  }

  if (state.session.workspace === 'merchant') {
    const orgId = user.orgIds[0] ?? null;
    if (orgId !== null) return { userId: user.id, role: 'merchant', orgId };
    // No org membership: the merchant workspace grants nothing.
    return { userId: user.id, role: 'creator', orgId: null };
  }

  return { userId: user.id, role: 'creator', orgId: null };
}

const CREATOR_COMMANDS: readonly CommandType[] = [
  'connection.connect',
  'connection.reconnect',
  'submission.create',
  'claim.request',
  'claim.consentPartial',
  'claim.declinePartial',
  'waitlist.resubmit',
  'appeal.file',
];

const MERCHANT_COMMANDS: readonly CommandType[] = [
  'campaign.createDraft',
  'campaign.updateDraft',
  'campaign.publish',
  'campaign.pause',
  'campaign.resume',
  'campaign.closeSubmissions',
  'campaign.close',
  'submission.reviewContent',
];

const OPS_REVIEWER_COMMANDS: readonly CommandType[] = [
  'submission.resync',
  'claim.reviewMetering',
  'claim.finalizeRejection',
  'appeal.resolve',
];

const OPS_FINANCE_COMMANDS: readonly CommandType[] = [
  'payout.start',
  'payout.reconcile',
  'payout.retry',
];

/** Commands a signed-out visitor may issue. Demo tools are listed separately. */
const GUEST_COMMANDS: readonly CommandType[] = [
  'session.signIn',
  'session.signOut',
  'session.setLocale',
  'session.dismissLocalePrompt',
];

export function isDemoCommand(type: CommandType): boolean {
  return type.startsWith('demo.');
}

export function isSessionCommand(type: CommandType): boolean {
  return type.startsWith('session.');
}

/** Commands that never produce an audit entry (session identity and read-state only). */
export function isUnauditedCommand(type: CommandType): boolean {
  return isSessionCommand(type) || type.startsWith('notification.');
}

/** The org a merchant command targets, or null when it cannot be resolved yet. */
function targetOrgId(state: DemoState, command: Command): string | null {
  switch (command.type) {
    case 'campaign.createDraft':
      return command.orgId;
    case 'campaign.updateDraft':
    case 'campaign.publish':
    case 'campaign.pause':
    case 'campaign.resume':
    case 'campaign.closeSubmissions':
    case 'campaign.close':
      return state.campaigns[command.campaignId]?.orgId ?? null;
    case 'submission.reviewContent':
      return state.submissions[command.submissionId]?.orgId ?? null;
    default:
      return null;
  }
}

export interface PermissionDenial {
  code: Extract<ErrorCode, 'forbidden' | 'not_signed_in'>;
  detail: string;
}

/**
 * Null when the actor may issue the command, otherwise the failure to return.
 * A missing target is NOT a permission failure: the handler reports `not_found`.
 */
export function checkPermission(
  actor: Actor,
  command: Command,
  state: DemoState,
): PermissionDenial | null {
  const type = command.type;

  // Demo tools are an explicitly simulated side panel; they are always available.
  if (isDemoCommand(type)) return null;

  if (actor.role === 'guest') {
    if (GUEST_COMMANDS.includes(type)) return null;
    return { code: 'not_signed_in', detail: type };
  }

  // switchWorkspace / setOpsRole need an identity that carries the target context;
  // the other session commands are always allowed once signed in.
  if (command.type === 'session.switchWorkspace') {
    if (command.workspace === 'merchant') {
      const user = state.users[actor.userId];
      if (!user || user.orgIds.length === 0) {
        return { code: 'forbidden', detail: 'no_org_membership' };
      }
    }
    return null;
  }
  if (command.type === 'session.setOpsRole') {
    if (command.role === null) return null;
    const user = state.users[actor.userId];
    if (!user || user.opsCapability !== command.role) {
      return { code: 'forbidden', detail: 'no_ops_capability' };
    }
    return null;
  }
  if (isSessionCommand(type)) return null;

  if (type.startsWith('notification.')) {
    // Any signed-in user, and only over their own notifications (handler enforces).
    return null;
  }

  if (CREATOR_COMMANDS.includes(type)) {
    if (actor.role !== 'creator') return { code: 'forbidden', detail: 'creator_workspace_required' };
    return null;
  }

  if (MERCHANT_COMMANDS.includes(type)) {
    if (actor.role !== 'merchant') {
      return { code: 'forbidden', detail: 'merchant_workspace_required' };
    }
    const orgId = targetOrgId(state, command);
    if (orgId === null) return null; // handler reports not_found
    const user = state.users[actor.userId];
    if (!user || !user.orgIds.includes(orgId)) {
      return { code: 'forbidden', detail: 'not_an_org_member' };
    }
    return null;
  }

  if (OPS_REVIEWER_COMMANDS.includes(type)) {
    if (actor.role !== 'ops_reviewer') return { code: 'forbidden', detail: 'ops_reviewer_required' };
    return null;
  }

  if (OPS_FINANCE_COMMANDS.includes(type)) {
    if (actor.role !== 'ops_finance') return { code: 'forbidden', detail: 'ops_finance_required' };
    return null;
  }

  return { code: 'forbidden', detail: 'unknown_command' };
}

export function can(actor: Actor, command: Command, state: DemoState): boolean {
  return checkPermission(actor, command, state) === null;
}

/** Role label for audit entries. */
export function actorRole(actor: Actor): Role {
  return actor.role;
}
