/**
 * The people the fake Supabase Auth server knows (M2-02 R15).
 *
 * Three fixed identities, because the internal suite must be able to say
 * "this is the same person as last time" across a sign-out, a second browser
 * context and a second web instance: the subject of a Supabase access token is
 * a uuid, and `app.profiles.id` is that uuid, so the uuids are constants here
 * rather than generated per run.
 *
 * `allowlisted` says whether the suite's database bootstrap lists the address
 * on `app.sign_in_allowlist` (database-server.mts seeds exactly the listed
 * ones through `allowlistAddAt`). Mallory exists to be refused: she is a
 * verified Google identity that nobody invited, which is the one case
 * `POST /identity/sign-in` answers with 403 `sign_in.not_allowed` (R5).
 *
 * The addresses use the reserved `.test` TLD (RFC 2606), so no real mailbox
 * can ever be reached from this suite.
 */

/** The three names the consent page and the control API address a user by. */
export const FAKE_USER_NAMES = ['alice', 'bob', 'mallory'] as const;
export type FakeUserName = (typeof FAKE_USER_NAMES)[number];

export interface FakeUser {
  /** The short name used in `data-testid="fake-user-<name>"` and `/_control/users/<name>/...`. */
  name: FakeUserName;
  /** The token `sub`, and therefore `app.profiles.id`. */
  id: string;
  /** The verified `email` claim, and therefore `app.profiles.contact_email`. */
  email: string;
  /** `user_metadata.full_name`, and therefore `app.profiles.display_name`. */
  fullName: string;
  /** Whether the suite seeds this address on `app.sign_in_allowlist`. */
  allowlisted: boolean;
}

export const FAKE_USERS: Readonly<Record<FakeUserName, FakeUser>> = {
  alice: {
    name: 'alice',
    id: '0a11ce00-0000-4000-8000-000000000001',
    email: 'alice@example.test',
    fullName: 'Alice Tan',
    allowlisted: true,
  },
  bob: {
    name: 'bob',
    id: '0b0bb000-0000-4000-8000-000000000002',
    email: 'bob@example.test',
    fullName: 'Bob Lim',
    allowlisted: true,
  },
  mallory: {
    // `0fa11ed0` reads as "failed": this identity is verified and still refused.
    name: 'mallory',
    id: '0fa11ed0-0000-4000-8000-000000000003',
    email: 'mallory@example.test',
    fullName: 'Mallory Ng',
    allowlisted: false,
  },
};

/** The user `name` names, or a thrown error: a typo must not silently become "nobody". */
export function fakeUser(name: string): FakeUser {
  const user = (FAKE_USERS as Record<string, FakeUser | undefined>)[name];
  if (!user) throw new Error(`the fake auth server knows no user "${name}" (it knows ${FAKE_USER_NAMES.join(', ')})`);
  return user;
}

/** The addresses the suite lists on `app.sign_in_allowlist` before the api starts. */
export function allowlistedEmails(): string[] {
  return FAKE_USER_NAMES.map((name) => FAKE_USERS[name]).filter((user) => user.allowlisted).map((user) => user.email);
}

/**
 * The publishable key the fake accepts, as `SUPABASE_PUBLISHABLE_KEY`. It is a
 * fixed literal, not a secret: the fake signs with a key pair it generates at
 * start-up and this value only has to satisfy `publishableKeySchema`
 * (`^[\w.-]{20,}$`, packages/config/src/shared.ts) so the api and the web can
 * load their configuration. No `sb_secret_…` key exists anywhere in the suite.
 */
export const FAKE_PUBLISHABLE_KEY = 'sb_publishable_fake_0123456789abcdef';

/** The request header a test stamps on its own traffic so the call counters stay per test. */
export const TEST_TAG_HEADER = 'X-Wringy-Test';
