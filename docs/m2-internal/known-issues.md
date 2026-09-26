# M2 internal build (M2-01, M2-02) — known issues and limitations

What the internal build does not do, what it does in a way a reviewer should know about, and
what is left unverified. The M2-01 sections are as recorded then; the
[M2-02 section](#m2-02-identity-sessions-and-sign-in) is added by that ticket and is where the
identity limitations now live. **Nothing here changes a business rule.** M2-01 adds no business value
anywhere: the fixture campaigns carry a title, a status and a data origin only
(`packages/db/src/fixtures.ts` L14; `packages/db/migrations/0003_orgs_campaigns.sql` L32–L44), and
[campaign-defaults-v1](../../phase-0/foundation/campaign-defaults-v1.md) stays the only source of
business defaults.

Recorded 2026-09-23 against branch `feat/m2-01` (HEAD `fe17df4`, pushed; CI green on `9ca00a5`, `12a85ab`
and `fe17df4`), after the W5 adversarial review. The 23 defects that review confirmed
were fixed and none was skipped ([acceptance-record.md](acceptance-record.md) "W5 adversarial
review"). What is recorded here is what M2-01 deliberately does not do, what it inherits, and what it
cannot prove on this machine or in CI.

## Internal build only, by design (not defects)

These follow from the M2-01 scope ([m2-01.md](../planning/tickets/m2-01.md), kickoff-package.md §8.3
and §8.11). Each is listed because a reviewer could otherwise take it for a capability.

- **No identity — closed by M2-02.** As recorded for M2-01 there was no sign-in: the `authenticate`
  hook was a no-op and `/internal` was open to anyone who could reach the web server. M2-02 replaced
  that: `authenticateNoop` is deleted, `buildApp` requires a real hook, every route but `/health` and
  `/health/live` verifies a Supabase access token, and `/internal` is behind sign-in through
  `proxy.ts` (R8, R12; `apps/api/README.md` "Authentication"). Authorisation arrives in two steps:
  M2-03 makes every org-scoped route re-read the caller's membership or grant from PostgreSQL on
  each request (see the M2-03 section below); the M2-01 sections of `/internal` (the fixture
  campaign list and the worker health) stay visible to any signed-in tester until M2-08, whose
  M2-AC08/3 ("普通用户看不到运行告警") gates the runtime view behind the `ops_runtime` grant.
  See the M2-02 section below. The API image still listens on `0.0.0.0`
  when `HOST` says so (`apps/api/README.md`); nothing is deployed yet.
- **No writes.** The API serves GET routes only, and its database login holds SELECT and nothing
  else (`packages/db/test/grant-manifest.ts` L55). The only writers are the worker (its heartbeat
  and pg-boss's own tables) and the migrator (schema, environment marker, fixture seed).
- **No live data.** The page shows fixture rows seeded by `pnpm db:seed:fixtures`. A database marked
  production refuses fixture rows (migration 0002), cannot be marked production while it holds any
  (`37a7c2d`; since `2e84a7a` the check and the marker update are serialised with fixture writes
  by a SHARE lock, `packages/db/README.md` "Local run"), and no row's origin can change (0007).
  There is no live data source and no live adapter.
- **Fixture content is demonstration content.** The three campaign titles and two org names are
  placeholders, not customers, and carry no amounts, dates or rules.
- **No Supabase, no Render.** Locally the database is embedded PostgreSQL 17; in CI it is a
  `postgres:17` service. Nothing has run against Supabase or Render
  (`packages/db/README.md` "Supabase (unverified)", L157). The external accounts are the founder's
  step (D15–D18), with the checklist on
  [#21](https://github.com/BELCORT-SDN-BHD/wringy/issues/21#issuecomment-5783628106).
- **No deployment and no release gate.** The images are built with `push: false`; there is no
  GitHub environment and no deploy workflow (ruling D24; kickoff-package.md §10 G9). M2 has no
  production deployment (M2-AC09/3).
- **The M1 demo is untouched.** It keeps its own `(demo)` root layout and its browser store;
  M2-01 does not touch the store (kickoff-package.md §8.6), and the whole M1 suite still passes
  (327 passed, 33 skipped in CI on `9ca00a5`).

## Accepted limitations

- **A 404's raw HTML is Next's error shell.** With two root layouts and no top-level layout, the two
  catch-alls call `notFound()`, which Next renders as `<html id="__next_error__">` whose flight data
  carries the right root layout: the browser shows `lang`, the CSS and the banner, a `curl` of the raw
  HTML does not (`apps/web/README.md` L50–L61). `global-not-found.js` would render on the server but
  is experimental in this Next version and cannot tell the two layouts apart. Accepted by the M2-01
  orchestrator; the internal suite checks the rendered page.
- **The demo catch-all's comment overstates what `next start` does.** Under `next start` an unknown
  URL (and `/internal` once the internal entry is removed) answers 404 with Next's error document and
  the prototype's `<title>`, while `src/app/(demo)/[...notFound]/page.tsx` says the 404 renders inside
  the demo root layout. Observed in the recovery rehearsal; `next dev` not checked
  ([acceptance-record.md](acceptance-record.md) "Recovery").
- **SIGTERM tests skip on Windows.** Windows has no POSIX signals, so `child.kill('SIGTERM')` is a
  forced kill there. The api's SIGTERM test is skipped on win32
  (`apps/api/tests/integration/startup.int.test.ts` L133), and the worker test uses its IPC
  `shutdown` message instead (`apps/worker/test/process.int.test.ts` L60–L61;
  `apps/worker/README.md` L104). Linux CI runs the real signal: on `9ca00a5` apps/api test:int ran 26
  tests with none skipped. Locally the count reads "28 passed, 1 skipped".
- **Embedded PostgreSQL and deep paths on Windows.** The Windows binaries load their DLLs from about
  120 characters below the repository root; in a clone whose deepest DLL path reached 278
  characters, `initdb` could not start (0xC0000135). The 260-character path limit is the likely cause
  (inferred, not confirmed). Keep the checkout path short, or point `TEST_DATABASE_URL` at another
  PostgreSQL 17 (`packages/db/README.md` L148–L155).
- **Chromium's empty screenshot.** Chromium sometimes answers `Page.captureScreenshot` with "Unable
  to capture screenshot" (an empty surface copy). Evidence frames retry that one error, at most 3
  attempts, after two animation frames; any other capture error fails the test at once
  (`apps/web/README.md` L275–L278; `tests/unit/capture-retry.test.ts`). The cause inside Chromium is
  not fixed here.
- **Four page states have no end-to-end test.** Of the `/internal` page's `data-app-state` values,
  the Playwright suite renders `api-unreachable` and `api-unavailable`, and only asserts that `empty`
  and `no-workers` are absent during an outage. `unexpected` is covered at the unit level only
  (`apps/web/src/app/(internal)/internal/api-read.test.ts` L57); `not-configured` is rendered only by
  the CI images smoke (`.github/workflows/app.yml` L221); `empty` (no fixture campaigns) and
  `no-workers` (no worker has reported) are rendered by no test. None of the four arises on the stack
  the suite starts (a seeded database, a running worker, a configured API address).
- **Malay and Chinese internal copy are drafts.** `apps/web/src/messages/{ms-MY,zh-Hans-MY}/internal.json`
  were written with the page (`306892a`); key parity across the three locales is enforced
  (`apps/web/src/i18n/messages.test.ts`); no review of the wording by a native speaker is recorded, as for M1
  ([M1 known issues](../m1-prototype/known-issues.md) "Language").
- **`pnpm dev` on Windows needed another watcher.** `tsx watch`, started by `pnpm -r --parallel run
  dev`, printed nothing on Windows (0 lines in 12 s). The api and worker `dev` scripts now run
  `node --watch --import tsx` (`2be5188`), and `pnpm dev` printed 7 api, 7 worker and 7 web lines in
  25 s. The cause below `pnpm run` is not established; Node's watcher sometimes restarts once at
  start-up on a "Change detected" in `node_modules`, which is harmless (root `README.md` L60). No
  automated test covers it.
- **The M1 suite can time out on a large Turbopack cache.** At 4.4 GB, `apps/web/.next/dev` coincided
  with 155 navigation timeouts while another project's Playwright suite ran on the same machine;
  with the cache deleted the suite passed (`apps/web/README.md` L81–L90). The cause of two smaller
  runs of timeouts (13 and 15) is not established beyond machine load.
- **A database migrated before 0006 must be migrated again.** Run `pnpm db:migrate` on it (for
  example a local `pnpm db:start` cluster) to get 0006 and 0007; `installPgBossSchema()` refuses to
  run the pg-boss CLI while a queue row breaks the 0006 rule (`packages/db/README.md` L105–L109).
- **API integration tests use a committed clone per file, not a rolled-back transaction per test.**
  A deviation from kickoff-package.md §6.3, recorded in `apps/api/README.md` and in the record's
  "Deviations" table: the app reads through its own pool, which cannot see another connection's
  uncommitted transaction.
- **One worker per environment is assumed for the queue round trip.** pg-boss creates one
  `system.heartbeat` job per minute for the whole cluster (`apps/worker/src/jobs/heartbeat.ts`
  L8–L10, L24; `apps/worker/src/worker.ts` L236). Only the worker that takes the job stamps its own
  `last_queue_round_trip_at` (`roundTripStatement`, `apps/worker/src/jobs/heartbeat.ts` L63–L70).
  With several workers, the others' round trips age, and the API reads them as `overdue` after
  3 minutes (`QUEUE_OVERDUE_AFTER_MS`, `packages/db/src/heartbeat.ts` L27;
  `computeQueueState`, `apps/api/src/worker-state.ts` L52–L56), although their queue path works.
  Raised in review of PR #82 and judged outside M2-01's scope, which runs one worker per
  environment. M2-09 (multi-instance) must revisit `queueState`: judge it per cluster, or schedule
  a job per worker.
- **Restarting a worker with the same `WORKER_ID` can briefly show it as stopped.** Both processes
  write one row. If the old process is still draining when the new one has beaten, the old
  process's graceful stop sets `stopped_at = now()` on that row (`stoppedStatement`,
  `apps/worker/src/jobs/heartbeat.ts` L77–L82), which is at or after the new process's
  `last_beat_at`. The API then reports `stopped` (`computeWorkerState`,
  `apps/api/src/worker-state.ts` L38) until the new process's next beat clears `stopped_at`
  (`beatStatement`, `apps/worker/src/jobs/heartbeat.ts` L45–L48). That takes at most one beat
  interval, 15 s (`HEARTBEAT_INTERVAL_MS`, `packages/db/src/heartbeat.ts` L14). Raised in review
  of PR #82 and judged outside M2-01's scope, which runs one worker per environment.

## M2-02: identity, sessions and sign-in

Recorded 2026-09-26 against branch `feat/m2-02`, after the W5 adversarial review, and extended in W6
with what the two independent reviews of the integrated tree left accepted (the `__Host-` prefix, the
refresh deadline, the NFC allow-list key). These are the limitations M2-02 accepts, each with the
ruling or the reason it is accepted under.

- **A session cookie lives 400 days, whatever Wringy asks for (D14).** `@supabase/ssr` overrides
  the `maxAge` of every cookie it writes with its own fixed 400 days
  (`{...DEFAULT, ...cookieOptions, maxAge: DEFAULT.maxAge}`), so `sessionCookieOptions`
  deliberately sets none — naming it would look like a control that does not exist
  (`apps/web/src/lib/auth/supabase-server.ts`). Accepted under ruling D14, which takes Supabase's
  defaults for M2 and has no inactivity time-box. What actually bounds a session is the access
  token's own 1-hour `exp` and the liveness check on every command (§4.6): a signed-out or revoked
  session is refused on the next write, not 400 days later. The same override applies to the PKCE
  verifier cookies, which is why `proxy.ts` decides "this browser had a session" from the session
  cookie's own name and never from the `sb-` prefix.
- **A recycled Google address inherits an allow-listed tester's access (R16, §3.7).** Identity is
  the verified `sub`, and the allow-list is checked once, at first sign-in. If a workspace address
  is deleted and given to somebody else, that person signs in as a new `sub` and passes the gate
  while the address is still listed. Accepted for M2: in this build passing the allow-list *is* the
  authorisation decision, and the exposure is an internal build holding fixture data only. The
  mitigation is the operator removing the address (`pnpm db:allowlist remove`) and disabling the
  profile (`app.profiles.status`), which does sign that person out on the next request. M2-03's
  membership work is where it must be closed.
- **A JWKS key set that is fetched but names no matching key is the token's fault (R9).** jose
  raises `ERR_JWKS_NO_MATCHING_KEY` both for a token naming a key the project does not publish
  (the token's fault, 401) and, more rarely, for a project-side state: a key set served empty, or a
  key promoted inside jose's 30 s cooldown so the resolver refuses to re-fetch. R9 classifies the
  code as a refusal in every case, deliberately and after review, so those two states answer 401 to
  a live session instead of a retryable 503. Narrow in practice — Supabase publishes a standby key
  before promoting it — and left as ruled; revisiting it means revisiting R9.
- **Mechanism B holds a database connection across its network call (R2, §4.6).** §4.6 requires
  every state-changing command to check liveness *inside* its transaction, and `requireLiveSession`
  is the same code for both adapters. With `SESSION_LIVENESS=auth_server` that means the 3-second
  `GET /auth/v1/user` happens while the command holds a checked-out pool client, so a slow Auth
  server can occupy the pool (`max` 10) and make unrelated reads wait, then answer 503
  `database_unavailable`. The call is bounded at 3 s and fails closed, so it degrades rather than
  signs anyone out. Changing when the guard runs for Mechanism B would change §4.6 and R2, which is
  a design decision, not a fix: raised in the M2-02 review and left for the founder.
- **The allow-list's CHECK is an ASCII guard.** `CHECK (email_norm = lower(email_norm))` uses the
  cluster's `LC_CTYPE`, and both clusters this repository creates are initdb'd with `--locale=C`,
  where `lower()` folds ASCII only — so a hand-written row whose non-ASCII letters are upper-case
  passes here and would be refused on a UTF-8 cluster. The guarantee is therefore the one normal
  form in `packages/db/src/allowlist.ts`, which lower-cases the whole Unicode range and is used by
  the CLI and the API on every write and every lookup (migration `0009` says so in its header).
- **On a demo origin with an API configured, `/internal` shows a failure.** Every `/internal/*` API
  route is behind the authentication hook now (R8), and in `demo` mode the page sends no token by
  design (R13), so the API answers 401 and the page renders one `unexpected` state instead of the
  M2-01 fixture sections. With no `API_INTERNAL_URL` it is `not-configured`, which is what the
  env-less image smoke asserts. `WRINGY_APP_MODE=internal` plus a sign-in is how those sections are
  read now (README "启动顺序"; `apps/web/README.md`).
- **`GET /auth/end-session` applies no Origin rule.** It is a GET reached by a server-side redirect,
  where §4.5's rule cannot tell Wringy's own navigation from anybody else's (the same reason
  `/auth/callback` is exempt). What makes that safe is that it takes no parameters and decides
  nothing: it re-asks `GET /me`, and the single answer that ends a session is `403 account.disabled`
  — the refusal R4 names, and one that is the correct answer for a cross-site caller too. Every 401
  leaves the session alone, because a refused token is not a finished session.
- **A session cookie can be set by a neighbouring host, because it carries no `__Host-` prefix.**
  `@supabase/ssr` names its cookies `sb-<ref>-auth-token…` and Wringy does not rename them, so on a
  shared parent domain any host that can set a cookie for that domain can plant one the browser will
  send to the internal build ("cookie tossing"). What it buys an attacker is a denial of service and a
  confusing sign-in page, not a session: the planted value is not a session the Auth server issued, so
  `getClaims()` refuses it and `proxy.ts` sends the visitor to sign in (and, when the value is not even
  parseable, ends the session and expires every `sb-*` cookie — `proxy.test.ts`, "a getClaims that
  throws"). It cannot be closed while the build is served from a loopback origin: `__Host-` requires
  `Secure`, which a browser will not store for `http://127.0.0.1`, and renaming the library's cookies
  is not an option it offers. It becomes real the day the internal build has a custom domain, which is
  **M2-09**: either a dedicated host with nothing else on the parent domain, or the cookie names
  pinned behind `__Host-` if the library ever allows it.
- **The session refresh has an 8-second overall deadline, and a refresh that finishes after it leaves
  the browser on the old refresh token.** `SUPABASE_REQUEST_TIMEOUT_MS` (5 s) bounds one call to the
  Auth server, but `getClaims()` can make two — the JWKS fetch, then
  `POST /token?grant_type=refresh_token` — so only an overall deadline bounds the page. `proxy.ts`
  gives it `REFRESH_DEADLINE_MS = 8_000`, hands the same `AbortController` to `boundedFetch`, and on
  expiry redirects with `outcome=unexpected` (retryable) while applying **no** buffered cookie write.
  The trade-off is deliberate: if the refresh completes upstream just after the deadline, the Auth
  server has rotated the refresh token and the browser still holds the old one. Inside GoTrue's 10 s
  refresh-token reuse interval the next attempt gets the same new session back, which is why 8 s is
  under it; outside it the session ends and the tester signs in again, with the `session_ended`
  wording. The alternative — applying a half-finished rotation to the browser — is worse, because it
  can leave the browser holding a token neither side accepts.
- **The allow-list key is NFC, so a listed ASCII address never admits a look-alike non-ASCII
  mailbox — and never will.** `normalizeEmail` composes (the two spellings of `ä` are one key) but does
  not compatibility-fold, so `a<U+FB01>le@x` and `ali<U+FF43>e@x` are their own addresses rather than
  `afile@x` and `alice@x` (`packages/db/src/allowlist.ts`; rev 3 of the kickoff code review changed
  this from NFKC). That is the safe direction — under NFKC two distinct mailboxes would share one
  allow-list row, so listing one would admit the other and removing one could not remove the other —
  but it means an operator who pastes a look-alike spelling of a tester's address lists a mailbox
  nobody has, and that tester is refused with the neutral `not_allowed` page until the row is written
  in the spelling the provider verifies. `pnpm db:allowlist list` prints the stored key, which is where
  such a row is visible.
- **An expired PKCE flow state comes back on the Site URL, not on the callback — so the Site URL must
  stay `APP_ORIGIN`.** Found in the founder's real-login walk on 2026-09-26 and fixed in this ticket
  (R11 rev 4), but it stays recorded because the fix depends on a Supabase setting nobody can see from
  the code. When the flow state has expired — the tester idled more than about five minutes on
  Google's account chooser or consent screen — GoTrue no longer holds the flow and therefore no longer
  knows its `redirect_to`, so it sends the provider error to the project's **Site URL root** instead of
  to `/auth/callback`:
  `GET http://127.0.0.1:3100/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+has+expired`
  (captured verbatim from the browser's network log). `proxy.ts` reads any `error`/`error_code` on any
  path but `/auth/callback` and answers `/internal/sign-in?outcome=expired`
  (`outcomeFromSiteUrlError`; `proxy.test.ts`, `outcomes.test.ts`, and the simulated E2E row
  "M2-AC02/1 simulated expired-state"). Two conditions of that: the Site URL of each project must be
  `APP_ORIGIN` exactly (the §4.8 checklist item) — a Site URL pointing anywhere else sends the error to
  a host this app never sees, and the tester is back to a page that says nothing happened, with nothing
  in any log to show it; and the outcome copy says "expired" for a cancel that merely took too long,
  because `bad_oauth_state` is all GoTrue tells us (the person's own cancel is no longer knowable at
  that point). **GoTrue's flow-state lifetime is the project default and was not changed** — about
  5 minutes, not a Wringy setting and not exposed by `/auth/v1/settings`; the number above is inferred
  from the walk's two attempts (one at about 6 minutes failed, one inside a minute succeeded), not read
  from a vendor document.
- **Every §4.9 `Real` row has now run, and one of them contradicts the kickoff's expectation.** The
  founder's walk of 2026-09-26 executed the Google rows; the orchestrator's script executed the last two
  against the real Supabase dev project with admin-minted sessions (not Google). The "stale" row found
  that reusing an already-rotated refresh token outside the 10 s reuse interval is **refused**
  (`400 refresh_token_already_used`) but does **not** end the session: the current access token still
  passes the probe and the current refresh token still rotates. §4.9 expected "the session ends". A
  stolen, already-rotated token is therefore useless, but a stolen *current* one is as good as the
  user's until it rotates, and Supabase's family revocation did not fire. Whether the project's
  refresh-token reuse detection (Supabase dashboard, Auth → Sessions) should revoke the family is a
  founder dashboard check; the code does not depend on it. Reuse of a token whose child is still unused
  is answered 200 (a slow-client retry, GoTrue's leniency). The refresh row proved the proxy's refresh
  path against the real Auth server (a real session stored with a past `expires_at` came back signed
  in with a new cookie). Record: [acceptance-record.md](acceptance-record.md) "Real rows executed by
  script". The walk itself is [m2-02-real-login-runbook.md](m2-02-real-login-runbook.md).
## M2-03: organisations, memberships, capabilities and the audit log

Recorded 2026-09-26 against branch `feat/m2-03`, from the design record
[m2-03-code-review.md](m2-03-code-review.md) (revision 2) and the build. These are the limitations
M2-03 accepts, each with the ruling or the reason it is accepted under; the rows that name a later
ticket are hand-offs, not defects.

- **A recycled Google address inherits everything the old holder had (R16; open, for the founder).**
  Supabase links a new Google identity that carries a known verified address to the *existing*
  user (identity-linking guide; GoTrue `DetermineAccountLinking`), so the new holder signs in as the
  old `sub` and inherits the old profile, every membership including admin, and every review,
  finance or `ops_runtime` grant. Keying membership by `sub` therefore does **not** close M2-02's
  R16. Accepted for the M2 internal build (fixture data, named testers) with the operator runbook in
  `packages/db/README.md` ("Capability grants"): when an address is retired, `pnpm db:grant revoke`
  each grant, remove the address from the allow-list, disable the profile (the hook refuses a
  disabled profile on the next request) and revoke pending invitations. The priced alternative
  (about half a day: pin `user_metadata.provider_id` at first sign-in and refuse a later sign-in whose
  value differs) needs GoTrue's metadata merge on a linked login verified first. Founder question
  §6.3 of the design record.
- **A pending invitation follows the address, not the person, for its seven days (D2, D7).** The
  match is the verified `email` claim against `invitee_email_norm`. Whoever holds that address and
  passes the allow-list inside the window can accept; an admin revokes a pending invitation when an
  address is retired. The link itself grants nothing to another address (`invitation.email_mismatch`,
  proven end to end by the wrong-recipient row).
- **A pending invitation outlives its inviter's standing, but no longer admits anybody (R7 rev 3).**
  An invitation acts on the authority of the admin who sent it, and that authority is re-checked
  when the link is used: once the inviter is removed, leaves, is demoted or is disabled, preview and
  accept answer 403 `invitation.invalid` (reason `inviter_not_admin`) and nobody is admitted. Remove,
  leave and demote do not revoke that person's pending invitations (a cascade would be new scope), so
  they stay in the org's pending list, inert, until an admin revokes them or they expire. The list
  does not name who sent each one; an operator can, from `app.org_invitations.invited_by`.
- **An invitation does not bypass the allow-list (R17).** The link holder must be able to sign in to
  this build at all; a not-listed holder gets the neutral sign-in refusal and no membership is
  written (Mallory's row).
- **Where the invitation token lives (R7).** The API's 201 body once; the admin's browser in a
  page-scoped httpOnly cookie for ten minutes (never the admin's URL, history or Referer); the accept
  URL the admin hands over, and therefore the invitee's browser history, the sign-in `next` value
  and the `wringy-auth-next` cookie; never an API path, an API log line or the database (only its
  sha256). Never a Referer beyond the origin: every internal response sends
  `Referrer-Policy: strict-origin` as a header (rev 3). Until the W4 fix wave only the pages'
  `<meta>` said so, which a browser applies after it has parsed it — so the accept page's first
  same-origin chunk requests, and every request of the sign-in page reached with the link as `next`,
  carried the full URL in their Referer (same-origin only; the address match still made a leaked
  link grant nothing). Under `next dev` the request logger would print the accept URL, so `next.config.ts`
  ignores `token=` URLs, the sign-in redirect's percent-encoded `next=…%3Ftoken%3D…` included (rev 3); `next start` (the internal suite, staging) logs no requests. The controls
  that make a leaked link harmless are the address match, single use and the expiry.
- **The runtime role can no longer read the audit log.** `0016` revokes `SELECT` on `app.audit_log`
  from `wringy_api` (the kickoff's "INSERT and SELECT only" is a ceiling); the API appends and
  cannot read, update or delete. M2-08 re-grants `SELECT` when its retry view needs it. One
  consequence the builders met: `INSERT … RETURNING` needs `SELECT`, so the audit writer inserts
  without `RETURNING`.
- **What is audited, and what is not (R4).** Every refusal decided by the authorisation logic writes
  one denial row (reads and commands alike, including the uniform 404s for objects outside the
  caller's org). Refusals decided before an actor is admitted — no/invalid/expired token,
  `profile.missing`, `account.disabled`, `session.revoked`, and a 400 from schema validation — are
  logged as a reason word and not audited, so no unauthenticated or non-allow-listed caller can write
  a row. An allow-listed insider can write one row per denied request; D9 keeps everything during M2.
  Allowed reads are not audited. Every allow-list change and every `db:grant` change writes a
  bootstrap row, so a seeded test database already holds `allowlist.add` rows.
- **`app.audit_log` has no indexes and no read surface in M2 (D9).** It is read through SQL by an
  operator; the ticket that first queries it adds indexes as an expand step. `actor_label`,
  `reason` and `summary.name` hold operator-typed or org-typed text; the CLI parsers refuse a `--by`
  or `--reason` containing `@`, and the allow-list rows carry only a sha256 of the address.
- **A person's org is `live`; fixture campaigns cannot live in it yet (R2, for M2-05).** `0003`'s
  composite FK ties a campaign's label to its org and `0007` makes the org's label immutable, so a
  tester's own org can hold no fixture campaign until M2-05 relaxes
  `campaigns_org_data_origin_fkey` to an org-only FK plus the environment trigger — a §4.13
  contract step (M2-AC05/3 rules out "a simulated publish is a status on a live row"). The seed's
  Kopi Kita stays the org that owns the public demo campaigns (D11).
- **An org has no `status` column (§5 of the record).** No ruling in D1–D12 suspends or archives an
  org; the ticket that first needs it adds the column with its domain.
- **A creator can be demoted, but never the last admin (D3).** The `org_created` row is tied to the
  org's creator by constraint (`org_members_creator_fkey`); its `role` is current state, so another
  admin may demote the creator later; the last active admin (whose profile is active) can neither
  leave nor be demoted (`org.last_admin`).
- **Objects outside the caller's org answer 404, not the 403 kickoff §3.4 names.** A member id or
  invitation id that is not in the org given in the path answers `member.not_found` /
  `invitation.not_found`, audited with `reason = not_in_org`; a uniform 404 gives no existence
  oracle. The org itself, when the caller is not a member, is the 403 `org.forbidden` — the same
  answer for an org that does not exist.
- **Every command in an org serialises on the org row.** Revision 1's lock order deadlocked on
  PostgreSQL 17 under ordinary concurrent admin actions (proven on a scratch cluster), so every
  command takes `SELECT … FOR NO KEY UPDATE` on the org row first. Two admins acting on one org at
  the same instant wait for each other for milliseconds; the 4.5 s statement timeout bounds a
  pathological wait and answers 503. Trivial at M2 volume; revisited if an org ever has hundreds of
  concurrent admins.
- **No `/internal/ops` page and no Operations link in this ticket (§5).** Nothing is operable
  before M2-08; `GET /me/workspaces` already lists the caller's grants for M2-08's page to use. The
  §3.3 separation clauses that need M2-05/M2-07 tables ("ops_runtime cannot read drafts,
  submissions") and M2-08's route ("neither can retry notifications") are proven at the guard level
  now (`requireOrgCapability`, `requirePlatformGrant`) and re-proven on those routes when they exist.
- **Invitation mail is M2-08's.** M2-03 sends no notification: the admin hands the single-use link
  over; M2-08 carries the same link through the outbox and Resend.
- **A deploy rollback over `0011`–`0016` is not proven here (R15, for M2-09).** Image N's `/health`
  requires an exact migration head and would report `failing` on a `0016` database. The recovery the
  ticket asks for ("回退撤销新增授权而保留业务记录") is proven the other way: revoking every
  membership, grant and invitation the walk added leaves the org, its campaigns and every audit row
  in place, and the runtime role cannot delete any of them by privilege.
- **Simulated identity in every automated M2-AC03 row.** The internal suite signs in through the
  local fake Auth server; the database and API rows run on real PostgreSQL 17. The M2-AC03 spec row
  does not forbid closing on simulated results (unlike M2-AC02); whether the founder walks it with
  the real Google test users before closing is question §6.1 of the design record.

## Governance not yet in force

- **Branch protection (D22) waits for the merge.** Today `main` requires only `planning`
  (re-read 2026-09-23T05:48:15Z). `check`, `integration` and `e2e` become required after `app.yml`
  has run on `main`; an admin applies it (about 15 minutes, G5). Until then a red product build
  could merge.
- **The cross-vendor review is not enforced.** Ruling D23: the Codex read-only review is at the
  orchestrator's discretion. For PR #82 it ran once, on `12a85ab`, on 2026-09-23 (Codex CLI 0.153.4,
  gpt-6-astra, read-only), and the result is saved as a
  [PR #82 comment](https://github.com/BELCORT-SDN-BHD/wringy/pull/82#issuecomment-5790041412). Its
  two defects are fixed in `2e84a7a` and the commit after it
  ([acceptance-record.md](acceptance-record.md) "M2-AC01/3", cross-vendor row). Nothing makes the
  review run on a later PR: automating it is still open as G8.
- **No release gate** (D24, G9): see "Internal build only".

## Unverified until CI, Supabase or Render

- **The review fixes ran in CI** (no longer unverified): [run 35825491353](https://github.com/BELCORT-SDN-BHD/wringy/actions/runs/35825491353) on `12a85ab` and
  [run 35828034405](https://github.com/BELCORT-SDN-BHD/wringy/actions/runs/35828034405) on `fe17df4` executed `apps/api/tests/integration/timeouts.int.test.ts`,
  `apps/worker/test/schedule.int.test.ts`, the harness guards in `packages/db/test/cluster.int.test.ts`
  (CI's `TEST_DATABASE_URL` host 127.0.0.1 counts as loopback), the PostgreSQL 17 and Node 24
  assertions, the relabel-serialisation and request-log tests, and the internal suite with
  `failOnFlakyTests` active; all jobs green.
- **The images are proven only in CI.** No Docker on this machine. The `images` job on `9ca00a5`
  built all three and smoke-ran them; pushing, pulling from GHCR and Render's pre-deploy command are
  unverified (kickoff-package.md §8.9, G18).
- **Supabase behaviours** (G17; checked in M2-02 and M2-09): whether a custom `wringy_migrator` can
  own `app`, `ops` and `pgboss` or `postgres` must migrate; whether the pg-boss CLI and
  node-pg-migrate's session advisory lock work through the Supavisor session pooler; whether
  `pnpm db:bootstrap` can create the logins as Supabase's non-superuser `postgres`
  (`packages/db/README.md` L157–L164); whether `auth.sessions` is readable (kickoff-package.md
  §4.6, Mechanism A); whether LISTEN works through the session pooler; and whether Supavisor passes
  the API's `statement_timeout` startup parameter (the fallback is
  `ALTER ROLE wringy_api_login SET statement_timeout`; `apps/api/README.md` L116).
- **Render's shutdown grace.** The worker drains for up to 20 s on SIGTERM, plus 10 s of grace
  (`apps/worker/README.md` L162). Render's grace period has not been checked against it, and a
  SIGTERM drain inside a container is unverified until M2-09 (`apps/worker/README.md` L170–L172).
  Whether the API is reachable only over Render's private network is also unverified
  (kickoff-package.md §4.5).

## Testing limitations

- **One browser engine.** Chromium only, at 390, 1440 and 320 px, as in M1 (G14, ruling D26).
- **Local evidence is Windows only.** Linux-only paths come from CI.
- **Nothing asserts pixels.** The screenshots in `docs/m2-internal/screenshots/` are evidence for a
  human reviewer, not a visual baseline.
