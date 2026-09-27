-- 0017_profiles_locale_pair_check: a language preference exists together with
-- the instant it was set, or not at all (kickoff-package.md §3.2 "profiles",
-- §8.11 "the locale stored on the profile with an explicit flag"; localization-v1
-- "用户明确选择优先并持久保存"; M2-04 code review R1 rev 2, §5). Serves
-- M2-AC04/2: a person's explicit choice is saved to the account, and the account
-- can always say whether one was made.
--
-- The pair is the explicit flag. `locale_pref IS NOT NULL` means "this person
-- chose a language", `locale_pref_set_at` says when, and NULL in both means "no
-- explicit choice" (§3.2). A boolean beside the two columns would say the same
-- thing a third time. What 0008 did not pin is that the two move together: it
-- accepted a preference with no instant, and an instant with no preference (the
-- kickoff review executed both on PostgreSQL 17). This CHECK makes the pair a
-- property of the table, as 0016 pins `audit_log_denial_code_check`, so a later
-- writer (the operator's SQL, a future command) cannot leave a half-set flag that
-- the resolution order would read as a choice without a date or a date without a
-- choice. `POST /me/locale` writes both in one UPDATE (R2), so it never meets it.
--
-- No row has ever been written to these columns (0010 kept them out of the API's
-- reach and nothing else writes them), so the ALTER cannot fail on existing data.
-- Before the merge the count of rows breaking the pair is run on the dev and
-- staging projects and recorded (expected 0; R1).
--
-- Deliberately not done here: no default, no trigger that stamps
-- `locale_pref_set_at` (the command writes the database's `now()` itself), no
-- change to the three-code CHECK of 0008, and no grant: 0018 is the one object
-- that lets the API write the pair (M2-03 R1 "one object per migration file").
-- Nothing here clears a preference: no source asks for a "clear my preference"
-- command (M2-04 code review §4).
--
-- Privileges: none change. The worker has no USAGE on schema app (0001).
--
-- Down drops the constraint and leaves the columns and their rows as they are.

-- Up Migration

ALTER TABLE app.profiles
  ADD CONSTRAINT profiles_locale_pref_pair_check
  CHECK ((locale_pref IS NULL) = (locale_pref_set_at IS NULL));

-- Down Migration

ALTER TABLE app.profiles DROP CONSTRAINT profiles_locale_pref_pair_check;
