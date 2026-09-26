-- 0016_audit_log: the append-only record of who did what to organisations,
-- memberships, invitations, capabilities and the sign-in allow-list, and of every
-- refusal the authorisation logic decides (kickoff-package.md §3.2 "audit_log";
-- ruling D9; implementation spec "audit只追加…不记录令牌"; M2-03 code review R3,
-- R4, R6). Serves M2-AC03/3: over-reaching reads, writes and grants are refused
-- and leave an audit row that carries no secret.
--
-- Creates app.audit_log:
-- - id bigint GENERATED ALWAYS AS IDENTITY: an identity column draws from its
--   sequence without a sequence privilege, so the API holds none.
-- - occurred_at (database clock) and recorded_by name DEFAULT current_user: the
--   database login that wrote the row, which the API cannot set, so a row from
--   the runtime login can never pass for the operator script's.
-- - actor_kind user|system|bootstrap; actor_user_id set exactly for a user
--   (audit_log_actor_user_check); actor_label required for bootstrap (the `--by`
--   of a `pnpm db:grant` / `pnpm db:allowlist` run; the parsers refuse a value
--   with `@`).
-- - context_org_id, target_type, target_id (a uuid or a pseudonymous sha256
--   hex), action `noun.verb` (audit_log_action_check), outcome allowed|denied,
--   denial_code exactly when denied (audit_log_denial_code_check), reason (a fixed
--   reason word or the operator's `--reason`), summary (the typed before/after
--   shape: role, status, capability, org name).
-- - request_id (the API's per-request UUID) and session_ref (sha256 hex of the
--   session id, audit_log_session_ref_check), both required on a user row
--   (audit_log_user_correlation_check).
--
-- What never enters the table: a token, a cookie, a session id, an address the
-- system holds (summary.name is the org name an admin typed, free text). No
-- foreign key from actor_user_id or context_org_id: an audit row must never fail
-- to write because of referential state. No index beyond the primary key in M2:
-- D9 keeps the log readable through SQL only, and the ticket that first queries
-- it adds them.
--
-- Deliberately absent: no data_origin column and no fixture trigger (§3.5).
--
-- Privileges: 0001's default gave the API SELECT on every new app table; it is
-- revoked here, because nothing in M2-03 reads the log (the kickoff's "INSERT
-- and SELECT only" is a ceiling; M2-08 re-grants SELECT when its retry view needs
-- it). The API gets column-level INSERT on every column but id, occurred_at and
-- recorded_by, and no UPDATE, DELETE or sequence privilege: append-only by
-- privilege. An INSERT … RETURNING would need SELECT, so the API writes rows
-- without reading them back. The worker has no USAGE on schema app (0001).
--
-- Down only drops the table: its ACL, column grants and identity sequence go
-- with it, and 0001's default privileges are untouched, so nothing needs
-- restoring first.

-- Up Migration

CREATE TABLE app.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_by name NOT NULL DEFAULT current_user,
  actor_kind text NOT NULL
    CONSTRAINT audit_log_actor_kind_check CHECK (actor_kind IN ('user', 'system', 'bootstrap')),
  actor_user_id uuid,
  actor_label text,
  context_org_id uuid,
  action text NOT NULL
    CONSTRAINT audit_log_action_check CHECK (action ~ '^[a-z_]+[.][a-z_]+$'),
  target_type text,
  target_id text,
  outcome text NOT NULL
    CONSTRAINT audit_log_outcome_check CHECK (outcome IN ('allowed', 'denied')),
  denial_code text,
  reason text,
  summary jsonb,
  request_id text,
  session_ref text
    CONSTRAINT audit_log_session_ref_check CHECK (session_ref ~ '^[0-9a-f]{64}$'),
  CONSTRAINT audit_log_denial_code_check CHECK ((outcome = 'denied') = (denial_code IS NOT NULL)),
  CONSTRAINT audit_log_actor_user_check CHECK ((actor_kind = 'user') = (actor_user_id IS NOT NULL)),
  CONSTRAINT audit_log_bootstrap_label_check CHECK (actor_kind <> 'bootstrap' OR actor_label IS NOT NULL),
  CONSTRAINT audit_log_user_correlation_check
    CHECK (actor_kind <> 'user' OR (session_ref IS NOT NULL AND request_id IS NOT NULL))
);

REVOKE SELECT ON app.audit_log FROM wringy_api;

GRANT INSERT (
  actor_kind, actor_user_id, actor_label, context_org_id, action, target_type, target_id,
  outcome, denial_code, reason, summary, request_id, session_ref
) ON app.audit_log TO wringy_api;

-- Down Migration

DROP TABLE app.audit_log;
