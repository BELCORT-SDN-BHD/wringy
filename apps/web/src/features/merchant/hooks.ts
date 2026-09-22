'use client';

/**
 * React bindings for the merchant read model and the two write paths the pages
 * share (create a draft, run a campaign command).
 *
 * Every selector here returns a fresh array of fresh objects, which shallow
 * comparison cannot see through, so they all read the whole state by reference
 * through `useDemoSnapshot` and recompute inside `useMemo` — the pattern the
 * store's own documentation prescribes.
 */

import { useCallback, useMemo } from 'react';

import { useActor } from '@/store/actor';
import { useDemoSnapshot, useDispatch } from '@/store/demo-store';
import type { Command, CommandResult } from '@/domain/types';

import {
  selectMerchantCampaignReport,
  selectMerchantCampaignRows,
  selectMerchantClaims,
  selectMerchantStatusCounts,
  selectMerchantSubmissionRows,
  selectOwnCampaign,
  selectOwnSubmission,
} from './selectors';

export function useMerchantCampaignRows() {
  const state = useDemoSnapshot();
  const actor = useActor();
  return useMemo(() => selectMerchantCampaignRows(state, actor), [state, actor]);
}

export function useMerchantStatusCounts() {
  const state = useDemoSnapshot();
  const actor = useActor();
  return useMemo(() => selectMerchantStatusCounts(state, actor), [state, actor]);
}

export function useOwnCampaign(campaignId: string) {
  const state = useDemoSnapshot();
  const actor = useActor();
  return useMemo(() => selectOwnCampaign(state, actor, campaignId), [state, actor, campaignId]);
}

export function useMerchantSubmissionRows(campaignId?: string) {
  const state = useDemoSnapshot();
  const actor = useActor();
  return useMemo(
    () => selectMerchantSubmissionRows(state, actor, campaignId),
    [state, actor, campaignId],
  );
}

export function useOwnSubmission(submissionId: string) {
  const state = useDemoSnapshot();
  const actor = useActor();
  return useMemo(
    () => selectOwnSubmission(state, actor, submissionId),
    [state, actor, submissionId],
  );
}

export function useMerchantCampaignReport(campaignId: string) {
  const state = useDemoSnapshot();
  const actor = useActor();
  return useMemo(
    () => selectMerchantCampaignReport(state, actor, campaignId),
    [state, actor, campaignId],
  );
}

export function useMerchantClaims(campaignId: string) {
  const state = useDemoSnapshot();
  return useMemo(() => selectMerchantClaims(state, campaignId), [state, campaignId]);
}

/** The org the acting merchant belongs to, for the overview heading. */
export function useMerchantOrg() {
  const state = useDemoSnapshot();
  const actor = useActor();
  return useMemo(
    () => (actor.orgId === null ? null : (state.orgs[actor.orgId] ?? null)),
    [state, actor.orgId],
  );
}

export type CreateDraftResult =
  | { ok: true; campaignId: string }
  | { ok: false; code: string; detail?: string };

/**
 * Creates a draft with the approved defaults and reports the new id.
 *
 * `campaign.createDraft` mints the id inside the engine and the result carries
 * only the new state, so the id is recovered by diffing the campaign keys. That
 * is deterministic (ids come from the monotonic clock sequence) and it avoids
 * depending on the audit tail, which a later engine change could reorder.
 */
export function useCreateDraft(): (title: string, brief: string) => CreateDraftResult {
  const dispatch = useDispatch();
  const state = useDemoSnapshot();
  const actor = useActor();

  return useCallback(
    (title: string, brief: string) => {
      if (actor.orgId === null) return { ok: false as const, code: 'forbidden' };
      const before = new Set(Object.keys(state.campaigns));
      const result = dispatch({
        type: 'campaign.createDraft',
        orgId: actor.orgId,
        title,
        brief,
      });
      if (!result.ok) return { ok: false as const, code: result.code, detail: result.detail };
      const created = Object.keys(result.state.campaigns).find((id) => !before.has(id));
      if (created === undefined) return { ok: false as const, code: 'not_found' };
      return { ok: true as const, campaignId: created };
    },
    [dispatch, state.campaigns, actor.orgId],
  );
}

/**
 * Runs one campaign or review command.
 *
 * The store mints a fresh command id per call, which is exactly one per click:
 * a second click on an already-published campaign therefore reaches the engine
 * as a real second attempt and comes back as `invalid_transition`, instead of
 * replaying the first result and looking like a success.
 */
export function useMerchantCommand(): (command: Command) => CommandResult {
  const dispatch = useDispatch();
  return useCallback((command: Command) => dispatch(command), [dispatch]);
}
