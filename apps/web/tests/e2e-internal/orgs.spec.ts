/**
 * M2-AC03: organisations, memberships and invitations of the internal build, end
 * to end (docs/m2-internal/m2-03-code-review.md R13 rev 2, R17; kickoff-package.md
 * §3.3–3.5; project `orgs`).
 *
 * ── WHY EVERY TITLE HERE SAYS "simulated" ──────────────────────────────────
 * Carol, Dave, Erin and Mallory sign in through the simulated provider
 * (tests/e2e-internal/fake-auth/), for the reasons auth.spec.ts gives: these rows
 * are strong evidence about Wringy's own code — the path-scoped re-authorisation
 * on every request, the invitation's address match, the audit rows — and none
 * about Google's or Supabase's. The identity half of every row is therefore
 * labelled `simulated`. Everything else is real: `next start`, the Fastify API as
 * `wringy_api_login`, and PostgreSQL 17 migrated from zero.
 *
 * ── HOW IT RUNS ────────────────────────────────────────────────────────────
 * The `orgs` project runs this file in order in one worker, beside `auth` (it
 * never signs Alice or Bob in). The people are fixed identities, so their
 * memberships accumulate over the file and across a retry: every row arranges
 * its OWN organisations under names made unique by the test's tag, takes every
 * id from the URL a redirect landed on, asserts workspaces with "contains" rather
 * than a count, and reads audit rows by `context_org_id` from the database time
 * the row started.
 *
 * What the rows are (R13):
 * - the dual-role walk: Carol is her own org's admin and a member of Dave's, and
 *   switches between them by URL;
 * - the refusals, each with the state the person sees AND the row PostgreSQL
 *   keeps: an outsider's over-reach, an admin form rendered before a demotion, a
 *   link opened by the wrong person, a link held by someone who cannot sign in,
 *   the last admin leaving;
 * - the copy in three languages at 1440 and 390 (the evidence frames), and every
 *   action of the admin, invitation and accept pages reached and pressed at 390
 *   and 320.
 */
import type { Locator, Page } from '@playwright/test';

import { FAKE_USERS, HEALTHY_WEB_ORIGIN, SIGN_IN_ROOT, WEB_ROUTES, expect, signInAs, test, type FakeUserName } from './fixtures';
import {
  LOCALES,
  expectNoHorizontalScroll,
  internalCopy,
  internalShot,
  setLocaleCookie,
  sql,
  watchConsole,
  type Locale,
} from './support';

const CAROL = FAKE_USERS.carol;
const DAVE = FAKE_USERS.dave;
const ERIN = FAKE_USERS.erin;
const MALLORY = FAKE_USERS.mallory;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_ONLY = new RegExp(`^${UUID}$`);

/** The accept page and its Accept form's Route Handler (src/app/(internal)/internal/org-paths.ts). */
const ACCEPT_PATH = '/internal/invitations/accept';
const ACCEPT_CONFIRM_PATH = '/internal/invitations/accept/confirm';

const orgPagePath = (orgId: string): string => `/internal/orgs/${orgId}`;

/** A suffix unique to this test and attempt: the tail of the fixture's tag, which ends in a uuid. */
const uniqueSuffix = (tag: string): string => tag.slice(-12);

/** The database's own clock, so an audit filter never depends on the test machine's. */
async function databaseNow(): Promise<Date> {
  const rows = await sql<{ now: Date }>('migrator', 'SELECT now() AS now');
  const now = rows[0]?.now;
  if (now === undefined) throw new Error('the database did not answer SELECT now()');
  return now;
}

/**
 * Signs `name` in from `start` (a page of the healthy instance, or an accept
 * link) and checks the person came back to it. An accept link's query is
 * compared, never printed: it carries the invitation token.
 */
async function signInTo(page: Page, name: FakeUserName, start = `${HEALTHY_WEB_ORIGIN}${WEB_ROUTES.internal}`): Promise<void> {
  const landed = new URL(await signInAs(page, name, { start }));
  const wanted = new URL(start);
  expect(landed.pathname, `${name} lands back on the page the sign-in started from`).toBe(wanted.pathname);
  expect(landed.search === wanted.search, `${name} keeps the query the sign-in started with`).toBe(true);
}

/** Waits for `path?outcome=<outcome>` and checks the outcome alert says it, in `locale`. */
async function expectOutcome(page: Page, path: string, outcome: string, locale: Locale = 'en-MY'): Promise<void> {
  await page.waitForURL((url) => url.pathname === path && url.searchParams.get('outcome') === outcome);
  const alert = page.getByTestId('org-outcome');
  await expect(alert).toHaveAttribute('data-outcome', outcome);
  await expect(alert).toContainText(internalCopy(locale, `outcomes.${outcome}`));
}

/** Creates an org from the Workspaces section; its id is taken from the URL the 303 landed on. */
async function createOrg(page: Page, name: string, locale: Locale = 'en-MY'): Promise<string> {
  await page.goto(WEB_ROUTES.internal);
  await page.getByTestId('create-org-name').fill(name);
  await page.getByTestId('create-org-submit').click();
  const pattern = new RegExp(`^/internal/orgs/(${UUID})$`);
  await page.waitForURL((url) => pattern.test(url.pathname) && url.searchParams.get('outcome') === 'created');
  const orgId = pattern.exec(new URL(page.url()).pathname)?.[1] ?? '';
  await expectOutcome(page, orgPagePath(orgId), 'created', locale);
  await expect(page.getByTestId('org-name')).toHaveText(name);
  await expect(page.getByTestId('org-own-role')).toHaveAttribute('data-role', 'admin');
  return orgId;
}

interface Invitation {
  id: string;
  /** The link the admin hands over. It carries the token: compared, never printed. */
  acceptUrl: string;
  token: string;
}

/** The invitation page an admin lands on after the invite form, and the link it shows. */
async function readCreatedInvitation(page: Page, orgId: string, email: string): Promise<Invitation> {
  const pattern = new RegExp(`^/internal/orgs/${orgId}/invitations/(${UUID})$`);
  await page.waitForURL((url) => pattern.test(url.pathname) && url.searchParams.get('outcome') === 'invited');
  const id = pattern.exec(new URL(page.url()).pathname)?.[1] ?? '';
  await expect(page.locator('[data-app-state="invitation-created"]')).toHaveAttribute('data-invitation-id', id);
  await expect(page.getByTestId('invitation-address')).toHaveText(email);

  const acceptUrl = await page.getByTestId('invitation-accept-link').inputValue();
  const link = new URL(acceptUrl);
  expect(link.origin, 'the link points at this build').toBe(HEALTHY_WEB_ORIGIN);
  expect(link.pathname).toBe(ACCEPT_PATH);
  const token = link.searchParams.get('token') ?? '';
  expect(/^[A-Za-z0-9_-]{43}$/.test(token), 'the link carries a 43-character token').toBe(true);
  // The token reached this page through a page-scoped cookie, never the admin's URL (R7, R9).
  expect(page.url().includes(token), "the admin's own URL does not carry the token").toBe(false);
  return { id, acceptUrl, token };
}

/** Invites `email` through the org page's form (the admin must be signed in on `page`). */
async function invite(page: Page, orgId: string, email: string, role: 'admin' | 'member'): Promise<Invitation> {
  await page.goto(orgPagePath(orgId));
  await page.getByTestId('invite-email').fill(email);
  await page.getByTestId('invite-role').selectOption(role);
  await page.getByTestId('invite-submit').click();
  return readCreatedInvitation(page, orgId, email);
}

/** Presses Accept on the accept page and lands on the org's page as a member of it. */
async function accept(page: Page, orgId: string, orgName: string, locale: Locale = 'en-MY'): Promise<void> {
  await expect(page.locator('[data-app-state="invitation-pending"]')).toBeVisible();
  await expect(page.getByTestId('invitation-org')).toHaveText(orgName);
  await page.getByTestId('invitation-accept-submit').click();
  await expectOutcome(page, orgPagePath(orgId), 'joined', locale);
  await expect(page.getByTestId('org-name')).toHaveText(orgName);
}

/**
 * Starts collecting the Referer of every request `page` sends; the returned
 * function resolves to them once every request seen so far has reported its
 * headers. R7 and R9 (rev 3): a Referer may carry an origin, never a path or a
 * query — so never the invitation token, whether in the accept page's own query
 * or inside the sign-in page's `next`.
 */
function watchReferers(page: Page): () => Promise<string[]> {
  const pending: Array<Promise<string | undefined>> = [];
  page.on('request', (request) => {
    pending.push(
      request
        .allHeaders()
        .then((headers) => headers['referer'])
        .catch(() => undefined),
    );
  });
  return async () => (await Promise.all(pending)).filter((referer): referer is string => referer !== undefined);
}

/** The row of `userId` in the org page's members table. */
const memberRow = (page: Page, userId: string): Locator =>
  page.getByTestId('org-members-table').locator(`[data-member-id="${userId}"]`);

/** Scrolls an action into view, checks the viewport shows it, and presses it (R13's 390/320 rule). */
async function reachAndPress(action: Locator): Promise<void> {
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeInViewport();
  await action.click();
}

interface AuditRow {
  recorded_by: string;
  actor_kind: string;
  actor_user_id: string | null;
  context_org_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  outcome: 'allowed' | 'denied';
  denial_code: string | null;
  reason: string | null;
  request_id: string | null;
  session_ref: string | null;
}

/** One org's audit rows written since `since`, oldest first, with one outcome. */
function auditRows(orgId: string, since: Date, outcome: 'allowed' | 'denied'): Promise<AuditRow[]> {
  return sql<AuditRow>(
    'migrator',
    `SELECT recorded_by::text AS recorded_by, actor_kind, actor_user_id, context_org_id, action, target_type, target_id,
            outcome, denial_code, reason, request_id, session_ref
       FROM app.audit_log
      WHERE context_org_id = $1 AND occurred_at >= $2 AND outcome = $3
      ORDER BY id`,
    [orgId, since, outcome],
  );
}

/**
 * A denial row as R3 and R11 shape it: written by the API's login for a signed-in
 * person, correlated by a UUID request id and a pseudonymous session reference,
 * and carrying no address.
 */
function expectDenial(row: AuditRow | undefined, expected: Partial<AuditRow>): void {
  expect(row, 'a denial row was written').toBeDefined();
  expect(row).toMatchObject({ recorded_by: 'wringy_api_login', actor_kind: 'user', outcome: 'denied', ...expected });
  expect(row?.request_id ?? '').toMatch(UUID_ONLY);
  expect(row?.session_ref ?? '').toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(row).includes('@'), 'the audit row carries no address').toBe(false);
}

interface MembershipRow {
  role: string;
  status: string;
  grant_basis: string;
  invitation_id: string | null;
  granted_by: string;
}

/** The membership row of `userId` in `orgId`, active or removed; `undefined` when none was ever written. */
async function membershipOf(orgId: string, userId: string): Promise<MembershipRow | undefined> {
  const rows = await sql<MembershipRow>(
    'migrator',
    'SELECT role, status, grant_basis, invitation_id, granted_by FROM app.org_members WHERE org_id = $1 AND user_id = $2',
    [orgId, userId],
  );
  return rows[0];
}

async function invitationStatus(invitationId: string): Promise<string | undefined> {
  const rows = await sql<{ status: string }>('migrator', 'SELECT status FROM app.org_invitations WHERE id = $1', [invitationId]);
  return rows[0]?.status;
}

async function orgName(orgId: string): Promise<string | undefined> {
  const rows = await sql<{ name: string }>('migrator', 'SELECT name FROM app.orgs WHERE id = $1', [orgId]);
  return rows[0]?.name;
}

test.describe('M2-AC03 organisations: one person in two workspaces, and every refusal on the record', () => {
  test("M2-AC03/1 M2-AC03/2 simulated dual-role walk: Carol creates her org, joins Dave's by invitation and switches between the two by URL", async ({
    tagged,
    tag,
    openDevice,
  }) => {
    test.setTimeout(90_000);
    const suffix = uniqueSuffix(tag);
    const carol = tagged.page;
    const problems = watchConsole(carol);
    const since = await databaseNow();

    // Carol signs in: her personal workspace first, and the form that makes her an admin.
    await signInTo(carol, 'carol');
    await expect(carol.getByTestId('workspace-list').locator('[data-workspace="personal"]')).toBeVisible();
    const nameA = `Carol Studio ${suffix}`;
    const orgA = await createOrg(carol, nameA);

    // Dave, on his own device, creates B and invites Carol's address as a member.
    const dave = await openDevice('dave');
    await signInTo(dave.page, 'dave');
    const nameB = `Dave Retail ${suffix}`;
    const orgB = await createOrg(dave.page, nameB);
    const invitation = await invite(dave.page, orgB, CAROL.email, 'member');

    // Carol is signed in, so the link opens straight on the preview: B, the role, the expiry.
    await carol.goto(invitation.acceptUrl);
    const preview = carol.locator('[data-app-state="invitation-pending"]');
    await expect(preview).toContainText(nameB);
    await expect(preview.locator('[data-state-kind="role"]')).toHaveAttribute('data-state-code', 'member');
    await accept(carol, orgB, nameB);

    // In B she is a member: no admin form, no invitations, no address of anybody.
    await expect(carol.getByTestId('org-own-role')).toHaveAttribute('data-role', 'member');
    await expect(carol.getByTestId('invite-email')).toHaveCount(0);
    await expect(carol.getByTestId('rename-name')).toHaveCount(0);
    await expect(carol.getByTestId('org-invitations-table')).toHaveCount(0);
    await expect(carol.getByTestId('member-remove-submit')).toHaveCount(0);
    await expect(memberRow(carol, DAVE.id)).toContainText(DAVE.fullName);
    await expect(memberRow(carol, CAROL.id)).toHaveAttribute('data-member-self', 'true');
    expect(await carol.getByTestId('org-members-table').innerText()).not.toContain('@');

    // Both workspaces are listed; switching is following a link, re-authorised by the path.
    await carol.goto(WEB_ROUTES.internal);
    const rowA = carol.locator(`[data-workspace="org"][data-org-id="${orgA}"]`);
    const rowB = carol.locator(`[data-workspace="org"][data-org-id="${orgB}"]`);
    await expect(rowA.getByTestId('workspace-org-link')).toHaveText(nameA);
    await expect(rowA.locator('[data-state-kind="role"]')).toHaveAttribute('data-state-code', 'admin');
    await expect(rowB.getByTestId('workspace-org-link')).toHaveText(nameB);
    await expect(rowB.locator('[data-state-kind="role"]')).toHaveAttribute('data-state-code', 'member');

    await rowA.getByTestId('workspace-org-link').click();
    await carol.waitForURL((url) => url.pathname === orgPagePath(orgA));
    await expect(carol.getByTestId('org-name')).toHaveText(nameA);
    await expect(carol.getByTestId('org-own-role')).toHaveAttribute('data-role', 'admin');
    await expect(carol.getByTestId('invite-email')).toBeVisible();

    await carol.goto(orgPagePath(orgB));
    await expect(carol.getByTestId('org-name')).toHaveText(nameB);
    await expect(carol.getByTestId('org-own-role')).toHaveAttribute('data-role', 'member');
    await expect(carol.getByTestId('invite-email')).toHaveCount(0);

    // PostgreSQL: A's membership is its creator's; B's is backed by the accepted invitation.
    expect(await membershipOf(orgA, CAROL.id)).toEqual({
      role: 'admin',
      status: 'active',
      grant_basis: 'org_created',
      invitation_id: null,
      granted_by: CAROL.id,
    });
    expect(await membershipOf(orgB, CAROL.id)).toEqual({
      role: 'member',
      status: 'active',
      grant_basis: 'invitation',
      invitation_id: invitation.id,
      granted_by: DAVE.id,
    });
    expect(await invitationStatus(invitation.id)).toBe('accepted');
    const orgs = await sql<{ id: string; data_origin: string; created_by: string }>(
      'migrator',
      'SELECT id, data_origin, created_by FROM app.orgs WHERE id = ANY($1::uuid[])',
      [[orgA, orgB]],
    );
    expect(orgs).toHaveLength(2);
    expect(orgs).toEqual(
      expect.arrayContaining([
        { id: orgA, data_origin: 'live', created_by: CAROL.id },
        { id: orgB, data_origin: 'live', created_by: DAVE.id },
      ]),
    );

    // Every change is on the record, by the person who made it; nothing was refused.
    const allowedA = await auditRows(orgA, since, 'allowed');
    const allowedB = await auditRows(orgB, since, 'allowed');
    expect(allowedA.map((row) => [row.action, row.actor_user_id])).toEqual([['org.create', CAROL.id]]);
    expect(allowedB.map((row) => [row.action, row.actor_user_id])).toEqual([
      ['org.create', DAVE.id],
      ['invitation.create', DAVE.id],
      ['invitation.accept', CAROL.id],
    ]);
    expect(await auditRows(orgA, since, 'denied')).toEqual([]);
    expect(await auditRows(orgB, since, 'denied')).toEqual([]);
    const recorded = JSON.stringify([...allowedA, ...allowedB]);
    expect(recorded.includes(invitation.token), 'no audit row carries the invitation token').toBe(false);
    expect(recorded.includes('@'), 'no audit row carries an address').toBe(false);

    expect(problems).toEqual([]);
  });

  test("M2-AC03/2 M2-AC03/3 simulated over-reach: Erin, in neither org, opens and posts to org A's URL, is refused, and each refusal is audited", async ({
    tagged,
    tag,
    openDevice,
  }) => {
    test.setTimeout(90_000);
    const carol = tagged.page;
    await signInTo(carol, 'carol');
    const nameA = `Carol Over-reach ${uniqueSuffix(tag)}`;
    const orgA = await createOrg(carol, nameA);
    const since = await databaseNow();

    const erin = await openDevice('erin');
    await signInTo(erin.page, 'erin');

    // A read: the page renders the forbidden state in place, and nothing of A.
    await erin.page.goto(orgPagePath(orgA));
    await expect(erin.page.locator('[data-app-state="org-forbidden"]')).toBeVisible();
    expect(new URL(erin.page.url()).pathname, 'the URL stays, so the tab says plainly it has no access').toBe(orgPagePath(orgA));
    await expect(erin.page.getByTestId('org-name')).toHaveCount(0);
    await expect(erin.page.getByTestId('org-members-table')).toHaveCount(0);
    expect(await erin.page.locator('body').innerText()).not.toContain(nameA);

    // A write she has no form for: the Route Handler forwards it, the API refuses it.
    const rename = await erin.context.request.post(`${HEALTHY_WEB_ORIGIN}${orgPagePath(orgA)}/rename`, {
      headers: { origin: HEALTHY_WEB_ORIGIN },
      form: { name: 'Taken over' },
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(rename.status()).toBe(303);
    const renamedTo = new URL(rename.headers()['location'] ?? '', HEALTHY_WEB_ORIGIN);
    expect(`${renamedTo.pathname}${renamedTo.search}`).toBe(`${orgPagePath(orgA)}?outcome=forbidden`);

    // An org that does not exist gets the very same answer: no existence oracle.
    const unknownOrg = crypto.randomUUID();
    await erin.page.goto(orgPagePath(unknownOrg));
    await expect(erin.page.locator('[data-app-state="org-forbidden"]')).toBeVisible();

    // A is unchanged, and Erin holds nothing in it.
    expect(await orgName(orgA)).toBe(nameA);
    expect(await membershipOf(orgA, ERIN.id)).toBeUndefined();

    // One denial row per refusal, each correlated and carrying no secret.
    const denied = await auditRows(orgA, since, 'denied');
    expect(denied).toHaveLength(2);
    expectDenial(denied[0], {
      actor_user_id: ERIN.id,
      context_org_id: orgA,
      action: 'org.read',
      denial_code: 'org.forbidden',
      reason: 'not_a_member',
    });
    expectDenial(denied[1], {
      actor_user_id: ERIN.id,
      context_org_id: orgA,
      action: 'org.rename',
      denial_code: 'org.forbidden',
      reason: 'not_a_member',
    });
    expect(denied[0]?.request_id).not.toBe(denied[1]?.request_id);
    const [unknown] = await auditRows(unknownOrg, since, 'denied');
    expectDenial(unknown, {
      actor_user_id: ERIN.id,
      context_org_id: unknownOrg,
      action: 'org.read',
      denial_code: 'org.forbidden',
      reason: 'org_unknown',
    });
  });

  test('M2-AC03/2 simulated stale write: an invite form Carol rendered as admin is refused after Dave demotes her on another device', async ({
    tagged,
    tag,
    openDevice,
  }) => {
    test.setTimeout(90_000);
    const carol = tagged.page;
    await signInTo(carol, 'carol');
    const nameA = `Carol Stale ${uniqueSuffix(tag)}`;
    const orgA = await createOrg(carol, nameA);

    // Dave joins A as a second admin, signing in from the link on his own device.
    const invitation = await invite(carol, orgA, DAVE.email, 'admin');
    const dave = await openDevice('dave');
    await signInTo(dave.page, 'dave', invitation.acceptUrl);
    await accept(dave.page, orgA, nameA);
    await expect(dave.page.getByTestId('org-own-role')).toHaveAttribute('data-role', 'admin');

    // Carol's admin page of A is open, its invite form rendered while she was an admin.
    await carol.goto(orgPagePath(orgA));
    await expect(carol.getByTestId('org-own-role')).toHaveAttribute('data-role', 'admin');
    await expect(carol.getByTestId('invite-email')).toBeVisible();
    const since = await databaseNow();

    // Dave demotes her.
    await dave.page.goto(orgPagePath(orgA));
    await memberRow(dave.page, CAROL.id).getByTestId('member-role-select').selectOption('member');
    await memberRow(dave.page, CAROL.id).getByTestId('member-role-submit').click();
    await expectOutcome(dave.page, orgPagePath(orgA), 'role_changed');
    await expect(memberRow(dave.page, CAROL.id).locator('[data-state-kind="role"]')).toHaveAttribute('data-state-code', 'member');

    // Carol submits the form she still sees: the API re-reads her role under the org lock.
    await carol.getByTestId('invite-email').fill(ERIN.email);
    await carol.getByTestId('invite-submit').click();
    await expectOutcome(carol, orgPagePath(orgA), 'admin_required');
    await expect(carol.getByTestId('org-own-role')).toHaveAttribute('data-role', 'member');
    await expect(carol.getByTestId('invite-email')).toHaveCount(0);

    // A is unchanged: no invitation for the address, Carol a member as Dave left her.
    const invitations = await sql<{ count: string }>(
      'migrator',
      'SELECT count(*)::text AS count FROM app.org_invitations WHERE org_id = $1 AND invitee_email_norm = $2',
      [orgA, ERIN.email],
    );
    expect(invitations).toEqual([{ count: '0' }]);
    expect((await membershipOf(orgA, CAROL.id))?.role).toBe('member');
    expect(await orgName(orgA)).toBe(nameA);

    const denied = await auditRows(orgA, since, 'denied');
    expect(denied).toHaveLength(1);
    expectDenial(denied[0], {
      actor_user_id: CAROL.id,
      context_org_id: orgA,
      action: 'invitation.create',
      denial_code: 'org.admin_required',
      reason: 'admin_required',
    });
    const allowed = await auditRows(orgA, since, 'allowed');
    expect(allowed.map((row) => [row.action, row.actor_user_id, row.target_id])).toEqual([['member.role_change', DAVE.id, CAROL.id]]);
  });

  test('M2-AC03/3 simulated wrong recipient: Erin opens a link sent to Carol, learns only that it was sent elsewhere, and her Accept is refused', async ({
    tagged,
    tag,
    openDevice,
  }) => {
    test.setTimeout(90_000);
    const dave = tagged.page;
    await signInTo(dave, 'dave');
    const nameC = `Dave Wrong Link ${uniqueSuffix(tag)}`;
    const orgC = await createOrg(dave, nameC);
    const invitation = await invite(dave, orgC, CAROL.email, 'member');
    const since = await databaseNow();

    // Erin signs in from the link: the page says it was sent elsewhere, and nothing more.
    const erin = await openDevice('erin');
    await signInTo(erin.page, 'erin', invitation.acceptUrl);
    await expect(erin.page.locator('[data-app-state="invitation-mismatch"]')).toBeVisible();
    await expect(erin.page.getByTestId('invitation-accept-submit')).toHaveCount(0);
    await expect(erin.page.getByTestId('invitation-sign-out')).toBeVisible();
    const shown = await erin.page.locator('body').innerText();
    expect(shown).not.toContain(nameC);
    expect(shown).not.toContain(CAROL.email);

    // An Accept she crafts anyway reaches the API, which checks the verified address.
    const accepted = await erin.context.request.post(`${HEALTHY_WEB_ORIGIN}${ACCEPT_CONFIRM_PATH}`, {
      headers: { origin: HEALTHY_WEB_ORIGIN },
      form: { token: invitation.token },
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(accepted.status()).toBe(303);
    const landing = new URL(accepted.headers()['location'] ?? '', HEALTHY_WEB_ORIGIN);
    expect(`${landing.pathname}${landing.search}`).toBe(`${WEB_ROUTES.internal}?outcome=invitation_mismatch`);
    await erin.page.goto(landing.toString());
    await expectOutcome(erin.page, WEB_ROUTES.internal, 'invitation_mismatch');

    // Nothing was granted and the link is still Carol's to use.
    expect(await membershipOf(orgC, ERIN.id)).toBeUndefined();
    expect(await invitationStatus(invitation.id)).toBe('pending');
    const denied = await auditRows(orgC, since, 'denied');
    expect(denied).toHaveLength(1);
    expectDenial(denied[0], {
      actor_user_id: ERIN.id,
      context_org_id: orgC,
      action: 'invitation.accept',
      target_type: 'org_invitation',
      target_id: invitation.id,
      denial_code: 'invitation.email_mismatch',
      reason: 'email_mismatch',
    });
    expect(JSON.stringify(denied).includes(invitation.token), 'the denial row carries no token').toBe(false);

    // Carol, signed out, opens the link: the sign-in detour carries it in `next`, the accept
    // page in its query. No request from either page says more than the origin in its Referer.
    const carol = await openDevice('carol');
    const referers = watchReferers(carol.page);
    await signInTo(carol.page, 'carol', invitation.acceptUrl);
    await accept(carol.page, orgC, nameC);
    expect((await membershipOf(orgC, CAROL.id))?.grant_basis).toBe('invitation');
    const sent = await referers();
    const fromThisBuild = sent.filter((referer) => new URL(referer).origin === HEALTHY_WEB_ORIGIN);
    expect(fromThisBuild.length, 'the pages sent requests with a Referer').toBeGreaterThan(0);
    for (const referer of sent) {
      expect(referer.includes(invitation.token), 'no Referer carries the invitation token').toBe(false);
    }
    for (const referer of fromThisBuild) {
      const url = new URL(referer);
      expect(`${url.pathname}${url.search}`, 'a Referer from this build is its origin only').toBe('/');
    }
  });

  test('M2-AC03/1 simulated not allow-listed: Mallory holds a link but cannot sign in, so no membership is written', async ({
    tagged,
    tag,
    openDevice,
  }) => {
    test.setTimeout(90_000);
    const dave = tagged.page;
    await signInTo(dave, 'dave');
    const nameD = `Dave Allow-list ${uniqueSuffix(tag)}`;
    const orgD = await createOrg(dave, nameD);
    // The admin is told an invitation does not open the build to anybody (R17).
    await expect(dave.getByTestId('invite-sign-in-note')).toHaveText(internalCopy('en-MY', 'org.invite.signInNote'));
    const invitation = await invite(dave, orgD, MALLORY.email, 'member');

    const mallory = await openDevice('mallory');
    await signInAs(mallory.page, 'mallory', { start: invitation.acceptUrl });
    const landed = new URL(mallory.page.url());
    expect(landed.pathname).toBe(WEB_ROUTES.signInPage);
    expect(landed.searchParams.get('outcome')).toBe('not_allowed');
    await expect(mallory.page.locator(SIGN_IN_ROOT)).toHaveAttribute('data-outcome', 'not_allowed');
    const shown = await mallory.page.locator('body').innerText();
    expect(shown).not.toContain(nameD);
    expect(shown).not.toContain(MALLORY.email);

    // No profile, no membership, and the invitation still pending.
    expect(await sql('migrator', 'SELECT 1 FROM app.profiles WHERE id = $1', [MALLORY.id])).toEqual([]);
    expect(await membershipOf(orgD, MALLORY.id)).toBeUndefined();
    expect(await invitationStatus(invitation.id)).toBe('pending');
  });

  test('M2-AC03/1 simulated last admin: Dave cannot leave his org while he is its only admin', async ({ tagged, tag }) => {
    const dave = tagged.page;
    await signInTo(dave, 'dave');
    const orgE = await createOrg(dave, `Dave Solo ${uniqueSuffix(tag)}`);
    const since = await databaseNow();

    await dave.getByTestId('leave-submit').click();
    await expectOutcome(dave, orgPagePath(orgE), 'last_admin');
    await expect(dave.getByTestId('org-own-role')).toHaveAttribute('data-role', 'admin');

    expect(await membershipOf(orgE, DAVE.id)).toMatchObject({ role: 'admin', status: 'active' });
    const denied = await auditRows(orgE, since, 'denied');
    expect(denied).toHaveLength(1);
    expectDenial(denied[0], {
      actor_user_id: DAVE.id,
      context_org_id: orgE,
      action: 'member.leave',
      denial_code: 'org.last_admin',
      reason: 'last_admin',
    });
  });
});

/**
 * The organisation pages in the three locales, switched through the
 * `wringy-locale` cookie as auth.spec.ts does, at 1440 and 390. These rows also
 * take the M2-AC03 evidence frames: the Workspaces section, the invitation page,
 * the accept page, the org page as a member and as an admin (with another member
 * and a pending invitation), and the forbidden state.
 */
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`M2-AC03 the organisation pages in three languages at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const locale of LOCALES) {
      test(`M2-AC03/1 simulated three languages: the workspaces, invitation, accept, org and forbidden pages speak ${locale} at ${viewport.width}px`, async ({
        tagged,
        tag,
        openDevice,
        baseURL,
      }) => {
        test.setTimeout(120_000);
        const copy = (key: string): string => internalCopy(locale, key);
        const carol = tagged.page;
        await setLocaleCookie(carol, locale, baseURL);
        await signInTo(carol, 'carol');
        await expect(carol.locator('html')).toHaveAttribute('lang', locale);

        const workspaces = carol.locator('[data-internal-section="workspaces"]');
        await expect(workspaces.locator('h2')).toHaveText(copy('workspaces.title'));
        await expect(workspaces).toContainText(copy('workspaces.personal'));
        await expect(carol.getByTestId('create-org-submit')).toHaveText(copy('workspaces.create.submit'));
        await workspaces.scrollIntoViewIfNeeded();
        await internalShot(carol, `workspaces-${locale}`);

        const name = `Kedai ${locale} ${uniqueSuffix(tag)}`;
        const orgA = await createOrg(carol, name, locale);

        // The invitation page, in the admin's language.
        await carol.getByTestId('invite-email').fill(DAVE.email);
        await carol.getByTestId('invite-submit').click();
        const invitation = await readCreatedInvitation(carol, orgA, DAVE.email);
        await expect(carol.getByTestId('org-outcome')).toContainText(copy('outcomes.invited'));
        await expect(carol.locator('[data-app-state="invitation-created"] h1')).toHaveText(copy('invitations.created.title'));
        await internalShot(carol, `invitation-${locale}`);

        // The accept page and the org page as a member, in the invitee's language.
        const dave = await openDevice('dave');
        await setLocaleCookie(dave.page, locale, baseURL);
        await signInTo(dave.page, 'dave', invitation.acceptUrl);
        await expect(dave.page.locator('html')).toHaveAttribute('lang', locale);
        await expect(dave.page.locator('[data-app-state="invitation-pending"] h1')).toHaveText(
          copy('invitations.accept.title').replace('{org}', name),
        );
        await expect(dave.page.getByTestId('invitation-accept-submit')).toHaveText(copy('invitations.accept.submit'));
        await internalShot(dave.page, `accept-invitation-${locale}`);
        await accept(dave.page, orgA, name, locale);
        await expect(dave.page.locator('#org-members-title')).toHaveText(copy('org.members.title'));
        await expect(dave.page.locator('#org-leave-title')).toHaveText(copy('org.leave.title'));
        await expect(dave.page.getByTestId('org-own-role')).toContainText(copy('role.member'));
        await internalShot(dave.page, `org-member-${locale}`);

        // The org page as its admin, with another member and a pending invitation.
        await invite(carol, orgA, ERIN.email, 'member');
        await carol.goto(orgPagePath(orgA));
        await expect(carol.locator('#org-members-title')).toHaveText(copy('org.members.title'));
        await expect(carol.locator('#org-invite-title')).toHaveText(copy('org.invite.title'));
        await expect(carol.locator('#org-rename-title')).toHaveText(copy('org.rename.title'));
        await expect(carol.getByTestId('invite-sign-in-note')).toHaveText(copy('org.invite.signInNote'));
        await expect(carol.getByTestId('org-invitations-table').locator('[data-invitation-id]')).toHaveCount(1);
        await expect(memberRow(carol, DAVE.id).getByTestId('member-remove-submit')).toHaveText(copy('org.members.remove'));
        await internalShot(carol, `org-admin-${locale}`);

        // An outsider's forbidden state, in her language.
        const erin = await openDevice('erin');
        await setLocaleCookie(erin.page, locale, baseURL);
        await signInTo(erin.page, 'erin');
        await erin.page.goto(orgPagePath(orgA));
        await expect(erin.page.locator('[data-app-state="org-forbidden"]')).toContainText(copy('org.forbidden.title'));
        await expect(erin.page.getByTestId('org-forbidden-back')).toHaveText(copy('org.forbidden.back'));
        await internalShot(erin.page, `org-forbidden-${locale}`);
      });
    }
  });
}

/**
 * Every action of the admin page (with another member and a pending
 * invitation), of the invitation page and of the accept page, at the two narrow
 * viewports M1 is held to (390 and 320; G14, ruling D26): scrolled into view,
 * seen in the viewport, pressed, and the page never scrolls sideways.
 * `openDevice` takes the describe's viewport, so the invitee's phone is the same
 * size as the admin's.
 */
for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test.describe(`M2-AC03 the organisation pages' actions at ${viewport.width}px`, () => {
    test.use({ viewport });

    test(`M2-AC03/1 simulated narrow screen: every action on the admin, invitation and accept pages is reached and pressed at ${viewport.width}px`, async ({
      tagged,
      tag,
      openDevice,
    }) => {
      test.setTimeout(120_000);
      const carol = tagged.page;
      await signInTo(carol, 'carol');
      await expectNoHorizontalScroll(carol);
      const name = `Narrow ${viewport.width} ${uniqueSuffix(tag)}`;
      const orgA = await createOrg(carol, name);
      await expectNoHorizontalScroll(carol);

      // The invitation page: the link to copy and the way back.
      await carol.getByTestId('invite-email').fill(DAVE.email);
      await reachAndPress(carol.getByTestId('invite-submit'));
      const forDave = await readCreatedInvitation(carol, orgA, DAVE.email);
      await expectNoHorizontalScroll(carol);
      await reachAndPress(carol.getByTestId('invitation-accept-link'));
      await reachAndPress(carol.getByTestId('invitation-back'));
      await carol.waitForURL((url) => url.pathname === orgPagePath(orgA));

      // "Back" is a soft navigation: the org page now lives in the invitation page's
      // document, so its forms post under that page's referrer policy. They must still
      // send a real Origin (R9 rev 3): the rename is submitted here, with no reload first.
      await expect(carol.getByTestId('org-name')).toHaveText(name);
      await carol.getByTestId('rename-name').fill(`${name} renamed`);
      await reachAndPress(carol.getByTestId('rename-submit'));
      await expectOutcome(carol, orgPagePath(orgA), 'renamed');
      await expect(carol.getByTestId('org-name')).toHaveText(`${name} renamed`);
      await expectNoHorizontalScroll(carol);

      // The accept page, on Dave's phone.
      const dave = await openDevice('dave');
      await signInTo(dave.page, 'dave', forDave.acceptUrl);
      await expect(dave.page.locator('[data-app-state="invitation-pending"]')).toBeVisible();
      await expectNoHorizontalScroll(dave.page);
      await reachAndPress(dave.page.getByTestId('invitation-accept-submit'));
      await expectOutcome(dave.page, orgPagePath(orgA), 'joined');
      await expectNoHorizontalScroll(dave.page);

      // The admin page with another member and a pending invitation.
      const forErin = await invite(carol, orgA, ERIN.email, 'member');
      await carol.goto(orgPagePath(orgA));
      await expect(carol.locator(`[data-invitation-id="${forErin.id}"]`)).toBeVisible();
      await expectNoHorizontalScroll(carol);

      await memberRow(carol, DAVE.id).getByTestId('member-role-select').selectOption('admin');
      await reachAndPress(memberRow(carol, DAVE.id).getByTestId('member-role-submit'));
      await expectOutcome(carol, orgPagePath(orgA), 'role_changed');
      await expect(memberRow(carol, DAVE.id).locator('[data-state-kind="role"]')).toHaveAttribute('data-state-code', 'admin');
      await expectNoHorizontalScroll(carol);

      await reachAndPress(carol.locator(`[data-invitation-id="${forErin.id}"]`).getByTestId('invitation-revoke-submit'));
      await expectOutcome(carol, orgPagePath(orgA), 'revoked');
      await expect(carol.locator(`[data-invitation-id="${forErin.id}"]`)).toHaveCount(0);
      await expectNoHorizontalScroll(carol);

      await carol.getByTestId('invite-email').fill(ERIN.email);
      await reachAndPress(carol.getByTestId('invite-submit'));
      await readCreatedInvitation(carol, orgA, ERIN.email);
      await carol.goto(orgPagePath(orgA));

      await reachAndPress(memberRow(carol, DAVE.id).getByTestId('member-remove-submit'));
      await expectOutcome(carol, orgPagePath(orgA), 'member_removed');
      await expect(memberRow(carol, DAVE.id)).toHaveCount(0);
      await expectNoHorizontalScroll(carol);

      // Carol is the only admin again, so leaving is refused, and the refusal fits too.
      await reachAndPress(carol.getByTestId('leave-submit'));
      await expectOutcome(carol, orgPagePath(orgA), 'last_admin');
      await expectNoHorizontalScroll(carol);
    });
  });
}
