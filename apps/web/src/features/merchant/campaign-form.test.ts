import { describe, expect, it } from 'vitest';

import { DEFAULT_RULES, applyCommand, createSeedState } from '@/domain';

import {
  capExplanation,
  defaultFormValues,
  formFromRules,
  isSameForm,
  parseWholeNumber,
  ringgitToSen,
  senToRinggitInput,
  toggleOption,
  validateCampaignForm,
  PLATFORM_OPTIONS,
} from './campaign-form';

describe('ringgit and sen', () => {
  it('renders integer sen with two decimals', () => {
    expect(senToRinggitInput(200_000)).toBe('2000.00');
    expect(senToRinggitInput(500)).toBe('5.00');
    expect(senToRinggitInput(10_000)).toBe('100.00');
    expect(senToRinggitInput(1)).toBe('0.01');
    expect(senToRinggitInput(0)).toBe('0.00');
  });

  it('parses ringgit to whole sen without floating point', () => {
    expect(ringgitToSen('2000')).toEqual({ ok: true, sen: 200_000 });
    expect(ringgitToSen('2,000.00')).toEqual({ ok: true, sen: 200_000 });
    expect(ringgitToSen('0.1')).toEqual({ ok: true, sen: 10 });
    expect(ringgitToSen('5.01')).toEqual({ ok: true, sen: 501 });
    expect(ringgitToSen('0.29')).toEqual({ ok: true, sen: 29 });
  });

  it('refuses anything that is not a whole-sen ringgit amount', () => {
    for (const bad of ['', '  ', 'abc', '5.001', '-5', '5.', '.5', '1e3', 'RM5']) {
      expect(ringgitToSen(bad).ok, bad).toBe(false);
    }
  });

  it('parses whole counts only', () => {
    expect(parseWholeNumber('100000')).toEqual({ ok: true, value: 100_000 });
    expect(parseWholeNumber('100,000')).toEqual({ ok: true, value: 100_000 });
    expect(parseWholeNumber('7.5').ok).toBe(false);
    expect(parseWholeNumber('-1').ok).toBe(false);
  });
});

describe('defaults', () => {
  it('shows the approved defaults: RM2,000 / RM5 per 1,000 / RM5 min / RM100 cap / 14 / 7 / 7 / 30', () => {
    const values = defaultFormValues('Kopi Kita', 'brief');
    expect(values.pool).toBe('2000.00');
    expect(values.ratePerThousand).toBe('5.00');
    expect(values.minClaim).toBe('5.00');
    expect(values.capPerSubmission).toBe('100.00');
    expect(values.viewThreshold).toBe('');
    expect(values.submissionWindowDays).toBe('14');
    expect(values.meteringDays).toBe('7');
    expect(values.claimGraceDays).toBe('7');
    expect(values.retentionDays).toBe('30');
    expect(values.crossPlatformIndependentCap).toBe(false);
    expect(values.platforms).toEqual(['tiktok', 'instagram', 'youtube']);
    expect(values.contentLanguages).toEqual(['en', 'ms', 'zh']);
  });

  it('round-trips the defaults back into exactly DEFAULT_RULES', () => {
    const result = validateCampaignForm(defaultFormValues('Kopi Kita', 'brief'));
    expect(result.errors).toEqual({});
    expect(result.patch?.rules).toEqual(DEFAULT_RULES);
  });

  it('matches the campaign the engine creates from the same defaults', () => {
    const seed = createSeedState();
    const signedIn = applyCommand(seed, { type: 'session.signIn', userId: 'user-demo' }, { commandId: 'a' });
    const merchant = applyCommand(
      signedIn.state,
      { type: 'session.switchWorkspace', workspace: 'merchant' },
      { commandId: 'b' },
    );
    const created = applyCommand(
      merchant.state,
      { type: 'campaign.createDraft', orgId: 'org-kopi', title: 'Draft', brief: '' },
      { commandId: 'c' },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const campaign = Object.values(created.state.campaigns).find((entry) => entry.title === 'Draft');
    expect(campaign).toBeDefined();
    const values = formFromRules('Draft', '', campaign!.rules);
    expect(values).toEqual(defaultFormValues('Draft', ''));
  });
});

describe('validation', () => {
  it('blocks a minimum claim above the cap, on both fields', () => {
    const values = { ...defaultFormValues('t', ''), minClaim: '150.00', capPerSubmission: '100.00' };
    const result = validateCampaignForm(values);
    expect(result.errors.minClaim).toBe('errorMinAboveCap');
    expect(result.errors.capPerSubmission).toBe('errorMinAboveCap');
    expect(result.patch).toBeNull();
  });

  it('allows a minimum equal to the cap', () => {
    const values = { ...defaultFormValues('t', ''), minClaim: '100.00', capPerSubmission: '100.00' };
    expect(validateCampaignForm(values).errors).toEqual({});
  });

  it('allows a high view threshold with a low cap', () => {
    const values = { ...defaultFormValues('t', ''), viewThreshold: '100000', capPerSubmission: '100.00' };
    const result = validateCampaignForm(values);
    expect(result.errors).toEqual({});
    expect(result.patch?.rules.viewThreshold).toBe(100_000);
  });

  it('requires a name, a platform and a content language', () => {
    const values = { ...defaultFormValues('', ''), platforms: [], contentLanguages: [] };
    const { errors } = validateCampaignForm(values);
    expect(errors.title).toBe('errorTitleRequired');
    expect(errors.platforms).toBe('errorPlatforms');
    expect(errors.contentLanguages).toBe('errorLanguages');
  });

  it('refuses sub-sen amounts and non-positive durations', () => {
    const values = {
      ...defaultFormValues('t', ''),
      pool: '2000.005',
      ratePerThousand: '0.00',
      meteringDays: '0',
      retentionDays: '7.5',
      viewThreshold: '0',
    };
    const { errors } = validateCampaignForm(values);
    expect(errors.pool).toBe('errorMoney');
    expect(errors.ratePerThousand).toBe('errorMoneyPositive');
    expect(errors.meteringDays).toBe('errorDays');
    expect(errors.retentionDays).toBe('errorDays');
    expect(errors.viewThreshold).toBe('errorThreshold');
  });

  it('produces a patch the engine accepts', () => {
    const seed = createSeedState();
    const signedIn = applyCommand(seed, { type: 'session.signIn', userId: 'user-demo' }, { commandId: 'a' });
    const merchant = applyCommand(
      signedIn.state,
      { type: 'session.switchWorkspace', workspace: 'merchant' },
      { commandId: 'b' },
    );
    const values = {
      ...defaultFormValues('Cold Brew', 'brief'),
      pool: '1,500.50',
      viewThreshold: '100000',
    };
    const result = validateCampaignForm(values);
    expect(result.patch).not.toBeNull();

    const updated = applyCommand(
      merchant.state,
      { type: 'campaign.updateDraft', campaignId: 'cmp-kopi-draft', patch: result.patch! },
      { commandId: 'c' },
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.state.campaigns['cmp-kopi-draft'].rules.poolSen).toBe(150_050);
    expect(updated.state.campaigns['cmp-kopi-draft'].rules.viewThreshold).toBe(100_000);
  });
});

describe('cap explanation', () => {
  it('explains the approved example: 100,000 views at RM5/1,000 capped at RM100', () => {
    const values = { ...defaultFormValues('t', ''), viewThreshold: '100000' };
    expect(capExplanation(values)).toEqual({
      views: 100_000,
      uncappedSen: 50_000,
      cappedSen: 10_000,
    });
  });

  it('says nothing when there is no threshold or the threshold does not reach the cap', () => {
    expect(capExplanation(defaultFormValues('t', ''))).toBeNull();
    expect(capExplanation({ ...defaultFormValues('t', ''), viewThreshold: '1000' })).toBeNull();
    // Exactly at the cap is not "capped below what the threshold earns".
    expect(capExplanation({ ...defaultFormValues('t', ''), viewThreshold: '20000' })).toBeNull();
  });
});

describe('form helpers', () => {
  it('detects an unchanged form', () => {
    const a = defaultFormValues('t', 'b');
    expect(isSameForm(a, defaultFormValues('t', 'b'))).toBe(true);
    expect(isSameForm(a, { ...a, minClaim: '6.00' })).toBe(false);
  });

  it('toggles an option and keeps the canonical order', () => {
    expect(toggleOption(['youtube', 'tiktok'], 'instagram', PLATFORM_OPTIONS)).toEqual([
      'tiktok',
      'instagram',
      'youtube',
    ]);
    expect(toggleOption(['tiktok', 'youtube'], 'tiktok', PLATFORM_OPTIONS)).toEqual(['youtube']);
  });
});
