import { describe, expect, it } from 'vitest';

import common from '@/messages/en-MY/common.json';
import zh from '@/messages/zh-Hans-MY/common.json';

import { reasonLabel, reconcileOutcomeLabel } from './reason-copy';

type Tree = { [key: string]: string | Tree };

/**
 * A translator over one catalogue, standing in for next-intl's `useTranslations`.
 * A missing key throws, which is what next-intl reports as MISSING_MESSAGE — so a
 * code this module claims to cover but the catalogue does not fails the test rather
 * than rendering a raw key path.
 */
function translator(catalogue: Tree) {
  return (key: string, values?: Record<string, string | number>): string => {
    let node: string | Tree | undefined = catalogue;
    for (const part of key.split('.')) {
      if (typeof node !== 'object' || node === null) node = undefined;
      else node = node[part];
    }
    if (typeof node !== 'string') throw new Error(`missing message: ${key}`);
    return node.replace(/\{(\w+)\}/g, (_match, name: string) => String(values?.[name] ?? ''));
  };
}

const t = translator(common as unknown as Tree);
const tZh = translator(zh as unknown as Tree);

describe('reasonLabel', () => {
  it('has copy for every generated code the engine records', () => {
    const codes = [
      'qualified_views_added',
      'ignored_after_metering_end',
      'read_failed_source_unreachable',
      'data_outage_started',
      'data_outage_cleared',
      'readiness_set',
      'simulated_provider_success',
      'simulated_provider_timeout',
      'payout_started',
      'partial_offer_declined',
      'connection_reconnected',
      'draft_updated',
    ];
    for (const code of codes) {
      for (const translate of [t, tZh]) {
        const label = reasonLabel(code, translate, 'en-MY');
        expect(label, code).toBeTruthy();
        // The point of the map: the code itself never reaches the page.
        expect(label, code).not.toBe(code);
      }
    }
  });

  it('keeps the engine’s own numbers inside the localized wrapper', () => {
    expect(reasonLabel('claimable:500', t, 'en-MY')).toBe('Claimable amount: RM 5.00');
    expect(reasonLabel('offer:5000/6000', t, 'en-MY')).toBe(
      'Offered RM 50.00 of RM 60.00',
    );
    expect(reasonLabel('waitlisted:6000', t, 'en-MY')).toContain('RM 60.00');
    expect(reasonLabel('post:tiktok:7400000000000000001', t, 'en-MY')).toBe(
      'Post: tiktok 7400000000000000001',
    );
    expect(reasonLabel('partial_consent:off_000015', t, 'en-MY')).toContain('off_000015');
  });

  it('localizes a reconciliation outcome and keeps the typed note verbatim', () => {
    expect(reasonLabel('confirmed_succeeded: provider statement shows the transfer', t, 'en-MY')).toBe(
      'Confirmed succeeded — provider statement shows the transfer',
    );
    expect(
      reasonLabel('still_unknown: waiting for the statement', tZh, 'zh-Hans-MY'),
    ).toBe('仍然未知 — waiting for the statement');
  });

  it('passes a person’s own words through unchanged', () => {
    // localization-v1: "用户投稿、评论、店铺描述及证据保留原文，不自动翻译或覆盖".
    const typed = 'Qualified views could not be verified in the window.';
    expect(reasonLabel(typed, t, 'en-MY')).toBe(typed);
    expect(reasonLabel(typed, tZh, 'zh-Hans-MY')).toBe(typed);
    expect(reasonLabel('off brief', t, 'en-MY')).toBe('off brief');
  });

  it('returns null when there is no reason at all', () => {
    expect(reasonLabel(null, t, 'en-MY')).toBeNull();
    expect(reasonLabel(undefined, t, 'en-MY')).toBeNull();
    expect(reasonLabel('   ', t, 'en-MY')).toBeNull();
  });
});

describe('reconcileOutcomeLabel', () => {
  it('covers the three engine outcomes in every locale', () => {
    for (const translate of [t, tZh]) {
      for (const outcome of ['still_unknown', 'confirmed_succeeded', 'confirmed_failed']) {
        const label = reconcileOutcomeLabel(outcome, translate);
        expect(label, outcome).toBeTruthy();
        expect(label, outcome).not.toBe(outcome);
      }
    }
  });
});
