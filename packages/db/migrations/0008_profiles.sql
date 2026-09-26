-- 0008_profiles: the signed-in person's row (kickoff-package.md §3.2 "profiles",
-- §3.5 "Users are never fixtures", technical choice IT1; rulings D7 and D12).
-- Serves M2-AC02/2: the first sign-in creates this row, every later request is
-- authorised from it, and an operator disabling it ends that person's access.
--
-- Creates app.profiles:
-- - id uuid PRIMARY KEY: the verified token subject, never an email. §3.1 "the
--   identity key is the JWT sub". There is NO foreign key to the hosted identity
--   store's user table (IT1): these migrations must run on plain local
--   PostgreSQL, and the upstream example cascades deletes over rows the audit
--   will depend on. Fastify inserts the row only after it has verified a token.
-- - contact_email NOT NULL and display_name: copied from the verified token at
--   each sign-in (D7). contact_email is used for notifications only; there is no
--   UNIQUE on it (§3.2), because an address can be recycled while the subject
--   cannot. display_name is for display only and may be absent.
-- - locale_pref, restricted to the three supported codes, and locale_pref_set_at
--   (NULL means no explicit choice). The columns exist now; M2-04 owns the
--   feature that writes them.
-- - status active|disabled, default active (R4/D12). A disabled profile is
--   refused on every request that carries a verified token, with 403
--   account.disabled.
-- - last_sign_in_at NOT NULL, created_at, updated_at with the shared
--   ops.touch_updated_at() trigger from 0002.
--
-- Deliberately absent: no data_origin column and no ops.assert_fixture_allowed()
-- trigger. Every user is a real identity, so a profile can never be a fixture
-- row (§3.5) and the fixture/live label would be meaningless here.
--
-- Privileges: the API gets SELECT, INSERT and UPDATE (it upserts the row at each
-- sign-in) and never DELETE, so no request can erase an identity. 0001's default
-- privileges granted SELECT only, so INSERT and UPDATE are granted here. The
-- worker has no USAGE on schema app (0001) and reaches nothing in this file.
-- Nothing is granted to the hosted platform's own API roles; they have no rights
-- in schema app at all (0001, kickoff-package.md §4.11).

-- Up Migration

CREATE TABLE app.profiles (
  id uuid PRIMARY KEY,
  display_name text,
  contact_email text NOT NULL,
  locale_pref text
    CONSTRAINT profiles_locale_pref_check CHECK (locale_pref IN ('en-MY', 'ms-MY', 'zh-Hans-MY')),
  locale_pref_set_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CONSTRAINT profiles_status_check CHECK (status IN ('active', 'disabled')),
  last_sign_in_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON app.profiles
  FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

GRANT SELECT, INSERT, UPDATE ON app.profiles TO wringy_api;

-- Down Migration

DROP TABLE app.profiles;
