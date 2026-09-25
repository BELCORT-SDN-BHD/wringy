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
| any non-2xx | `apiErrorSchema` | `{ error: { code, message } }` |

`profileSchema` (`src/identity.ts`) is `{ id, displayName, contactEmail, status,
lastSignInAt, createdAt }`: `id` is the verified token subject (`sub`), never an
email; `status` is `active` or `disabled` (ruling D12). No token, refresh token,
session id or locale row is in any of these shapes.

Enumerations: profile `status` is `active` or `disabled`; campaign `status` is `draft` or `published`; `dataOrigin` is
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
| `pnpm --filter @wringy/contracts test` | Vitest: sample payloads round-trip, unknown keys are stripped, a missing field is rejected (titles carry `M2-AC01`, and `M2-AC02/2` for the identity shapes) |

No environment variables. The package ships TypeScript source.
