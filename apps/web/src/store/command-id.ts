/**
 * Idempotency keys for demo commands.
 *
 * The engine replays a command with a known id instead of applying it twice,
 * so the UI must mint exactly one id per user intent (one button press), not
 * one per render. Components that can be clicked twice keep the id they minted
 * and pass it again on retry.
 */

let counter = 0;

export function newCommandId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  counter += 1;
  return `cmd-${Date.now().toString(36)}-${counter.toString(36)}`;
}
