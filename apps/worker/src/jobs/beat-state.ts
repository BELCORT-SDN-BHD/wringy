/**
 * The process beat's own bookkeeping, kept pure so the log policy is testable:
 * the first beat and a recovery are worth an info line, every failure a warning,
 * and a routine beat only a debug line (one every 15 s would drown the log).
 */

export interface BeatState {
  /** Successful beats since the process started. */
  readonly beats: number;
  /** Failed beats since the last success. */
  readonly consecutiveFailures: number;
  /** last_beat_at of the last successful beat, as the DATABASE reported it. */
  readonly lastBeatAt: Date | null;
}

export const INITIAL_BEAT_STATE: BeatState = { beats: 0, consecutiveFailures: 0, lastBeatAt: null };

export type BeatOutcome = { ok: true; lastBeatAt: Date } | { ok: false };

/**
 * What the transition means for the log:
 * - `first`: the first successful beat of this process.
 * - `ok`: a routine beat.
 * - `recovered`: a success after one or more failures.
 * - `failed`: a failure (the state's consecutiveFailures says how many in a row).
 */
export type BeatEvent = 'first' | 'ok' | 'recovered' | 'failed';

export function nextBeatState(state: BeatState, outcome: BeatOutcome): { state: BeatState; event: BeatEvent } {
  if (!outcome.ok) {
    return {
      state: { ...state, consecutiveFailures: state.consecutiveFailures + 1 },
      event: 'failed',
    };
  }
  const event: BeatEvent = state.beats === 0 ? 'first' : state.consecutiveFailures > 0 ? 'recovered' : 'ok';
  return {
    state: { beats: state.beats + 1, consecutiveFailures: 0, lastBeatAt: outcome.lastBeatAt },
    event,
  };
}
