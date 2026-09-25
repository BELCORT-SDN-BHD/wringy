import { describe, expect, it } from 'vitest';

import { APP_MODE_VARIABLE, appMode, isInternalMode } from './mode';
import { internalAuthEnv } from './env';

const INTERNAL_ENV = {
  WRINGY_ENV: 'ci',
  API_INTERNAL_URL: 'http://127.0.0.1:3200',
  WRINGY_APP_MODE: 'internal',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake_0123456789abcdef',
  APP_ORIGIN: 'http://127.0.0.1:3100',
};

describe('M2-AC02/3 cache: the app mode is read without throwing and defaults to demo', () => {
  it('M2-AC02/3 cache: internal only for exactly that string, demo for everything else', () => {
    expect(appMode({ [APP_MODE_VARIABLE]: 'internal' })).toBe('internal');
    expect(isInternalMode({ [APP_MODE_VARIABLE]: 'internal' })).toBe(true);

    // A typo, a different case or a stray space must not open the internal build's
    // cookie-writing endpoints on a demo origin (R13).
    for (const value of ['Internal', 'INTERNAL', 'internal ', ' internal', 'demo', 'true', '1', '', undefined]) {
      expect(appMode({ [APP_MODE_VARIABLE]: value }), JSON.stringify(value)).toBe('demo');
      expect(isInternalMode({ [APP_MODE_VARIABLE]: value }), JSON.stringify(value)).toBe(false);
    }
  });

  it('M2-AC02/3 cache: an entirely empty environment reads as demo rather than failing', () => {
    // This is what the env-less image smoke runs: the page must still render.
    expect(appMode({})).toBe('demo');
  });
});

describe('M2-AC02/3 cache: the internal build’s environment narrows once, or says why not', () => {
  it('M2-AC02/3 cache: hands back the three variables as plain strings when the mode is internal', () => {
    const result = internalAuthEnv(INTERNAL_ENV);

    expect(result).toEqual({
      ok: true,
      env: {
        appOrigin: 'http://127.0.0.1:3100',
        supabaseUrl: 'https://project.supabase.co',
        publishableKey: 'sb_publishable_fake_0123456789abcdef',
        apiInternalUrl: 'http://127.0.0.1:3200',
      },
    });
  });

  it('M2-AC02/3 cache: demo mode is not a misconfiguration, so it says demo-mode', () => {
    const result = internalAuthEnv({ ...INTERNAL_ENV, WRINGY_APP_MODE: 'demo' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('demo-mode');
      expect(result.problems).toEqual([]);
    }
  });

  it('M2-AC02/3 cache: a missing internal variable is reported by NAME and never by value', () => {
    for (const missing of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'APP_ORIGIN'] as const) {
      const source: Record<string, string | undefined> = { ...INTERNAL_ENV };
      delete source[missing];

      const result = internalAuthEnv(source);
      expect(result.ok, missing).toBe(false);
      if (result.ok) continue;
      expect(result.reason).toBe('invalid-env');
      expect(result.problems.map((problem) => problem.name)).toContain(missing);
    }
  });

  it('M2-AC02/3 cache: a Supabase URL with a path is refused, so a project origin cannot be pasted wrong', () => {
    const result = internalAuthEnv({ ...INTERNAL_ENV, SUPABASE_URL: 'https://project.supabase.co/auth/v1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.map((problem) => problem.name)).toContain('SUPABASE_URL');
  });

  it('M2-AC02/3 cache: no value of any variable appears in what it reports', () => {
    const result = internalAuthEnv({ ...INTERNAL_ENV, SUPABASE_PUBLISHABLE_KEY: 'too-short' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const reported = JSON.stringify(result.problems);
      expect(reported).not.toContain('too-short');
      expect(reported).toContain('SUPABASE_PUBLISHABLE_KEY');
    }
  });
});
