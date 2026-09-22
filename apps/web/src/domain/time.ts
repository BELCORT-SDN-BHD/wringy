// Time arithmetic on ISO 8601 strings that keep their explicit offset.
//
// Every timestamp in DemoState is an ISO string with an offset (the seed and all
// scenarios use +08:00, Asia/Kuala_Lumpur). These helpers parse the wall clock and
// the offset, do the arithmetic, and render the result with the SAME offset, so a
// state built at "+08:00" never leaks a "Z" or a host-timezone value into the demo.
// No external date library: date-fns 4.4 is installed but cannot format a fixed
// offset without date-fns-tz, and the demo must be host-timezone independent.
//
// Asia/Kuala_Lumpur has no DST, so "calendar day" and "24 hours" coincide at this
// offset; `calendarDaysAfter` still does wall-clock date arithmetic because
// campaign-defaults-v1.md counts 申请宽限 in 日历日 (calendar days), not in hours.

import type { IsoDateTime } from './types';

const ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

export interface ParsedInstant {
  /** UTC epoch milliseconds. */
  epochMs: number;
  /** Offset as written, e.g. "+08:00". "Z" is normalised to "+00:00". */
  offset: string;
  offsetMinutes: number;
}

function offsetToMinutes(offset: string): number {
  if (offset === 'Z') return 0;
  const sign = offset[0] === '-' ? -1 : 1;
  const hours = Number(offset.slice(1, 3));
  const minutes = Number(offset.slice(4, 6));
  return sign * (hours * 60 + minutes);
}

/** Returns null when the string is not an ISO datetime with an offset. */
export function tryParseIso(iso: string): ParsedInstant | null {
  const match = ISO_RE.exec(iso);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, ms, offset] = match;
  const offsetMinutes = offsetToMinutes(offset);
  const utcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
    ms ? Number(ms.padEnd(3, '0')) : 0,
  );
  if (Number.isNaN(utcMs)) return null;
  return {
    epochMs: utcMs - offsetMinutes * MS_PER_MINUTE,
    offset: offset === 'Z' ? '+00:00' : offset,
    offsetMinutes,
  };
}

export function parseIso(iso: string): ParsedInstant {
  const parsed = tryParseIso(iso);
  if (!parsed) throw new Error(`not an ISO datetime with offset: ${iso}`);
  return parsed;
}

export function isIsoDateTime(value: unknown): value is IsoDateTime {
  return typeof value === 'string' && tryParseIso(value) !== null;
}

/** Epoch milliseconds, for comparisons only. Never stored in state. */
export function epochMs(iso: IsoDateTime): number {
  return parseIso(iso).epochMs;
}

function renderAt(epoch: number, offsetMinutes: number, offset: string): IsoDateTime {
  const wall = new Date(epoch + offsetMinutes * MS_PER_MINUTE);
  const yyyy = String(wall.getUTCFullYear()).padStart(4, '0');
  const mm = String(wall.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wall.getUTCDate()).padStart(2, '0');
  const hh = String(wall.getUTCHours()).padStart(2, '0');
  const mi = String(wall.getUTCMinutes()).padStart(2, '0');
  const ss = String(wall.getUTCSeconds()).padStart(2, '0');
  const msPart = wall.getUTCMilliseconds();
  const frac = msPart === 0 ? '' : `.${String(msPart).padStart(3, '0')}`;
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${frac}${offset}`;
}

/** Adds milliseconds, keeping the source offset. */
export function addMs(iso: IsoDateTime, ms: number): IsoDateTime {
  const { epochMs: start, offsetMinutes, offset } = parseIso(iso);
  return renderAt(start + Math.trunc(ms), offsetMinutes, offset);
}

export function addHours(iso: IsoDateTime, hours: number): IsoDateTime {
  return addMs(iso, hours * MS_PER_HOUR);
}

/** Adds whole days (24h at a fixed offset), keeping the source offset. */
export function addDays(iso: IsoDateTime, days: number): IsoDateTime {
  return calendarDaysAfter(iso, days);
}

/**
 * Same wall-clock time, `days` calendar days later, same offset.
 * campaign-defaults-v1.md: "计量结束后另有7个日历日申请宽限".
 */
export function calendarDaysAfter(iso: IsoDateTime, days: number): IsoDateTime {
  const match = ISO_RE.exec(iso);
  if (!match) throw new Error(`not an ISO datetime with offset: ${iso}`);
  const [, y, mo, d, h, mi, s, ms, rawOffset] = match;
  const offset = rawOffset === 'Z' ? '+00:00' : rawOffset;
  // Shift the wall-clock date by whole days in a UTC frame, then re-attach the offset.
  const wall = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d) + Math.trunc(days),
    Number(h),
    Number(mi),
    Number(s),
    ms ? Number(ms.padEnd(3, '0')) : 0,
  );
  return renderAt(wall, 0, offset);
}

export function isBefore(a: IsoDateTime, b: IsoDateTime): boolean {
  return epochMs(a) < epochMs(b);
}

export function isAfter(a: IsoDateTime, b: IsoDateTime): boolean {
  return epochMs(a) > epochMs(b);
}

export function isSameInstant(a: IsoDateTime, b: IsoDateTime): boolean {
  return epochMs(a) === epochMs(b);
}

/** a <= b */
export function isAtOrBefore(a: IsoDateTime, b: IsoDateTime): boolean {
  return epochMs(a) <= epochMs(b);
}

/** a >= b */
export function isAtOrAfter(a: IsoDateTime, b: IsoDateTime): boolean {
  return epochMs(a) >= epochMs(b);
}

export function maxIso(...values: (IsoDateTime | null | undefined)[]): IsoDateTime | null {
  let best: IsoDateTime | null = null;
  for (const value of values) {
    if (!value) continue;
    if (best === null || isAfter(value, best)) best = value;
  }
  return best;
}

export function minIso(...values: (IsoDateTime | null | undefined)[]): IsoDateTime | null {
  let best: IsoDateTime | null = null;
  for (const value of values) {
    if (!value) continue;
    if (best === null || isBefore(value, best)) best = value;
  }
  return best;
}

export function diffMs(a: IsoDateTime, b: IsoDateTime): number {
  return epochMs(a) - epochMs(b);
}
