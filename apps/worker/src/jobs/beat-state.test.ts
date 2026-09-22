import { describe, expect, it } from 'vitest';

import { INITIAL_BEAT_STATE, nextBeatState, type BeatOutcome, type BeatState } from './beat-state';

const at = (iso: string): BeatOutcome => ({ ok: true, lastBeatAt: new Date(iso) });
const failure: BeatOutcome = { ok: false };

function run(outcomes: BeatOutcome[]): { state: BeatState; events: string[] } {
  let state = INITIAL_BEAT_STATE;
  const events: string[] = [];
  for (const outcome of outcomes) {
    const next = nextBeatState(state, outcome);
    state = next.state;
    events.push(next.event);
  }
  return { state, events };
}

describe('process beat state', () => {
  it('reports the first beat, then routine beats', () => {
    const { state, events } = run([at('2026-09-23T00:00:00Z'), at('2026-09-23T00:00:15Z')]);
    expect(events).toEqual(['first', 'ok']);
    expect(state).toEqual({ beats: 2, consecutiveFailures: 0, lastBeatAt: new Date('2026-09-23T00:00:15Z') });
  });

  it('counts consecutive failures and keeps the last good beat', () => {
    const { state, events } = run([at('2026-09-23T00:00:00Z'), failure, failure]);
    expect(events).toEqual(['first', 'failed', 'failed']);
    expect(state).toEqual({ beats: 1, consecutiveFailures: 2, lastBeatAt: new Date('2026-09-23T00:00:00Z') });
  });

  it('reports a recovery after failures and resets the count', () => {
    const { state, events } = run([at('2026-09-23T00:00:00Z'), failure, at('2026-09-23T00:00:30Z')]);
    expect(events).toEqual(['first', 'failed', 'recovered']);
    expect(state.consecutiveFailures).toBe(0);
    expect(state.beats).toBe(2);
  });

  it('calls the first success "first" even after failed attempts before it', () => {
    const { state, events } = run([failure, at('2026-09-23T00:00:15Z')]);
    expect(events).toEqual(['failed', 'first']);
    expect(state.beats).toBe(1);
  });
});
