import { z } from 'zod';

import { dataOriginSchema, instantSchema } from './common';

/**
 * Organisations, memberships, capabilities and invitations on the wire (M2-03;
 * kickoff-package.md §3.1–3.4, docs/m2-internal/m2-03-code-review.md R5, R7,
 * R9, R10). Serves M2-AC03: every response schema here is the field allow-list
 * (a plain `z.object` strips unknown keys), and no member shape carries an
 * address of any kind.
 */

/** A membership's role in one org (ruling D3). Being an admin implies no capability. */
export const ORG_ROLES = ['admin', 'member'] as const;
export const orgRoleSchema = z.enum(ORG_ROLES);
export type OrgRole = z.output<typeof orgRoleSchema>;

/** `removed` rows stay: the history of who belonged, and who removed them, is kept. */
export const MEMBERSHIP_STATUSES = ['active', 'removed'] as const;
export const membershipStatusSchema = z.enum(MEMBERSHIP_STATUSES);
export type MembershipStatus = z.output<typeof membershipStatusSchema>;

/**
 * Why a membership exists: the org's creator (`org_created`) or an accepted
 * invitation. "加入已有组织必须有授权授予记录" (M2-AC03/1): there is no third way in.
 */
export const MEMBERSHIP_GRANT_BASES = ['org_created', 'invitation'] as const;
export const membershipGrantBasisSchema = z.enum(MEMBERSHIP_GRANT_BASES);
export type MembershipGrantBasis = z.output<typeof membershipGrantBasisSchema>;

/**
 * Org-scoped capabilities, granted only by `pnpm db:grant` (ruling D4). Review
 * and finance are independent: holding one gives nothing of the other, and
 * neither implies membership (M2-AC03/3).
 */
export const ORG_CAPABILITIES = ['review', 'finance'] as const;
export const orgCapabilitySchema = z.enum(ORG_CAPABILITIES);
export type OrgCapability = z.output<typeof orgCapabilitySchema>;

/** Platform capabilities, granted only by `pnpm db:grant`; M2-08 puts the first action behind one. */
export const PLATFORM_CAPABILITIES = ['ops_runtime'] as const;
export const platformCapabilitySchema = z.enum(PLATFORM_CAPABILITIES);
export type PlatformCapability = z.output<typeof platformCapabilitySchema>;

/** An invitation's stored state. `expired` is not stored: it is `pending` past `expiresAt`. */
export const INVITATION_STATUSES = ['pending', 'accepted', 'revoked'] as const;
export const invitationStatusSchema = z.enum(INVITATION_STATUSES);
export type InvitationStatus = z.output<typeof invitationStatusSchema>;

/**
 * How long an invitation link stays acceptable, in days. kickoff-package.md
 * §9.1 ruling D2: "single-use link; expiry 7 days". This is the one canonical
 * home of the number: the API binds it into `make_interval(days => $n)` and the
 * web copy interpolates it; nothing else may restate it.
 */
export const INVITATION_LIFETIME_DAYS = 7;

/**
 * Unicode control characters (C0, DEL, C1) and the bidirectional formatting
 * characters that can make a name read differently from what it is: LRM, RLM
 * (U+200E, U+200F), the embeddings and overrides (U+202A–U+202E) and the
 * isolates (U+2066–U+2069).
 */
const UNSAFE_NAME_CHARACTERS = /[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;

/**
 * An organisation's name, for create and rename alike (R9): trimmed, composed
 * to NFC, 1–100 characters after trimming, and free of control and bidi-format
 * characters. The output is what is stored.
 */
export const orgNameSchema = z
  .string()
  .trim()
  .normalize('NFC')
  .min(1)
  .max(100)
  .refine((name) => !UNSAFE_NAME_CHARACTERS.test(name), {
    message: 'Name contains a control or bidirectional formatting character',
  });

/**
 * An invitation token as it travels: base64url of 32 random bytes, 43
 * characters, no padding (R7). Only its sha256 is stored. It is only ever sent
 * in a POST body, never in an API path (the request log writes paths).
 */
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

// --- Params (every org route is scoped by its path, R5) ----------------------

/**
 * A uuid path segment in its one canonical spelling, lower case (R5 rev 3).
 * `z.uuid()` accepts either case and keeps what it was given, while PostgreSQL
 * compares uuid columns case-blind: an upper-cased own id then passed the
 * `member.self` string comparison, and `audit_log.target_id` (text) kept the id
 * as the caller spelled it, so an exact-match query missed those rows. The
 * lower-casing is an overwrite, not a transform: the output stays a plain
 * string and the schema stays representable as JSON Schema.
 */
const pathUuidSchema = z.uuid().toLowerCase();

export const orgParamsSchema = z.object({
  orgId: pathUuidSchema,
});
export type OrgParams = z.output<typeof orgParamsSchema>;

export const orgMemberParamsSchema = z.object({
  orgId: pathUuidSchema,
  userId: pathUuidSchema,
});
export type OrgMemberParams = z.output<typeof orgMemberParamsSchema>;

export const orgInvitationParamsSchema = z.object({
  orgId: pathUuidSchema,
  invitationId: pathUuidSchema,
});
export type OrgInvitationParams = z.output<typeof orgInvitationParamsSchema>;

// --- Bodies (plain z.object, never strict: a body `orgId` is stripped, R5) ----

/** `POST /orgs`. */
export const createOrgBodySchema = z.object({
  name: orgNameSchema,
});
export type CreateOrgBody = z.output<typeof createOrgBodySchema>;

/** `POST /orgs/:orgId/rename`. */
export const renameOrgBodySchema = z.object({
  name: orgNameSchema,
});
export type RenameOrgBody = z.output<typeof renameOrgBodySchema>;

/**
 * `POST /orgs/:orgId/invitations`. The address is bounded here and normalised
 * by the API with the allow-list's `normalizeEmail`; an address it refuses is a
 * 400 from the route (R7).
 */
export const createInvitationBodySchema = z.object({
  email: z.string().min(1).max(320),
  role: orgRoleSchema,
});
export type CreateInvitationBody = z.output<typeof createInvitationBodySchema>;

/** `POST /invitations/preview` and `POST /invitations/accept`. */
export const invitationTokenBodySchema = z.object({
  token: invitationTokenSchema,
});
export type InvitationTokenBody = z.output<typeof invitationTokenBodySchema>;

/** `POST /orgs/:orgId/members/:userId/role`. */
export const changeRoleBodySchema = z.object({
  role: orgRoleSchema,
});
export type ChangeRoleBody = z.output<typeof changeRoleBodySchema>;

// --- Responses (the allow-lists) ---------------------------------------------

/**
 * `GET /me/workspaces` (R10): the personal context, one row per active
 * membership (ordered by org name), and the capability grants the caller holds.
 * Holding a grant is not membership: an org grant can name an org absent from
 * `orgs`.
 */
export const workspacesResponseSchema = z.object({
  personal: z.object({
    userId: z.uuid(),
  }),
  orgs: z.array(
    z.object({
      orgId: z.uuid(),
      name: z.string().min(1),
      role: orgRoleSchema,
      dataOrigin: dataOriginSchema,
    }),
  ),
  grants: z.object({
    org: z.array(
      z.object({
        orgId: z.uuid(),
        capability: orgCapabilitySchema,
      }),
    ),
    platform: z.array(platformCapabilitySchema),
  }),
});
export type WorkspacesResponse = z.output<typeof workspacesResponseSchema>;

/** An org as every org response names it. */
export const orgSummarySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  dataOrigin: dataOriginSchema,
  createdAt: instantSchema,
});
export type OrgSummary = z.output<typeof orgSummarySchema>;

/** One membership row, as the commands that change it answer. */
export const membershipSchema = z.object({
  orgId: z.uuid(),
  userId: z.uuid(),
  role: orgRoleSchema,
  status: membershipStatusSchema,
  grantBasis: membershipGrantBasisSchema,
  grantedAt: instantSchema,
});
export type Membership = z.output<typeof membershipSchema>;

/**
 * A member as the org page lists them. No address of any kind: a member's
 * `contact_email` is for notifications only and is never shown to other
 * members or admins (M2-AC03/3).
 */
export const orgMemberSchema = z.object({
  userId: z.uuid(),
  displayName: z.string().nullable(),
  role: orgRoleSchema,
  grantedAt: instantSchema,
});
export type OrgMember = z.output<typeof orgMemberSchema>;

/** A pending invitation, as its admin sees it. Never the token, never its hash. */
export const pendingInvitationSchema = z.object({
  id: z.uuid(),
  inviteeEmailNorm: z.string().min(1),
  role: orgRoleSchema,
  expiresAt: instantSchema,
  createdAt: instantSchema,
});
export type PendingInvitation = z.output<typeof pendingInvitationSchema>;

/**
 * `GET /orgs/:orgId`: the org, the caller's own id and role, the active
 * members. `self.userId` is what lets the org page leave the caller's own row
 * without a remove or role form, from this one read (R9 rev 3; it used to take a
 * second read of `GET /me/workspaces`, whose failure hid an org page whose own
 * read had succeeded). `invitations` is present only when the caller is an
 * admin; a member's answer carries no such key at all.
 */
export const orgDetailResponseSchema = z.object({
  org: orgSummarySchema,
  self: z.object({
    userId: z.uuid(),
    role: orgRoleSchema,
  }),
  members: z.array(orgMemberSchema),
  invitations: z.array(pendingInvitationSchema).optional(),
});
export type OrgDetailResponse = z.output<typeof orgDetailResponseSchema>;

/** `POST /orgs` (201): the new org and the creator's admin membership (`org_created`). */
export const createOrgResponseSchema = z.object({
  org: orgSummarySchema,
  membership: membershipSchema,
});
export type CreateOrgResponse = z.output<typeof createOrgResponseSchema>;

/** `POST /orgs/:orgId/rename`. */
export const renameOrgResponseSchema = z.object({
  org: orgSummarySchema,
});
export type RenameOrgResponse = z.output<typeof renameOrgResponseSchema>;

/**
 * `POST /orgs/:orgId/invitations` (201). `token` is returned here once and
 * never again: the database keeps only its sha256 (R7).
 */
export const createInvitationResponseSchema = z.object({
  invitation: pendingInvitationSchema,
  token: invitationTokenSchema,
});
export type CreateInvitationResponse = z.output<typeof createInvitationResponseSchema>;

/** `POST /orgs/:orgId/invitations/:invitationId/revoke`. */
export const revokeInvitationResponseSchema = z.object({
  invitation: z.object({
    id: z.uuid(),
    status: invitationStatusSchema,
  }),
});
export type RevokeInvitationResponse = z.output<typeof revokeInvitationResponseSchema>;

/**
 * `POST /invitations/preview`. The address is checked first: to anybody but the
 * addressed person the answer is `{ state: 'email_mismatch' }` and nothing else
 * (no org, role or expiry). The addressed person sees the org, the role, the
 * expiry and whether the link is still `pending`, has `expired` or was
 * `accepted`. An unknown or revoked token is a 403, not a state.
 */
export const INVITATION_PREVIEW_STATES = ['pending', 'expired', 'accepted'] as const;
export const invitationPreviewResponseSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('email_mismatch'),
  }),
  z.object({
    state: z.enum(INVITATION_PREVIEW_STATES),
    org: z.object({
      id: z.uuid(),
      name: z.string().min(1),
    }),
    role: orgRoleSchema,
    expiresAt: instantSchema,
  }),
]);
export type InvitationPreviewResponse = z.output<typeof invitationPreviewResponseSchema>;

/** `POST /invitations/accept`: the org joined and the membership written. */
export const acceptInvitationResponseSchema = z.object({
  org: orgSummarySchema,
  membership: membershipSchema,
});
export type AcceptInvitationResponse = z.output<typeof acceptInvitationResponseSchema>;

/** `POST /orgs/:orgId/members/:userId/role`. */
export const changeRoleResponseSchema = z.object({
  membership: membershipSchema,
});
export type ChangeRoleResponse = z.output<typeof changeRoleResponseSchema>;

/** `POST /orgs/:orgId/members/:userId/remove`: the membership, now `removed`. */
export const removeMemberResponseSchema = z.object({
  membership: membershipSchema,
});
export type RemoveMemberResponse = z.output<typeof removeMemberResponseSchema>;

/** `POST /orgs/:orgId/leave`: the caller's membership, now `removed`. */
export const leaveOrgResponseSchema = z.object({
  membership: membershipSchema,
});
export type LeaveOrgResponse = z.output<typeof leaveOrgResponseSchema>;
