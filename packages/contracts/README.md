# @wringy/contracts

The wire contract between the web server and the Fastify API: zod 4 schemas and
the TypeScript types inferred from them (kickoff-package.md §8.1, §8.3).

| Route | Response schema | Shape |
|---|---|---|
| `GET /health/live` | `healthLiveResponseSchema` | `{ status: 'ok' }`; no database |
| `GET /health` | `healthResponseSchema` | `{ status: 'ok' \| 'unavailable', checks: { database, migrations, queueSchema }, migrationHead, queueSchemaVersion, dbNow }`; 200 or 503 |
| `GET /internal/campaigns` | `internalCampaignsResponseSchema` | `{ items: [{ id, title, status, orgName, dataOrigin, updatedAt }], dataAsOf }` |
| `GET /internal/worker-health` | `workerHealthResponseSchema` | `{ workers: [{ workerId, startedAt, lastBeatAt, lastQueueRoundTripAt, imageRef, state }], dbNow }` |
| `POST /identity/sign-in` | `signInResponseSchema` | `{ profile }` (M2-02) |
| `GET /me` | `meResponseSchema` | `{ profile, session: { expiresAt } }` (M2-02) |
| `POST /me/session/probe` | `sessionProbeResponseSchema` | `{ ok: true, checkedAt }`: the reserved fund-sensitive stub that proves the session-liveness guard; it changes nothing (M2-02) |
| `GET /me/workspaces` | `workspacesResponseSchema` | `{ personal: { userId }, orgs: [{ orgId, name, role, dataOrigin }], grants: { org: [{ orgId, capability }], platform: [capability] } }` (M2-03) |
| `POST /orgs` | `createOrgResponseSchema` | 201 `{ org, membership }`: the creator's `org_created` admin membership (M2-03) |
| `GET /orgs/:orgId` | `orgDetailResponseSchema` | `{ org, self: { role }, members: [{ userId, displayName, role, grantedAt }], invitations? }`; `invitations` only for an admin (M2-03) |
| `POST /orgs/:orgId/rename` | `renameOrgResponseSchema` | `{ org }` (M2-03) |
| `POST /orgs/:orgId/invitations` | `createInvitationResponseSchema` | 201 `{ invitation: { id, inviteeEmailNorm, role, expiresAt, createdAt }, token }`; the token is answered once (M2-03) |
| `POST /orgs/:orgId/invitations/:invitationId/revoke` | `revokeInvitationResponseSchema` | `{ invitation: { id, status } }` (M2-03) |
| `POST /invitations/preview` | `invitationPreviewResponseSchema` | For the addressed person only: `{ state: 'pending' \| 'expired' \| 'accepted', org: { id, name }, role, expiresAt }`; anybody else is refused 403 `invitation.email_mismatch` (M2-03) |
| `POST /invitations/accept` | `acceptInvitationResponseSchema` | `{ org, membership }` (M2-03) |
| `POST /orgs/:orgId/members/:userId/role` | `changeRoleResponseSchema` | `{ membership }` (M2-03) |
| `POST /orgs/:orgId/members/:userId/remove` | `removeMemberResponseSchema` | `{ membership }`, now `removed` (M2-03) |
| `POST /orgs/:orgId/leave` | `leaveOrgResponseSchema` | `{ membership }`, now `removed` (M2-03) |
| any non-2xx | `apiErrorSchema` | `{ error: { code, message } }` |

### Params and bodies (M2-03, `src/orgs.ts`)

The first request schemas: until M2-03 no route declared `params` or `body`. A
failure is a 400 `bad_request` from the API's global handler, before any route
code runs.

| Schema | Shape |
|---|---|
| `orgParamsSchema`, `orgMemberParamsSchema`, `orgInvitationParamsSchema` | `{ orgId }`, `{ orgId, userId }`, `{ orgId, invitationId }`, each a UUID, lower-cased on the way in so an id has one spelling (an upper-cased own id is still "self", and `audit_log.target_id` is always canonical): every org route is scoped by its path |
| `createOrgBodySchema`, `renameOrgBodySchema` | `{ name }`, both through `orgNameSchema`: trimmed, NFC-composed, 1–100 characters, no control or bidi-format characters |
| `createInvitationBodySchema` | `{ email (1–320 characters; the API normalises it), role }` |
| `invitationTokenBodySchema` | `{ token }`: 43 base64url characters (32 random bytes); only ever a body, never a path |
| `changeRoleBodySchema` | `{ role }` |

Bodies are plain `z.object`s too, never strict: an unknown key such as a body
`orgId` is stripped, so the path alone decides which org a command touches.
`INVITATION_LIFETIME_DAYS` (7, ruling D2) lives here once; the API binds it and the
web copy interpolates it.

`profileSchema` (`src/identity.ts`) is `{ id, displayName, contactEmail, status,
lastSignInAt, createdAt }`: `id` is the verified token subject (`sub`), never an
email; `status` is `active` or `disabled` (ruling D12). No token, refresh token,
session id or locale row is in any of these shapes. No member shape of
`src/orgs.ts` carries an address of any kind; the only address on the wire is a
pending invitation's `inviteeEmailNorm`, shown to that org's admins.

Enumerations: org `role` is `admin` or `member`; membership `status` is `active` or
`removed`, `grantBasis` is `org_created` or `invitation`; invitation `status` is
`pending`, `accepted` or `revoked`; org capabilities are `review` and `finance`, the
platform capability is `ops_runtime`; profile `status` is `active` or `disabled`; campaign `status` is `draft` or `published`; `dataOrigin` is
`fixture` or `live` (the database column is `data_origin`); worker `state` is
`healthy`, `stale`, `never_seen` (shown as "unknown") or `stopped`. Instants are
ISO 8601 with an offset; ids are UUIDs.

## Rules

- **The response schema is the allow-list.** Every schema is a plain `z.object`,
  which strips unknown keys, so a field not named here never leaves the API. Never
  use `z.looseObject` or `.passthrough()` in a response schema.
- No money and no rule values in M2-01 responses: titles, statuses and health only.
- Depends on `zod` only; `pnpm depcruise` rejects imports of db, pg, fastify,
  next, react or apps.

## Scripts

| Script | Does |
|---|---|
| `pnpm --filter @wringy/contracts lint` | ESLint (typescript-eslint recommended) |
| `pnpm --filter @wringy/contracts typecheck` | `tsc --noEmit` against `tsconfig.base.json` |
| `pnpm --filter @wringy/contracts test` | Vitest: sample payloads round-trip, unknown keys are stripped, a missing field is rejected (titles carry `M2-AC01`, `M2-AC02/2` for the identity shapes and `M2-AC03/n` for the org shapes, the org name and the invitation token) |

No environment variables. The package ships TypeScript source.
