-- 0018_profiles_locale_grants: the API may write a signed-in person's language
-- preference and the instant it was set, and nothing more of the profile than
-- before (kickoff-package.md §3.2, §8.6 "the signed-in locale preference moves to
-- the server", §8.11; ruling D12; M2-04 code review R1 rev 2, R2). Serves
-- M2-AC04/2: an explicit choice made while signed in is saved to the account and
-- is there on the next device.
--
-- 0010 turned 0008's table-level INSERT and UPDATE into column grants and left
-- `locale_pref` and `locale_pref_set_at` out, because M2-04 owns the feature that
-- writes them. This is that feature: `POST /me/locale` runs one statement,
-- `UPDATE app.profiles SET locale_pref = $2, locale_pref_set_at = now() WHERE
-- id = $1 RETURNING …`, after locking the caller's own row (R2). The table-level
-- SELECT of 0008 is what RETURNING reads through, so nothing else is needed.
--
-- So one column grant is added:
-- - UPDATE (locale_pref, locale_pref_set_at): the pair, together. 0017's CHECK
--   refuses one without the other, so the grant cannot be used to leave a
--   half-set flag.
--
-- What stays refused, on purpose:
-- - UPDATE of `status` (D12: only an operator disables or re-enables an account);
-- - INSERT naming either locale column: the first sign-in creates the row with no
--   preference (0010's INSERT list), and a preference is only ever a later,
--   explicit choice;
-- - UPDATE of `updated_at`, `created_at` or `id`: the shared trigger stamps
--   `updated_at` on every UPDATE without a grant on it;
-- - DELETE, never granted (0008), so no request can erase an identity.
--
-- The command's own row lock (`SELECT status … FOR NO KEY UPDATE`) already worked
-- before this migration, because it needs UPDATE on some column of the row and
-- 0010 granted three; nothing here changes what the sign-in or the session probe
-- may lock.
--
-- Privileges: nothing is granted to the hosted platform's own API roles, which
-- have no rights in schema app at all (0001). The worker has no USAGE on schema
-- app and reaches nothing in this file.
--
-- Down revokes exactly this column grant, which returns both columns to 0010's
-- state: readable through the table's SELECT, writable by nobody but the
-- migrator. The rows keep whatever preference they hold (R15).

-- Up Migration

GRANT UPDATE (locale_pref, locale_pref_set_at) ON app.profiles TO wringy_api;

-- Down Migration

REVOKE UPDATE (locale_pref, locale_pref_set_at) ON app.profiles FROM wringy_api;
