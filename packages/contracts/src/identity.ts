import { z } from 'zod';

import { instantSchema } from './common';

/**
 * A profile's operational state (M2-02 R4; ruling D12). `disabled` is the one
 * lever an operator has: every authenticated request from a disabled profile is
 * refused with 403 `account.disabled`. Removing an address from the sign-in
 * allow-list signs nobody out; disabling the profile does.
 */
export const PROFILE_STATUSES = ['active', 'disabled'] as const;
export const profileStatusSchema = z.enum(PROFILE_STATUSES);
export type ProfileStatus = z.output<typeof profileStatusSchema>;

/**
 * The three languages the internal build resolves and renders (M2-04 R2;
 * localization-v1). `en-MY`, `ms-MY` and `zh-Hans-MY` are the only codes a
 * person can choose; there is no `en`, no regionless `zh`, and Traditional
 * Chinese (`zh-Hant-MY`) is not offered.
 */
export const LOCALES = ['en-MY', 'ms-MY', 'zh-Hans-MY'] as const;
export const localeSchema = z.enum(LOCALES);
export type Locale = z.output<typeof localeSchema>;

/**
 * The signed-in person, as the API is willing to say it. The schema is the
 * allow-list: a field not named here never leaves the API, because `z.object`
 * strips unknown keys. `id` is the verified token subject (`sub`), never an
 * email. `contactEmail` is the verified address, refreshed at each sign-in and
 * used for notifications; `displayName` comes from the provider's profile and is
 * for display only. `localePref` is the person's explicit language choice, or
 * null when they have never made one; `localePrefSetAt` is the database instant
 * it was last set. The pair is always both null or both set (migration 0017's
 * CHECK): there is no state where a preference exists without its instant.
 */
export const profileSchema = z.object({
  id: z.uuid(),
  displayName: z.string().nullable(),
  contactEmail: z.string(),
  status: profileStatusSchema,
  lastSignInAt: instantSchema,
  createdAt: instantSchema,
  localePref: localeSchema.nullable(),
  localePrefSetAt: instantSchema.nullable(),
});
export type Profile = z.output<typeof profileSchema>;

/** `POST /identity/sign-in`: the first-sign-in gate passed and the profile is current. */
export const signInResponseSchema = z.object({
  profile: profileSchema,
});
export type SignInResponse = z.output<typeof signInResponseSchema>;

/**
 * `GET /me`: the profile plus the session facts the page may show. `expiresAt` is
 * the access token's own expiry, so the page can say how long this tab stays
 * signed in without holding the token itself.
 */
export const meResponseSchema = z.object({
  profile: profileSchema,
  session: z.object({
    expiresAt: instantSchema,
  }),
});
export type MeResponse = z.output<typeof meResponseSchema>;

/**
 * `POST /me/session/probe`: the reserved fund-sensitive stub (M2-AC02/2). It
 * changes nothing and exists to prove that `requireLiveSession` runs inside the
 * command's transaction: a revoked session gets 401 `session.revoked` instead of
 * this body. `checkedAt` is the database clock at the check.
 */
export const sessionProbeResponseSchema = z.object({
  ok: z.literal(true),
  checkedAt: instantSchema,
});
export type SessionProbeResponse = z.output<typeof sessionProbeResponseSchema>;

/**
 * `POST /me/locale` (M2-04 R2): the body naming the one explicit choice a
 * signed-in person can make. Like every body in this package this is a plain
 * `z.object`, so a caller naming a `userId` or any other key changes nobody's
 * row but their own — the path to the account is the verified token, never a
 * field in the payload.
 */
export const setLocaleBodySchema = z.object({
  locale: localeSchema,
});
export type SetLocaleBody = z.output<typeof setLocaleBodySchema>;

/**
 * `POST /me/locale` (M2-04 R2): the command answers the profile as it now
 * stands, carrying the freshly written `localePref` and `localePrefSetAt` —
 * the same shape `GET /me` and `POST /identity/sign-in` answer, so a caller
 * never needs a second read to see its own write.
 */
export const setLocaleResponseSchema = z.object({
  profile: profileSchema,
});
export type SetLocaleResponse = z.output<typeof setLocaleResponseSchema>;
