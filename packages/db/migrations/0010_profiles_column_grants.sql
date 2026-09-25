-- 0010_profiles_column_grants: the API may write the three columns a sign-in
-- refreshes, and `status` is not one of them (kickoff-package.md §3.2, §4.11;
-- ruling D12; M2-02 R6 rev 3). Serves M2-AC02/2: only an operator disables an
-- account, so the runtime role must not be able to.
--
-- 0008 granted INSERT and UPDATE on the whole table, which left `status`
-- writable by the API login. Nothing in the code writes it — writeProfileOnSignIn
-- names its columns (apps/api/src/profiles.ts) — but "nothing writes it today" is
-- a code property, and D12 ("an operator can disable an account", and only an
-- operator) is worth a privilege. A bug, an injection or a future route that
-- reached `UPDATE app.profiles SET status = 'active'` would re-admit a disabled
-- person with one statement; after this migration the database refuses it (42501).
--
-- So the table-level INSERT and UPDATE are revoked and re-granted per column:
-- - INSERT (id, contact_email, display_name, last_sign_in_at): what the first
--   sign-in writes. `id` is the verified token subject; `status`, `locale_pref`
--   and `locale_pref_set_at` take their defaults, and `created_at`/`updated_at`
--   are the database's.
-- - UPDATE (contact_email, display_name, last_sign_in_at): what every later
--   sign-in refreshes (ruling D7). Not `status` (D12), and not `locale_pref` or
--   `locale_pref_set_at`: the columns exist, and M2-04 owns the feature that
--   writes them, which is when the grant for them belongs here.
--
-- SELECT is untouched (0001's default privileges), and DELETE was never granted,
-- so no request can erase an identity. `SELECT … FOR UPDATE` and `FOR SHARE`,
-- which the sign-in command and the session probe use to re-read `status` inside
-- their own transaction, need UPDATE on some column of the row rather than on the
-- whole table, so they keep working.
--
-- Privileges: nothing is granted to the hosted platform's own API roles, which
-- have no rights in schema app at all (0001). The worker has no USAGE on schema
-- app and reaches nothing in this file.
--
-- Down restores 0008's table-level grants exactly: the column grants are revoked
-- first, which returns each column's ACL to "inherit from the table", and then
-- INSERT and UPDATE are granted on the table again.

-- Up Migration

REVOKE INSERT, UPDATE ON app.profiles FROM wringy_api;

GRANT INSERT (id, contact_email, display_name, last_sign_in_at) ON app.profiles TO wringy_api;
GRANT UPDATE (contact_email, display_name, last_sign_in_at) ON app.profiles TO wringy_api;

-- Down Migration

REVOKE INSERT (id, contact_email, display_name, last_sign_in_at) ON app.profiles FROM wringy_api;
REVOKE UPDATE (contact_email, display_name, last_sign_in_at) ON app.profiles FROM wringy_api;

GRANT INSERT, UPDATE ON app.profiles TO wringy_api;
