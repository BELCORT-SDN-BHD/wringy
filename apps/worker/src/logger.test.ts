import { describe, expect, it } from 'vitest';

import { CENSOR, createLogger, scrubSecrets } from './logger';

const SECRET = 'Sup3r-s3cret-pw';
const URL = `postgres://wringy_worker_login:${SECRET}@127.0.0.1:54329/wringy`;

function capture() {
  const lines: string[] = [];
  const logger = createLogger({ level: 'debug', base: { workerId: 'w1' }, destination: { write: (line: string) => void lines.push(line) } });
  return { logger, lines, text: () => lines.join('') };
}

describe('M2-AC01 scrubSecrets', () => {
  it('M2-AC01/2 replaces PostgreSQL URLs and password pairs', () => {
    expect(scrubSecrets(`connect ${URL} failed`)).toBe(`connect postgres://${CENSOR} failed`);
    expect(scrubSecrets(`postgresql://u:${SECRET}@h/db`)).toBe(`postgres://${CENSOR}`);
    expect(scrubSecrets(`host=h user=u password=${SECRET} dbname=d`)).toBe(`host=h user=u password=${CENSOR} dbname=d`);
    expect(scrubSecrets('no secret here')).toBe('no secret here');
  });
});

describe('M2-AC01 worker logger', () => {
  it('writes JSON lines with the service and base fields', () => {
    const { logger, lines } = capture();
    logger.info({ beats: 1 }, 'process beat');
    const line = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(line).toMatchObject({ service: 'worker', workerId: 'w1', beats: 1, msg: 'process beat', level: 30 });
  });

  it('M2-AC01 stamps every line with an ISO 8601 UTC time, the format the API logs', () => {
    const { logger, lines } = capture();
    logger.info('probe');
    const line = JSON.parse(lines[0]!) as { time?: unknown };
    expect(line.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('M2-AC01/2 censors secret keys, URLs in messages and URLs inside errors', () => {
    const { logger, text } = capture();
    logger.info({ connectionString: URL, DATABASE_URL: URL, nested: { password: SECRET } }, 'config');
    logger.warn(`could not reach ${URL}`);
    const error = Object.assign(new Error(`connect ECONNREFUSED via ${URL}`), { code: 'ECONNREFUSED', detail: URL });
    logger.error({ err: error }, 'pg-boss error');
    const out = text();
    expect(out).not.toContain(SECRET);
    expect(out).not.toContain('wringy_worker_login:');
    expect(out).toContain(CENSOR);
    expect(out.split('\n').filter(Boolean)).toHaveLength(3);
  });
});
