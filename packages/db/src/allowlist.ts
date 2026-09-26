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
 */
import type pg from 'pg';

type Queryable = Pick<pg.ClientBase, 'query'>;

/** The address could not be put in a normal form (see `normalizeEmail`). */
export class InvalidEmailError extends Error {
  override readonly name = 'InvalidEmailError';
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
  /** Why this address may sign in. Required: the row is the audit until M2-03. */
  reason: string;
  /** Who decided. Required, for the same reason. */
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
 * already listed. Runs as the migrator; the API has SELECT only.
 */
export async function addAllowlistEntry(
  client: Queryable,
  { email, reason, addedBy }: AddAllowlistEntryOptions,
): Promise<AddAllowlistEntryResult> {
  const emailNorm = normalizeEmail(email);
  if (reason.trim() === '') throw new InvalidEmailError('A reason is required for an allow-list entry.');
  if (addedBy.trim() === '') throw new InvalidEmailError('An author (--by) is required for an allow-list entry.');
  // xmax = 0 on the returned row means this statement inserted it.
  const { rows } = await client.query<Row & { inserted: boolean }>(
    `INSERT INTO app.sign_in_allowlist (email_norm, reason, added_by)
          VALUES ($1, $2, $3)
     ON CONFLICT (email_norm) DO UPDATE
            SET reason = excluded.reason, added_by = excluded.added_by, added_at = now()
       RETURNING email_norm, reason, added_by, added_at, xmax = 0 AS inserted`,
    [emailNorm, reason.trim(), addedBy.trim()],
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

/**
 * Removes `email` (normalised) from the list. Nobody is signed out by this: an
 * existing profile is never re-checked against the list (R5). Disable the
 * profile to end access.
 */
export async function removeAllowlistEntry(
  client: Queryable,
  { email }: { email: string },
): Promise<RemoveAllowlistEntryResult> {
  const emailNorm = normalizeEmail(email);
  const { rows } = await client.query<Row>(
    `DELETE FROM app.sign_in_allowlist WHERE email_norm = $1
      RETURNING email_norm, reason, added_by, added_at`,
    [emailNorm],
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
