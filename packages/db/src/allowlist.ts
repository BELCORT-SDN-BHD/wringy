/**
 * The tester sign-in allow-list, `app.sign_in_allowlist` (migration 0009;
 * kickoff-package.md §3.2, ruling D13; M2-02 R5).
 *
 * One address per row, in one normal form (Unicode NFC, trimmed, lower-cased),
 * computed here and nowhere else: the
 * CLI (`pnpm db:allowlist`) and the API's first-sign-in gate both call
 * `normalizeEmail`, so the gate cannot disagree with the list about what an
 * address is. The table's CHECK re-states the lower-case part, in case a row is
 * ever written by hand.
 *
 * The list is read on the first sign-in only. Removing an address signs nobody
 * out; disabling the profile (`app.profiles.status`) does.
 *
 * Every add and remove writes its `app.audit_log` row in the same statement (a
 * data-modifying CTE, as `pnpm db:grant` does; M2-03 code review R6):
 * `actor_kind = 'bootstrap'`, `actor_label = --by`, `action = allowlist.add |
 * allowlist.remove`, `target_type = sign_in_allowlist`, `reason = --reason`, and
 * `target_id` = the sha256 of the normalised address, in hex: pseudonymous, so the
 * address itself never enters the log (R3). Removing an address that is not
 * listed changes nothing and writes no row.
 *
 * Imports: `pg`'s types and `node:crypto` only, never `import.meta`, so the
 * Playwright internal suite (CommonJS) can still load this module through
 * test/connect.ts.
 */
import { createHash } from 'node:crypto';

import type pg from 'pg';

type Queryable = Pick<pg.ClientBase, 'query'>;

/**
 * The address could not be put in a normal form (see `normalizeEmail`), or the
 * reason or author of a change is blank or carries an address.
 */
export class InvalidEmailError extends Error {
  override readonly name = 'InvalidEmailError';
}

/**
 * The audit log's reference to an allow-listed address: the sha256 of its
 * normal form (UTF-8), in lower-case hex. An operator who knows the address can
 * find its rows; the row itself tells nobody the address (R3, R6).
 */
function addressRef(emailNorm: string): string {
  return createHash('sha256').update(emailNorm, 'utf8').digest('hex');
}

/**
 * `--reason` and `--by` are stored on the row and in the audit log, which never
 * holds an address: a blank or `@`-bearing value is refused (the CLI's parser
 * refuses it first; this is the library's own guard).
 */
function operatorText(label: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') throw new InvalidEmailError(`${label} is required for an allow-list change.`);
  if (trimmed.includes('@')) {
    throw new InvalidEmailError(`${label} may not contain "@": the audit log never stores an address.`);
  }
  return trimmed;
}

/**
 * The normal form of an address: Unicode **NFC**, trimmed, lower-cased.
 *
 * Nothing else. In particular no dot or plus rewriting: `a.b@x` and `a+t@x` are
 * different addresses to their providers, and guessing otherwise would either
 * admit an address nobody listed or refuse one that was.
 *
 * NFC first, so the two spellings of one letter — `ä` as U+00E4, and `a` plus
 * U+0308 COMBINING DIAERESIS — are one key; then trim, because a pasted address
 * carries spaces; then lower-case, because domains are case-insensitive and
 * mailbox case is not worth a second row.
 *
 * **NFC, not NFKC** (rev 3 of the kickoff code review, R5). Compatibility
 * folding would map distinct code points onto the listed ASCII spelling: U+FB01
 * LATIN SMALL LIGATURE FI becomes `fi`, U+FF43 FULLWIDTH LATIN SMALL LETTER C
 * becomes `c`. Those are different mailboxes to
 * a provider, so under NFKC two mailboxes would share one key and listing one
 * would admit the other. Under NFC a listed ASCII address admits exactly that
 * address, and a look-alike non-ASCII mailbox is simply not listed — it is
 * refused, which is the safe direction (known-issues.md, M2-02).
 *
 * Throws `InvalidEmailError` on an empty result or one without `@`. This is a
 * shape check, not validation: whether the mailbox exists is not knowable here,
 * and the verified token's address is the one that matters at sign-in. A
 * full-width `＠` (U+FF20) is therefore refused rather than rewritten.
 */
export function normalizeEmail(raw: string): string {
  const normalized = raw.normalize('NFC').trim().toLowerCase();
  if (normalized === '') throw new InvalidEmailError('An email address is required; the value given is empty.');
  if (!normalized.includes('@')) {
    throw new InvalidEmailError('An email address must contain "@". Values are not shown.');
  }
  return normalized;
}

/** One row of `app.sign_in_allowlist`. */
export interface AllowlistEntry {
  emailNorm: string;
  reason: string;
  addedBy: string;
  addedAt: Date;
}

export interface AddAllowlistEntryOptions {
  email: string;
  /** Why this address may sign in. Required: it is kept on the row and in the audit log. */
  reason: string;
  /** Who decided (the audit row's `actor_label`). Required, for the same reason. */
  addedBy: string;
}

export type AddAllowlistOutcome = 'added' | 'updated';

export interface AddAllowlistEntryResult {
  entry: AllowlistEntry;
  /** `updated` when the address was already listed; its reason, author and time are replaced. */
  outcome: AddAllowlistOutcome;
}

interface Row {
  email_norm: string;
  reason: string;
  added_by: string;
  added_at: Date;
}

const toEntry = (row: Row): AllowlistEntry => ({
  emailNorm: row.email_norm,
  reason: row.reason,
  addedBy: row.added_by,
  addedAt: row.added_at,
});

/**
 * Lists `email` (normalised), or replaces its reason, author and time when it is
 * already listed, and audits either as `allowlist.add` in the same statement.
 * Runs as the migrator; the API has SELECT only.
 */
export async function addAllowlistEntry(
  client: Queryable,
  { email, reason, addedBy }: AddAllowlistEntryOptions,
): Promise<AddAllowlistEntryResult> {
  const emailNorm = normalizeEmail(email);
  const why = operatorText('A reason (--reason)', reason);
  const by = operatorText('An author (--by)', addedBy);
  // xmax = 0 on the returned row means this statement inserted it.
  const { rows } = await client.query<Row & { inserted: boolean }>(
    `WITH changed AS (
       INSERT INTO app.sign_in_allowlist (email_norm, reason, added_by)
            VALUES ($1, $2, $3)
       ON CONFLICT (email_norm) DO UPDATE
              SET reason = excluded.reason, added_by = excluded.added_by, added_at = now()
         RETURNING email_norm, reason, added_by, added_at, xmax = 0 AS inserted
     ), audited AS (
       INSERT INTO app.audit_log (actor_kind, actor_label, action, target_type, target_id, outcome, reason)
       SELECT 'bootstrap', $3, 'allowlist.add', 'sign_in_allowlist', $4, 'allowed', $2 FROM changed
     )
     SELECT email_norm, reason, added_by, added_at, inserted FROM changed`,
    [emailNorm, why, by, addressRef(emailNorm)],
  );
  const row = rows[0];
  if (row === undefined) throw new Error('The allow-list insert returned no row.');
  return { entry: toEntry(row), outcome: row.inserted ? 'added' : 'updated' };
}

export type RemoveAllowlistOutcome = 'removed' | 'absent';

export interface RemoveAllowlistEntryResult {
  emailNorm: string;
  outcome: RemoveAllowlistOutcome;
  /** The row as it was, when there was one. */
  entry?: AllowlistEntry;
}

export interface RemoveAllowlistEntryOptions {
  email: string;
  /** Why the address is removed: the audit row's `reason`. Required. */
  reason: string;
  /** Who decided: the audit row's `actor_label`. Required. */
  by: string;
}

/**
 * Removes `email` (normalised) from the list, and audits it as
 * `allowlist.remove` in the same statement. Nobody is signed out by this: an
 * existing profile is never re-checked against the list (R5). Disable the
 * profile to end access.
 */
export async function removeAllowlistEntry(
  client: Queryable,
  { email, reason, by }: RemoveAllowlistEntryOptions,
): Promise<RemoveAllowlistEntryResult> {
  const emailNorm = normalizeEmail(email);
  const why = operatorText('A reason (--reason)', reason);
  const author = operatorText('An author (--by)', by);
  const { rows } = await client.query<Row>(
    `WITH changed AS (
       DELETE FROM app.sign_in_allowlist WHERE email_norm = $1
        RETURNING email_norm, reason, added_by, added_at
     ), audited AS (
       INSERT INTO app.audit_log (actor_kind, actor_label, action, target_type, target_id, outcome, reason)
       SELECT 'bootstrap', $3, 'allowlist.remove', 'sign_in_allowlist', $4, 'allowed', $2 FROM changed
     )
     SELECT email_norm, reason, added_by, added_at FROM changed`,
    [emailNorm, why, author, addressRef(emailNorm)],
  );
  const row = rows[0];
  return row === undefined ? { emailNorm, outcome: 'absent' } : { emailNorm, outcome: 'removed', entry: toEntry(row) };
}

/** Every listed address, in address order. */
export async function listAllowlist(client: Queryable): Promise<AllowlistEntry[]> {
  const { rows } = await client.query<Row>(
    `SELECT email_norm, reason, added_by, added_at FROM app.sign_in_allowlist ORDER BY email_norm`,
  );
  return rows.map(toEntry);
}
