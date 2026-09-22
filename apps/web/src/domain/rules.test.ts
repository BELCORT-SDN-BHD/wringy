import { describe, expect, it } from 'vitest';

import { DEFAULT_RULES, appealDeadlineFrom, budgetOf, normalizePostUrl } from './rules';
import { createSeedState, SEED_IDS } from './seed';

describe('normalizePostUrl', () => {
  it('extracts a stable TikTok post id', () => {
    const canonical = normalizePostUrl('https://www.tiktok.com/@demouser/video/7400000000000000001');
    expect(canonical).toEqual({ ok: true, platform: 'tiktok', postId: '7400000000000000001' });
    // A different link shape for the same post gives the same id, so dedup works.
    const mobile = normalizePostUrl(
      'https://m.tiktok.com/@demouser/video/7400000000000000001?is_from_webapp=1',
    );
    expect(mobile).toEqual(canonical);
  });

  it('refuses TikTok short links instead of guessing the post', () => {
    expect(normalizePostUrl('https://vm.tiktok.com/ZS1234567/')).toEqual({
      ok: false,
      detail: 'short_link_unresolvable',
    });
    expect(normalizePostUrl('https://vt.tiktok.com/ZS1234567/')).toEqual({
      ok: false,
      detail: 'short_link_unresolvable',
    });
  });

  it('handles Instagram reels and posts', () => {
    expect(normalizePostUrl('https://www.instagram.com/reel/CxAbCdEfGhI/')).toEqual({
      ok: true,
      platform: 'instagram',
      postId: 'CxAbCdEfGhI',
    });
    expect(normalizePostUrl('https://instagram.com/p/CxAbCdEfGhI')).toEqual({
      ok: true,
      platform: 'instagram',
      postId: 'CxAbCdEfGhI',
    });
  });

  it('handles the three YouTube link shapes', () => {
    expect(normalizePostUrl('https://www.youtube.com/watch?v=abc123XYZ_-')).toEqual({
      ok: true,
      platform: 'youtube',
      postId: 'abc123XYZ_-',
    });
    expect(normalizePostUrl('https://youtu.be/abc123XYZ_-')).toEqual({
      ok: true,
      platform: 'youtube',
      postId: 'abc123XYZ_-',
    });
    expect(normalizePostUrl('https://www.youtube.com/shorts/abc123XYZ_-')).toEqual({
      ok: true,
      platform: 'youtube',
      postId: 'abc123XYZ_-',
    });
  });

  it('reports unusable input with a reason', () => {
    expect(normalizePostUrl('')).toEqual({ ok: false, detail: 'malformed_url' });
    expect(normalizePostUrl('ftp://tiktok.com/@a/video/1')).toEqual({
      ok: false,
      detail: 'malformed_url',
    });
    expect(normalizePostUrl('https://example.com/watch?v=1')).toEqual({
      ok: false,
      detail: 'unsupported_url',
    });
    expect(normalizePostUrl('https://www.tiktok.com/@demouser')).toEqual({
      ok: false,
      detail: 'unsupported_url',
    });
  });
});

describe('rules', () => {
  it('carries the approved defaults', () => {
    expect(DEFAULT_RULES).toMatchObject({
      poolSen: 200_000,
      ratePerThousandSen: 500,
      minClaimSen: 500,
      viewThreshold: null,
      capPerSubmissionSen: 10_000,
      submissionWindowDays: 14,
      meteringDays: 7,
      claimGraceDays: 7,
      retentionDays: 30,
      crossPlatformIndependentCap: false,
      audienceRegion: 'global',
    });
    expect(DEFAULT_RULES.platforms).toEqual(['tiktok', 'instagram', 'youtube']);
    expect(DEFAULT_RULES.contentLanguages).toEqual(['en', 'ms', 'zh']);
  });

  it('starts every published campaign with the whole pool available', () => {
    const state = createSeedState();
    expect(budgetOf(state, SEED_IDS.campaignKopiRaya)).toEqual({
      poolSen: 200_000,
      availableSen: 200_000,
      reservedSen: 0,
      confirmedUnpaidSen: 0,
      paidSen: 0,
    });
  });

  it('uses a 7 calendar day appeal window', () => {
    expect(appealDeadlineFrom('2026-09-01T12:00:00+08:00')).toBe('2026-09-08T12:00:00+08:00');
  });
});
