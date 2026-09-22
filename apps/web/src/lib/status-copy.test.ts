import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LOCALES, type AuditEntry, type Locale } from '@/domain/types';

import {
  AUDIT_TARGET_GROUPS,
  STATUS_CODES,
  STATUS_GROUPS,
  auditStatusLabel,
  statusLabel,
  type CommonTranslate,
} from './status-copy';

// ---------------------------------------------------------------------------
// The catalogue, read the way `i18n/messages.test.ts` reads it
// ---------------------------------------------------------------------------

function loadCommon(locale: Locale): Record<string, unknown> {
  const path = join(process.cwd(), 'src', 'messages', locale, 'common.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}

const CATALOGUE: Record<string, Record<string, unknown>> = Object.fromEntries(
  LOCALES.map((locale) => [locale, loadCommon(locale)]),
);

function lookup(locale: Locale, key: string): unknown {
  let node: unknown = CATALOGUE[locale];
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/**
 * A `useTranslations('common')` stand-in backed by the real catalogue, so this
 * suite fails on a missing key the way next-intl's `MISSING_MESSAGE` would.
 */
function translator(locale: Locale): CommonTranslate {
  return (key, values) => {
    const raw = lookup(locale, key);
    if (typeof raw !== 'string') throw new Error(`missing common.${key} in ${locale}`);
    return raw.replace(/\{(\w+)\}/g, (_match, name: string) => {
      const value = values?.[name];
      if (value === undefined) throw new Error(`missing param ${name} for common.${key}`);
      return String(value);
    });
  };
}

const t = translator('en-MY');
const label = (value: string | null, target: AuditEntry['targetType'], locale: Locale = 'en-MY') =>
  auditStatusLabel(value, target, translator(locale), locale);

// ---------------------------------------------------------------------------
// The registry against the catalogue
// ---------------------------------------------------------------------------

describe('STATUS_CODES against the catalogue', () => {
  it('has copy for every group and code in every locale', () => {
    for (const locale of LOCALES) {
      for (const group of STATUS_GROUPS) {
        for (const code of STATUS_CODES[group]) {
          const copy = lookup(locale, `status.${group}.${code}`);
          expect(copy, `common.status.${group}.${code} in ${locale}`).toBeTypeOf('string');
          expect(copy).not.toBe('');
        }
      }
    }
  });

  it('carries no code the catalogue does not know and no key the registry does not', () => {
    for (const locale of LOCALES) {
      const status = lookup(locale, 'status') as Record<string, Record<string, string>>;
      expect(Object.keys(status).sort()).toEqual([...STATUS_GROUPS].sort());
      for (const group of STATUS_GROUPS) {
        expect(Object.keys(status[group]).sort(), `${group} in ${locale}`).toEqual(
          [...STATUS_CODES[group]].sort(),
        );
      }
    }
  });

  it('has the helper own extra copy in every locale', () => {
    for (const locale of LOCALES) {
      for (const key of ['unknown', 'pair', 'resyncFailed', 'retryOf', 'readiness', 'yes', 'no']) {
        const copy = lookup(locale, `auditStatus.${key}`);
        expect(copy, `common.auditStatus.${key} in ${locale}`).toBeTypeOf('string');
        expect(copy).not.toBe('');
      }
    }
  });
});

describe('statusLabel', () => {
  it('returns the badge copy for a known code and null for an unknown one', () => {
    expect(statusLabel('claim', 'paid', t)).toBe('Paid');
    expect(statusLabel('metering', 'held', t)).toBe('Metering on hold');
    expect(statusLabel('claim', 'held', t)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Every value the engine writes into `before` / `after`
//
// The list is `grep -n "before:\|after:" src/domain/engine.ts` turned into
// cases, one per distinct value shape, so a new audit value with no copy fails
// here rather than reaching a page as snake_case.
// ---------------------------------------------------------------------------

describe('auditStatusLabel: every value the engine records', () => {
  it('maps campaign statuses', () => {
    // campaign.createDraft / publish / pause / resume / closeSubmissions / close
    expect(label('draft', 'campaign')).toBe('Draft');
    expect(label('published', 'campaign')).toBe('Published');
    expect(label('paused', 'campaign')).toBe('Paused');
    expect(label('submissions_closed', 'campaign')).toBe('Submissions closed');
    expect(label('settling', 'campaign')).toBe('Settling');
    expect(label('closed', 'campaign')).toBe('Closed');
  });

  it('maps the campaign readiness summary demo.setReadiness records', () => {
    expect(label('funding=true,data=true', 'campaign')).toBe(
      'Funding evidence: recorded · Data source: recorded',
    );
    expect(label('funding=false,data=true', 'campaign')).toBe(
      'Funding evidence: not recorded · Data source: recorded',
    );
    expect(label('funding=true,data=false', 'campaign')).toBe(
      'Funding evidence: recorded · Data source: not recorded',
    );
    expect(label('funding=false,data=false', 'campaign')).toBe(
      'Funding evidence: not recorded · Data source: not recorded',
    );
  });

  it('maps submission statuses and the content decision on a submission', () => {
    // submission.create / acceptance / metering end
    expect(label('pending_baseline', 'submission')).toBe('Waiting for baseline');
    expect(label('baseline_unavailable', 'submission')).toBe('Baseline unavailable');
    expect(label('metering', 'submission')).toBe('Metering');
    expect(label('data_unavailable', 'submission')).toBe('Data not available');
    expect(label('metering_ended', 'submission')).toBe('Metering ended');
    // submission.reviewContent
    expect(label('approved', 'submission')).toBe('Content approved');
    expect(label('rejected', 'submission')).toBe('Content rejected');
  });

  it('maps the resync failure suffix submission.resync records', () => {
    expect(label('metering:resync_failed', 'submission')).toBe('Metering · resync failed');
    expect(label('baseline_unavailable:resync_failed', 'submission')).toBe(
      'Baseline unavailable · resync failed',
    );
    expect(label('metering_ended:resync_failed', 'submission')).toBe(
      'Metering ended · resync failed',
    );
    expect(label('data_unavailable:resync_failed', 'submission')).toBe(
      'Data not available · resync failed',
    );
  });

  it('maps claim, partial-offer and waitlist statuses on a claim row', () => {
    // claim.request and the review ladder
    expect(label('pending_review', 'claim')).toBe('Pending review');
    expect(label('confirmed_unpaid', 'claim')).toBe('Confirmed unpaid');
    expect(label('rejected_appealable', 'claim')).toBe('Rejected · reservation held');
    expect(label('appealing', 'claim')).toBe('Appeal in progress');
    expect(label('rejected_final', 'claim')).toBe('Rejected · final');
    expect(label('paid', 'claim')).toBe('Paid');
    // A partial offer is not a claim: `open` here is the offer.
    expect(label('open', 'claim')).toBe('Offer open');
    expect(label('declined', 'claim')).toBe('Offer declined');
    // Below the minimum the entry is waitlisted with nothing reserved.
    expect(label('waiting', 'claim')).toBe('Waitlisted');
  });

  it('maps the "<claim status>/<metering decision>" pair claim.reviewMetering records', () => {
    expect(label('pending_review/approved', 'claim')).toBe('Pending review / Metering approved');
expect(label('confirmed_unpaid/approved', 'claim')).toBe('Confirmed unpaid / Metering approved');
    expect(label('pending_review/held', 'claim')).toBe('Pending review / Metering on hold');
    expect(label('rejected_appealable/rejected', 'claim')).toBe(
      'Rejected · reservation held / Metering rejected',
    );
  });

  it('maps appeal outcomes and the claim statuses an appeal row carries', () => {
    // appeal.file moves the claim off `rejected_appealable`.
    expect(label('rejected_appealable', 'appeal')).toBe('Rejected · reservation held');
    expect(label('appealing', 'appeal')).toBe('Appeal in progress');
    // appeal.resolve
    expect(label('open', 'appeal')).toBe('Appeal open');
    expect(label('upheld', 'appeal')).toBe('Appeal upheld');
    expect(label('rejected', 'appeal')).toBe('Appeal rejected');
  });

  it('maps payout attempt statuses and the controlled-retry reference', () => {
    expect(label('processing', 'payout_attempt')).toBe('Processing');
    expect(label('succeeded', 'payout_attempt')).toBe('Funds available');
    expect(label('failed', 'payout_attempt')).toBe('Failed');
    expect(label('unknown', 'payout_attempt')).toBe('Result unknown');
    expect(label('retry_of:pay-1', 'payout_attempt')).toBe('Retry of pay-1');
  });

  it('maps the connection statuses recorded against the session', () => {
    expect(label('unlinked', 'session')).toBe('Not connected');
    expect(label('valid', 'session')).toBe('Connected');
  });

  it('maps obligation statuses', () => {
    expect(label('open', 'obligation')).toBe('Payable');
    expect(label('settled', 'obligation')).toBe('Settled');
  });
});

describe('auditStatusLabel: values that are facts, not statuses', () => {
  it('keeps a view count as a number, formatted for the locale', () => {
    // demo.addQualifiedViews and submission.resync record counts. Turning these
    // into "unknown" would destroy the only fact the row carries.
    expect(label('0', 'submission')).toBe('0');
    expect(label('1000', 'submission')).toBe('1,000');
    expect(label('1234567', 'submission')).toBe('1,234,567');
  });

  it('keeps the simulated clock and the scenario id as recorded', () => {
    expect(label('2026-09-01T12:00:00+08:00', 'demo')).toBe('2026-09-01T12:00:00+08:00');
    expect(label('baseline', 'demo')).toBe('baseline');
    expect(label('payout_unknown', 'demo')).toBe('payout_unknown');
  });

  it('returns null for an absent side of the transition', () => {
    expect(label(null, 'claim')).toBeNull();
    expect(auditStatusLabel(undefined, 'claim', t, 'en-MY')).toBeNull();
    expect(label('   ', 'claim')).toBeNull();
  });
});

describe('auditStatusLabel: an unrecognised code', () => {
  it('falls back to the localized unknown and never leaks the bare code', () => {
    // A state persisted by an older build can carry a status this build dropped.
    expect(label('teleported', 'claim')).toBe('Unknown (teleported)');
    // A code from the wrong status line is not silently read as another line's.
    expect(label('settling', 'claim')).toBe('Unknown (settling)');
    expect(label('notified/approved', 'submission')).toBe('Unknown (notified/approved)');
    for (const locale of LOCALES) {
      const rendered = label('teleported', 'claim', locale);
      expect(rendered).not.toBe('teleported');
      expect(rendered).toContain('teleported');
    }
  });
});

describe('auditStatusLabel: all three locales', () => {
  it('has copy for every engine value in every locale', () => {
    const cases: Array<[string, AuditEntry['targetType']]> = [
      ['draft', 'campaign'],
      ['published', 'campaign'],
      ['paused', 'campaign'],
      ['submissions_closed', 'campaign'],
      ['settling', 'campaign'],
      ['closed', 'campaign'],
      ['funding=true,data=false', 'campaign'],
      ['pending_baseline', 'submission'],
      ['baseline_unavailable', 'submission'],
      ['metering', 'submission'],
      ['data_unavailable', 'submission'],
      ['metering_ended', 'submission'],
      ['approved', 'submission'],
      ['rejected', 'submission'],
      ['metering:resync_failed', 'submission'],
      ['baseline_unavailable:resync_failed', 'submission'],
      ['pending_review', 'claim'],
      ['confirmed_unpaid', 'claim'],
      ['rejected_appealable', 'claim'],
      ['appealing', 'claim'],
      ['rejected_final', 'claim'],
      ['paid', 'claim'],
      ['open', 'claim'],
      ['declined', 'claim'],
      ['waiting', 'claim'],
      ['pending_review/approved', 'claim'],
      ['pending_review/held', 'claim'],
      ['rejected_appealable/rejected', 'claim'],
      ['open', 'appeal'],
      ['upheld', 'appeal'],
      ['rejected', 'appeal'],
      ['rejected_appealable', 'appeal'],
      ['appealing', 'appeal'],
      ['open', 'obligation'],
      ['settled', 'obligation'],
      ['processing', 'payout_attempt'],
      ['succeeded', 'payout_attempt'],
      ['failed', 'payout_attempt'],
      ['unknown', 'payout_attempt'],
      ['retry_of:pay-1', 'payout_attempt'],
      ['valid', 'session'],
      ['unlinked', 'session'],
    ];
    for (const locale of LOCALES) {
      for (const [value, target] of cases) {
        const rendered = label(value, target, locale);
        expect(rendered, `${value} (${target}) in ${locale}`).toBeTypeOf('string');
        expect(rendered).not.toBe('');
        // The whole point: the raw code never reaches a page on its own.
        expect(rendered).not.toBe(value);
      }
    }
  });
});

describe('AUDIT_TARGET_GROUPS', () => {
  it('names only groups the registry has', () => {
    for (const groups of Object.values(AUDIT_TARGET_GROUPS)) {
      for (const group of groups) {
        expect(STATUS_GROUPS).toContain(group);
      }
    }
  });
});
