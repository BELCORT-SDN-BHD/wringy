import common from '@/messages/en-MY/common.json';

/**
 * The error codes the copy actually covers, read from the catalogue itself so
 * the list cannot drift from `common.errors`.
 */
const KNOWN_CODES = new Set(Object.keys(common.errors));

/**
 * The `common.errors` key for an engine error code. An unrecognised code falls
 * back to a neutral refusal sentence rather than a guessed success.
 */
export function errorCopyKey(code: string): string {
  return KNOWN_CODES.has(code) ? code : 'unknown';
}
