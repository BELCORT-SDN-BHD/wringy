/**
 * `app.profiles` as the API reads and writes it (migration 0008; M2-02 R6).
 *
 * One module owns the column list, the row-to-contract mapping and the three
 * statements the API is allowed to run (SELECT, INSERT, UPDATE — never DELETE,
 * which the grant refuses anyway), so the authentication hook, `GET /me` and the
 * sign-in command cannot disagree about what a profile is.
 *
 * Every instant comes from PostgreSQL: `last_sign_in_at` is `now()` on the
 * database clock, never the API host's.
 */
import type { Profile, ProfileStatus } from '@wringy/contracts';
import type { PoolClient } from '@wringy/db';

type Queryable = Pick<PoolClient, 'query'>;

/**
 * The columns the Profile contract needs, listed explicitly (defence in depth:
 * the zod response schema is still the final allow-list for what leaves the API).
 */
const PROFILE_COLUMNS = 'id, display_name, contact_email, status, last_sign_in_at, created_at';

interface ProfileRow {
  id: string;
  display_name: string | null;
  contact_email: string;
  status: ProfileStatus;
  last_sign_in_at: Date;
  created_at: Date;
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    contactEmail: row.contact_email,
    status: row.status,
    lastSignInAt: row.last_sign_in_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

/** The profile of a verified token subject, or null when the person has never signed in. */
export async function readProfileById(client: Queryable, id: string): Promise<Profile | null> {
  const { rows } = await client.query<ProfileRow>(
    `SELECT ${PROFILE_COLUMNS} FROM app.profiles WHERE id = $1`,
    [id],
  );
  return rows[0] === undefined ? null : toProfile(rows[0]);
}

/**
 * The same read with `FOR UPDATE`, for the sign-in command: two callbacks
 * arriving together must not both decide "no profile yet" and both insert.
 */
export async function lockProfileById(client: Queryable, id: string): Promise<Profile | null> {
  const { rows } = await client.query<ProfileRow>(
    `SELECT ${PROFILE_COLUMNS} FROM app.profiles WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return rows[0] === undefined ? null : toProfile(rows[0]);
}

/**
 * The row's `status` re-read with `FOR SHARE` on a command's own transaction
 * client (M2-02 R6). Null when the row is gone.
 *
 * The authentication hook already refused a disabled profile, but it read the row
 * on another connection before the command opened its transaction, so an operator
 * disabling the account in between would be invisible to the work the read
 * allowed. `FOR SHARE` (not `FOR UPDATE`: the command changes nothing about the
 * profile, it only insists the row stays as it read it) makes the answer belong to
 * the same transaction as the work.
 */
export async function lockProfileStatusForShare(client: Queryable, id: string): Promise<ProfileStatus | null> {
  const { rows } = await client.query<{ status: ProfileStatus }>(
    `SELECT status FROM app.profiles WHERE id = $1 FOR SHARE`,
    [id],
  );
  return rows[0]?.status ?? null;
}

export interface SignInIdentity {
  /** The verified token subject; the primary key. */
  id: string;
  /**
   * The verified `email` claim as the provider spells it — the notification
   * address (§3.2, D7). **Not** the allow-list's normal form: `normalizeEmail` is
   * NFKC plus lower-case, which rewrites some addresses into a different mailbox,
   * and it exists to answer one question (is this address listed?), not to decide
   * where a person is written to.
   */
  contactEmail: string;
  /** The provider's display name, for display only; null when absent. */
  displayName: string | null;
}

/**
 * The profile row after a sign-in: created on the first, refreshed on every later
 * one (ruling D7 — the verified address and the provider's display name are
 * refreshed each time). `status` is never written here: only an operator changes
 * it.
 *
 * The upsert is also the tie-break for two callbacks of the same brand-new subject
 * arriving together. `SELECT … FOR UPDATE` cannot lock a row that does not exist
 * yet, so both would take the insert path and one would hit the primary key. Both
 * carry the same verified subject and the same address that just passed the gate,
 * so the loser refreshing the winner's row is the right answer, not a 500.
 */
export async function writeProfileOnSignIn(client: Queryable, identity: SignInIdentity): Promise<Profile> {
  const { rows } = await client.query<ProfileRow>(
    `INSERT INTO app.profiles (id, contact_email, display_name, last_sign_in_at)
          VALUES ($1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE
            SET contact_email = excluded.contact_email,
                display_name = excluded.display_name,
                last_sign_in_at = excluded.last_sign_in_at
       RETURNING ${PROFILE_COLUMNS}`,
    [identity.id, identity.contactEmail, identity.displayName],
  );
  if (rows[0] === undefined) throw new Error('the profile upsert returned no row');
  return toProfile(rows[0]);
}

/** True when `emailNorm` is on `app.sign_in_allowlist` (R5; SELECT only for the API). */
export async function isAllowlisted(client: Queryable, emailNorm: string): Promise<boolean> {
  const { rows } = await client.query(`SELECT 1 FROM app.sign_in_allowlist WHERE email_norm = $1`, [emailNorm]);
  return rows.length === 1;
}
