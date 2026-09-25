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
 * The signed-in person, as the API is willing to say it. The schema is the
 * allow-list: a field not named here never leaves the API, because `z.object`
 * strips unknown keys. `id` is the verified token subject (`sub`), never an
 * email. `contactEmail` is the verified address, refreshed at each sign-in and
 * used for notifications; `displayName` comes from the provider's profile and is
 * for display only. Nothing here is a token, a session id or a locale decision
 * (M2-04 owns the locale as a feature; the columns exist already).
 */
export const profileSchema = z.object({
  id: z.uuid(),
  displayName: z.string().nullable(),
  contactEmail: z.string(),
  status: profileStatusSchema,
  lastSignInAt: instantSchema,
  createdAt: instantSchema,
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
