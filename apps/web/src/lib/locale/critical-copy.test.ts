import { describe, expect, it } from 'vitest';

import { LOCALES, messagesByLocale } from '@/i18n/messages';

import { CRITICAL_FORMS, criticalCopyMissing, missingCriticalKeys, type CriticalForm } from './critical-copy';

/**
 * The critical-copy guard (M2-04; m2-04-code-review.md R9 rev 2, R13 "web
 * unit"). The parity test keeps every key present in this tree, so the guard is
 * proven on mutated copies of the real catalogue (clause 3.10 is proven by unit
 * tests only, as the record says).
 */

/** A deep copy of one locale's catalogue, safe to mutate. */
const catalogue = (locale: (typeof LOCALES)[number]) =>
  JSON.parse(JSON.stringify(messagesByLocale[locale])) as Record<string, Record<string, unknown>>;

const FORMS = Object.keys(CRITICAL_FORMS) as CriticalForm[];

describe('M2-AC04/3 critical copy: a confirmation whose copy is missing in the active language is disabled, never mixed', () => {
  it('M2-AC04/3 critical copy: every critical form’s keys resolve in all three catalogues today', () => {
    for (const locale of LOCALES) {
      for (const form of FORMS) {
        expect(missingCriticalKeys(messagesByLocale[locale], CRITICAL_FORMS[form]), `${locale} ${form}`).toEqual([]);
        expect(criticalCopyMissing(messagesByLocale[locale], form), `${locale} ${form}`).toBe(false);
      }
    }
  });

  it('M2-AC04/3 critical copy: the five membership confirmations are the guarded forms', () => {
    expect(FORMS.sort()).toEqual(['acceptInvitation', 'leave', 'removeMember', 'revokeInvitation', 'roleChange']);
  });

  it('M2-AC04/3 critical copy: a removed key is reported, and fires the guard for the forms that need it only', () => {
    const messages = catalogue('ms-MY');
    delete (messages.internal.outcomes as Record<string, unknown>).member_removed;

    expect(missingCriticalKeys(messages, CRITICAL_FORMS.removeMember)).toEqual(['internal.outcomes.member_removed']);
    expect(criticalCopyMissing(messages, 'removeMember')).toBe(true);
    for (const form of FORMS.filter((name) => name !== 'removeMember')) {
      expect(criticalCopyMissing(messages, form), form).toBe(false);
    }
  });

  it('M2-AC04/3 critical copy: an emptied or blank key is as missing as a removed one', () => {
    for (const blank of ['', '   ', '\n']) {
      const messages = catalogue('zh-Hans-MY');
      ((messages.internal.invitations as Record<string, Record<string, unknown>>).accept as Record<string, unknown>).submit = blank;
      expect(missingCriticalKeys(messages, CRITICAL_FORMS.acceptInvitation), JSON.stringify(blank)).toEqual([
        'internal.invitations.accept.submit',
      ]);
    }
  });

  it('M2-AC04/3 critical copy: a key that is not a string, or a missing branch, is missing', () => {
    const messages = catalogue('en-MY');
    (messages.internal.org as Record<string, unknown>).leave = 'flattened';
    (messages.internal.role as Record<string, unknown>).admin = { nested: 'Admin' };

    expect(missingCriticalKeys(messages, CRITICAL_FORMS.leave)).toEqual([
      'internal.org.leave.title',
      'internal.org.leave.description',
      'internal.org.leave.submit',
    ]);
    expect(missingCriticalKeys(messages, CRITICAL_FORMS.roleChange)).toEqual(['internal.role.admin']);
    expect(missingCriticalKeys(undefined, ['internal.role.admin'])).toEqual(['internal.role.admin']);
    // An inherited property is not a message.
    expect(missingCriticalKeys({}, ['toString'])).toEqual(['toString']);
  });
});
