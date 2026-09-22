import { describe, expect, it } from 'vitest';

import { REDACTED, redactSecrets, scrubText, serializeError } from './logger';

const URL = 'postgres://wringy_api_login:hunter2-DO-NOT-LEAK@db.internal:5432/wringy';

describe('scrubText', () => {
  it('replaces a PostgreSQL connection string wherever it appears', () => {
    const text = `connect ${URL} failed; retry postgresql://u:p@h/d`;
    expect(scrubText(text)).toBe(`connect ${REDACTED} failed; retry ${REDACTED}`);
  });

  it('removes user:password credentials from any URL', () => {
    expect(scrubText('see https://admin:s3cret@example.test/path')).toBe(`see https://${REDACTED}@example.test/path`);
  });

  it('leaves ordinary text alone', () => {
    expect(scrubText('GET /internal/campaigns 200')).toBe('GET /internal/campaigns 200');
  });
});

describe('redactSecrets', () => {
  it('censors every key matching url|password|secret|token, at any depth, in any case', () => {
    const redacted = redactSecrets({
      databaseUrl: URL,
      DATABASE_URL: URL,
      nested: { password: 'p', clientSecret: 's', refresh_token: 't', list: [{ apiToken: 'x' }] },
      keep: 'value',
      count: 3,
    });
    expect(redacted).toEqual({
      databaseUrl: REDACTED,
      DATABASE_URL: REDACTED,
      nested: { password: REDACTED, clientSecret: REDACTED, refresh_token: REDACTED, list: [{ apiToken: REDACTED }] },
      keep: 'value',
      count: 3,
    });
    expect(JSON.stringify(redacted)).not.toContain('hunter2');
  });

  it('scrubs connection strings under innocent keys', () => {
    expect(redactSecrets({ detail: `using ${URL}` })).toEqual({ detail: `using ${REDACTED}` });
  });

  it('leaves non-plain objects for their serializers (a request keeps its url)', () => {
    class RequestLike {
      url = '/internal/campaigns';
    }
    const request = new RequestLike();
    const error = new Error('x');
    const out = redactSecrets({ req: request, err: error }) as Record<string, unknown>;
    expect(out.req).toBe(request);
    expect(out.err).toBe(error);
  });

  it('does not mutate its input', () => {
    const input = { password: 'p' };
    redactSecrets(input);
    expect(input.password).toBe('p');
  });
});

describe('serializeError', () => {
  it('keeps the type, the SQLSTATE and the stack, scrubbed, and follows the cause', () => {
    const cause = Object.assign(new Error(`connect failed for ${URL}`), { code: 'ECONNREFUSED', connectionString: URL });
    const error = new Error('The database is unavailable', { cause });
    const out = serializeError(error);

    expect(out.type).toBe('Error');
    expect(out.message).toBe('The database is unavailable');
    expect(String(out.stack)).toContain('logger.test.ts');
    expect(out.cause).toMatchObject({ code: 'ECONNREFUSED', connectionString: REDACTED, message: `connect failed for ${REDACTED}` });
    expect(JSON.stringify(out)).not.toContain('hunter2');
    expect(JSON.stringify(out)).not.toContain('db.internal');
  });

  it('handles a thrown non-Error', () => {
    expect(serializeError(`boom ${URL}`)).toEqual({ type: 'string', message: `boom ${REDACTED}`, stack: '' });
  });
});
