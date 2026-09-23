/**
 * The API's pino options, passed to Fastify's `logger` option
 * (kickoff-package.md §8.3: "the pino redact option covers the authorization and
 * cookie headers and connection strings"; M2-AC01/2: logs carry no secret).
 *
 * Three layers, because no single pino feature covers all of them:
 *
 * 1. `redact` paths censor the auth and cookie headers wherever a request or
 *    reply is logged with its headers (Fastify's default serializers log none).
 * 2. `formatters.log` walks every plain object passed to a log call and censors
 *    each key matching SECRET_KEY_PATTERN (`databaseUrl`, `password`,
 *    `apiToken`, ...). pino runs it before the serializers, so Fastify's request
 *    object keeps its `url` (the request path) while a logged `{ databaseUrl }`
 *    does not.
 * 3. The `err` and `msg` serializers scrub connection strings and URL
 *    credentials out of free text: error messages, stacks, causes and the log
 *    message itself.
 *
 * `time` is an ISO 8601 UTC string (pino's `stdTimeFunctions.isoTime`), the
 * same format apps/worker logs, so the two processes' lines sort and compare
 * as text.
 */
import type { FastifyServerOptions } from 'fastify';
import pino from 'pino';

import type { ApiEnv } from '@wringy/config';

export const REDACTED = '[Redacted]';

/** Keys whose values are never logged, at any depth of a logged plain object. */
export const SECRET_KEY_PATTERN = /url|password|secret|token/i;

/** Header paths censored by pino's own redaction. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
];

const CONNECTION_STRING = /postgres(?:ql)?:\/\/[^\s'"`<>]+/gi;
const URL_CREDENTIALS = /\/\/[^\s/@:'"`<>]+:[^\s/@'"`<>]+@/g;
const MAX_DEPTH = 8;

/** Replaces PostgreSQL connection strings and `user:password@` URL credentials in free text. */
export function scrubText(text: string): string {
  return text.replace(CONNECTION_STRING, REDACTED).replace(URL_CREDENTIALS, `//${REDACTED}@`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * A copy of `value` with secret-named keys censored and connection strings
 * scrubbed from strings. Plain objects and arrays are walked; anything else
 * (a Fastify request, an Error, a Date) is returned as is for its serializer.
 */
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrubText(value);
  if (depth >= MAX_DEPTH) return value;
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, depth + 1));
  if (!isPlainObject(value)) return value;

  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    copy[key] = SECRET_KEY_PATTERN.test(key) && item !== undefined && item !== null ? REDACTED : redactSecrets(item, depth + 1);
  }
  return copy;
}

/**
 * pino's error shape (`type`, `message`, `stack`, enumerable properties such as
 * the SQLSTATE `code`, and the `cause` chain) with every string scrubbed and
 * secret-named properties censored. The stack is logged here and never returned
 * to a client.
 */
export function serializeError(error: unknown, depth = 0): Record<string, unknown> {
  if (!(error instanceof Error)) return { type: typeof error, message: scrubText(String(error)), stack: '' };

  const out: Record<string, unknown> = {
    type: error.name,
    message: scrubText(error.message),
    stack: scrubText(error.stack ?? ''),
  };
  for (const [key, item] of Object.entries(error)) {
    if (key in out || key === 'cause') continue;
    out[key] = SECRET_KEY_PATTERN.test(key) ? REDACTED : redactSecrets(item, depth + 1);
  }
  if (error.cause !== undefined && depth < 3) out.cause = serializeError(error.cause, depth + 1);
  return out;
}

export interface LogDestination {
  write(line: string): void;
}

/** Fastify `logger` options for the API; `stream` lets a test capture the output. */
export function loggerOptions(level: ApiEnv['LOG_LEVEL'], stream?: LogDestination): FastifyServerOptions['logger'] {
  return {
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: REDACTED },
    formatters: {
      log: (object) => redactSecrets(object) as Record<string, unknown>,
    },
    serializers: {
      err: serializeError as never,
      msg: (message: unknown) => (typeof message === 'string' ? scrubText(message) : message),
    } as Record<string, (value: unknown) => unknown>,
    ...(stream === undefined ? {} : { stream }),
  };
}
