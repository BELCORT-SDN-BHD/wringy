// Deterministic ids. No Math.random, no Date.now, no crypto.
//
// Every generated id is minted from the simulated server clock's monotonic
// `state.clock.seq`, so replaying the same commands from the seed always produces
// the same ids. That is what makes scenarios and tests reproducible, and what lets
// `demo.loadScenario` rebuild a scenario from the seed after a reset.

export type IdPrefix =
  | 'cmp' // campaign
  | 'sub' // submission
  | 'cl' // claim
  | 'off' // partial offer
  | 'wl' // waitlist entry
  | 'ap' // appeal
  | 'obl' // obligation
  | 'pa' // payout attempt
  | 'snap' // metric snapshot
  | 'ext' // claim deadline extension
  | 'cn' // account connection
  | 'lg' // ledger entry
  | 'nt' // notification
  | 'ad' // audit entry
  | 'ev'; // domain event

/** `cl_000012` — stable width so ids sort lexicographically by mint order. */
export function formatId(prefix: IdPrefix, seq: number): string {
  return `${prefix}_${String(seq).padStart(6, '0')}`;
}

/** Mints ids from a starting sequence number and reports the sequence it reached. */
export interface IdMinter {
  mint(prefix: IdPrefix): string;
  readonly seq: number;
}

export function createIdMinter(startSeq: number): IdMinter {
  let seq = startSeq;
  return {
    mint(prefix: IdPrefix): string {
      seq += 1;
      return formatId(prefix, seq);
    },
    get seq(): number {
      return seq;
    },
  };
}

/**
 * Deterministic id for a business event. Same business fact → same id, so the
 * notification dedup key (eventId, recipient) collapses repeated derivations
 * (e.g. a clock effect re-evaluated on every advance).
 */
export function eventId(kind: string, targetId: string, discriminator?: string): string {
  return discriminator ? `ev:${kind}:${targetId}:${discriminator}` : `ev:${kind}:${targetId}`;
}
