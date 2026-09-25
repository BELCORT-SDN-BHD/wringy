// A deliberate dependency-direction violation (M2-02 R17).
//
// scripts/check-dependency-direction.mjs copies this file to
// apps/web/src/app/(internal)/internal/__dependency-violation__.ts, runs
// dependency-cruiser, asserts that the rule `supabase-client-only-in-auth-lib`
// rejects it, and deletes the copy. It is never compiled or shipped from this
// folder.
//
// This is the shape the rule exists to stop: a second place in apps/web that can
// create a Supabase client. Here it is a Server-Component-adjacent file, which is
// the dangerous case — a page cannot set cookies, so a refresh there would lose
// the rotated refresh token.
import { createServerClient } from '@supabase/ssr';

export const leakedClientFactory = createServerClient;
