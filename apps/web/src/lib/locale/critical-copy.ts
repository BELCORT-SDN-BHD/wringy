/**
 * The critical-copy guard (M2-04; m2-04-code-review.md R9 rev 2; localization-v1
 * "关键文案缺译或版本不匹配时 …"): a confirmation whose explanation is missing in
 * the active language is disabled, never shown in another language.
 *
 * In this build the critical confirmations are the five membership commands —
 * change a role, remove a member, revoke an invitation, leave, accept an
 * invitation — because no money action exists before M3 (record §5). Each form
 * names every key its label, its sentence and its outcome need; M3 adds its
 * money confirmations as new key lists, not a new mechanism.
 *
 * The parity test (`src/i18n/messages.test.ts`) already fails the build on a
 * missing or empty key, so the guard cannot fire in this tree; it is proven on a
 * mutated catalogue (`critical-copy.test.ts`). Pure: the caller hands it the
 * active catalogue (`getMessages()` on the server).
 */

/** Each critical form's keys, as `<namespace>.<path>` into the full catalogue. */
export const CRITICAL_FORMS = {
  roleChange: [
    'internal.org.members.roleFor',
    'internal.org.members.changeRole',
    'internal.org.members.changeRoleFor',
    'internal.role.admin',
    'internal.role.member',
    'internal.outcomes.role_changed',
  ],
  removeMember: ['internal.org.members.remove', 'internal.org.members.removeFor', 'internal.outcomes.member_removed'],
  revokeInvitation: ['internal.org.invitations.revoke', 'internal.org.invitations.revokeFor', 'internal.outcomes.revoked'],
  leave: ['internal.org.leave.title', 'internal.org.leave.description', 'internal.org.leave.submit', 'internal.outcomes.left'],
  acceptInvitation: [
    'internal.invitations.accept.title',
    'internal.invitations.accept.description',
    'internal.invitations.accept.submit',
    'internal.invitations.fields.org',
    'internal.invitations.fields.role',
    'internal.invitations.fields.expires',
    'internal.outcomes.joined',
  ],
} as const satisfies Record<string, readonly string[]>;

export type CriticalForm = keyof typeof CRITICAL_FORMS;

/** The value at a dotted path, or undefined when any step is missing or not an object. */
function lookup(messages: unknown, key: string): unknown {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, part)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** The keys in `keys` that the catalogue lacks, or holds as anything but a non-blank string. */
export function missingCriticalKeys(messages: unknown, keys: readonly string[]): string[] {
  return keys.filter((key) => {
    const value = lookup(messages, key);
    return typeof value !== 'string' || value.trim() === '';
  });
}

/** Whether a critical form's copy is complete in the active catalogue. */
export function criticalCopyMissing(messages: unknown, form: CriticalForm): boolean {
  return missingCriticalKeys(messages, CRITICAL_FORMS[form]).length > 0;
}
