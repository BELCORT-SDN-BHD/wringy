/**
 * Structured JSON logs (pino) that never carry a secret (kickoff-package.md
 * §8.3, §8.5; M2-AC01/2 part 4, "no secrets in bundles or logs").
 *
 * Two layers:
 * 1. pino's `redact` censors values under known secret keys (a connection
 *    string, a password, an auth header) wherever an object is logged.
 * 2. Every serialised line passes through `scrubSecrets()` on its way to the
 *    destination, so a connection string that reaches a message, an error or a
 *    library's event payload (pg-boss `error` events carry the driver's error)
 *    is replaced before it is written.
 *
 * The worker logs variable NAMES, never their values.
 */
import pino, { type DestinationStream, type Level, type Logger } from 'pino';

export type { Logger };

/** Keys whose values are censored in any logged object (pino `redact` paths). */
export const REDACT_PATHS = [
  'password',
  '*.password',
  'connectionString',
  '*.connectionString',
  'DATABASE_URL',
  '*.DATABASE_URL',
  'DATABASE_URL_MIGRATOR',
  '*.DATABASE_URL_MIGRATOR',
  'req.headers.authorization',
  'req.headers.cookie',
];

export const CENSOR = '[redacted]';

/** A PostgreSQL URL, up to the first character that cannot be part of it inside a JSON string. */
const POSTGRES_URL = /\bpostgres(?:ql)?:\/\/[^\s"'\\]*/gi;
/** A `password=…` pair in a key-value connection string or a query string. */
const PASSWORD_PAIR = /\bpassword\s*=\s*[^\s"'\\&;]*/gi;

/** Replaces connection strings and password pairs in `text`. */
export function scrubSecrets(text: string): string {
  return text.replace(POSTGRES_URL, `postgres://${CENSOR}`).replace(PASSWORD_PAIR, `password=${CENSOR}`);
}

/** Wraps a destination so every line is scrubbed before it is written. */
export function scrubbingDestination(destination: DestinationStream): DestinationStream {
  return {
    write(line: string) {
      destination.write(scrubSecrets(line));
    },
  };
}

export interface CreateLoggerOptions {
  level: Level | 'silent';
  /** Fields on every line, e.g. the worker id. Never a secret. */
  base?: Record<string, string>;
  /** Defaults to synchronous stdout, so a line written just before exit is not lost. */
  destination?: DestinationStream;
}

export function createLogger({ level, base = {}, destination }: CreateLoggerOptions): Logger {
  const target = destination ?? pino.destination({ dest: 1, sync: true });
  return pino(
    {
      level,
      base: { service: 'worker', ...base },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: { paths: REDACT_PATHS, censor: CENSOR },
    },
    scrubbingDestination(target),
  );
}
