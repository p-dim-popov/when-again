// Pure date-key helpers for the schedule screen and its route search param.
// A "date key" is always the local wall-clock calendar date 'YYYY-MM-DD' —
// never epoch/UTC — matching the WallClock model used by appointments.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export interface DateKeyParts {
  y: number;
  m: number;
  d: number;
}

/** Formats a local `Date` as its calendar date key, ignoring the time part. */
export function todayKey(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a `'YYYY-MM-DD'` string into its parts, or returns `null` if the
 * string is malformed or not a real calendar date (e.g. 2026-02-30).
 */
export function parseDateKey(s: string): DateKeyParts | null {
  const match = DATE_KEY_PATTERN.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  // A Date constructed from out-of-range parts rolls over into the next
  // month (e.g. Feb 30 -> Mar 2). Reject anything that doesn't round-trip.
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return { y, m, d };
}

/** Adds (or subtracts, for negative `n`) whole days to a date key. */
export function addDays(key: string, n: number): string {
  const parsed = parseDateKey(key);
  if (!parsed) throw new Error(`addDays: invalid date key "${key}"`);
  const date = new Date(parsed.y, parsed.m - 1, parsed.d);
  date.setDate(date.getDate() + n);
  return todayKey(date);
}

// `Date#getDay()` is 0 (Sunday) .. 6 (Saturday); this maps it to the offset
// from Monday so the week strip can be built Monday-first.
const OFFSET_FROM_MONDAY = [6, 0, 1, 2, 3, 4, 5];

/** Returns the seven date keys (Monday-first) of the week containing `key`. */
export function weekOf(key: string): string[] {
  const parsed = parseDateKey(key);
  if (!parsed) throw new Error(`weekOf: invalid date key "${key}"`);
  const date = new Date(parsed.y, parsed.m - 1, parsed.d);
  const monday = addDays(key, -OFFSET_FROM_MONDAY[date.getDay()]);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
