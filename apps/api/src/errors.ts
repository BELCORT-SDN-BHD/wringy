/**
 * Every non-2xx body is `{ error: { code, message } }` (apiErrorSchema in
 * @wringy/contracts). Codes are stable; messages are fixed operator English and
 * never carry a stack, a SQL error or a connection string.
 */
import type { ApiError } from '@wringy/contracts';

export const ERROR_MESSAGES = {
  bad_request: 'The request could not be processed.',
  not_found: 'No route matches this request.',
  internal_error: 'The server could not complete the request.',
  database_unavailable: 'The database is unavailable. Try again shortly.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export function errorBody(code: ErrorCode): ApiError {
  return { error: { code, message: ERROR_MESSAGES[code] } };
}
