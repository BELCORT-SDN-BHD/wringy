import { describe, expect, it } from 'vitest';

import { LOCALES, messagesByLocale } from '@/i18n/messages';
import type { Locale } from '@/domain/types';
import { AUDIT_ACTION_KEYS, auditActionKey, formatAuditAction } from './audit-copy';

/** `common.actions` is a flat map of strings; the catalogue type is a deep tree. */
function localeActions(locale: Locale): Record<string, string> {
  return messagesByLocale[locale].common.actions as unknown as Record<string, string>;
}

/**
 * The timelines are the record all three roles read, so a raw command code
 * reaching a page is a real defect and not a cosmetic one. These tests are what
 * make the `Record<CommandType, …>` map useful: they check the copy exists in
 * every locale, not just that the map compiles.
 */
describe('audit action copy', () => {
  it.each([...LOCALES])('%s has copy for every audit action key', (locale) => {
    const actions = localeActions(locale);
    expect(Object.keys(actions).length, `common.actions missing in ${locale}`).toBeGreaterThan(0);
    expect(AUDIT_ACTION_KEYS.filter((key) => !actions[key])).toEqual([]);
  });

  it('has no copy nothing can ask for', () => {
    const actions = Object.keys(localeActions('en-MY'));
    expect(actions.filter((key) => !AUDIT_ACTION_KEYS.includes(key))).toEqual([]);
  });

  it('maps a command type to its key and anything else to the generic one', () => {
    expect(auditActionKey('claim.reviewMetering')).toBe('claim_reviewMetering');
    expect(auditActionKey('campaign.closeSubmissions')).toBe('campaign_closeSubmissions');
    // A state persisted by an older build can carry a command this one dropped.
    expect(auditActionKey('claim.somethingRemoved')).toBe('other');
    expect(auditActionKey('')).toBe('other');
  });

  it('never returns a dotted key, because next-intl reads a dot as nesting', () => {
    expect(AUDIT_ACTION_KEYS.filter((key) => key.includes('.'))).toEqual([]);
  });

  it("translates through the caller's own translator", () => {
    const labels = localeActions('en-MY');
    expect(formatAuditAction('payout.retry', (key) => labels[key])).toBe('Payout retried');
    expect(formatAuditAction('nope.nope', (key) => labels[key])).toBe('Recorded action');
  });
});
