/**
 * Pure bounds logic for the "друг час" (other time) picker: given a free gap
 * and a service duration, computes the latest valid start and snaps/clamps a
 * candidate time into the gap.
 *
 * Boundary rule mirrors `schedule/slots.ts#generateSlots`: a start fits iff
 * `start + serviceMinutes <= boundary`, where `boundary` is `gap.end` when
 * set, otherwise `dayEnd`. A service ending exactly at the boundary is a
 * valid (non-overrunning) fit.
 *
 * `gap` is typed structurally so this module stays a leaf: no import of
 * `schedule`'s `FreeGap` is needed, it just has to be shape-compatible.
 */

interface Gap {
  start: string;
  end: string | null;
}

/** Parses an `'HH:mm'` string into minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Formats minutes since midnight as `'HH:mm'`. */
export function toHHMM(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * The latest `'HH:mm'` start such that `start + serviceMinutes <= boundary`
 * (`gap.end`, or `dayEnd` when the gap is open-ended).
 *
 * When the gap is too small to fit `serviceMinutes` at all (boundary - start
 * < serviceMinutes), there is no valid start inside it; this falls back to
 * `gap.start` rather than a value that would overrun. Callers that need to
 * detect "doesn't fit" should compare `boundary - toMinutes(gap.start) <
 * serviceMinutes` themselves (e.g. to hide the picker's entry point).
 */
export function latestStartInGap(
  gap: Gap,
  opts: { serviceMinutes: number; dayEnd: string },
): string {
  const { serviceMinutes, dayEnd } = opts;
  const startMin = toMinutes(gap.start);
  const boundaryMin = gap.end === null ? toMinutes(dayEnd) : toMinutes(gap.end);
  const latestMin = Math.max(startMin, boundaryMin - serviceMinutes);
  return toHHMM(latestMin);
}

/**
 * Snaps `time` to the nearest multiple of `stepMinutes` measured from
 * midnight (00:00), rounding half-steps up (`Math.round`), then clamps the
 * result into `[gap.start, latestStartInGap(gap, opts)]`.
 *
 * Snapping to a fixed grid from midnight (rather than from `gap.start`) keeps
 * the picker's steps stable and predictable across different gaps — e.g. at
 * step 5, :00/:05/:10/... are always the candidate minutes, regardless of
 * where the free window happens to start.
 */
export function clampToGap(
  time: string,
  gap: Gap,
  opts: { stepMinutes: number; serviceMinutes: number; dayEnd: string },
): string {
  const { stepMinutes, serviceMinutes, dayEnd } = opts;
  const snapped = Math.round(toMinutes(time) / stepMinutes) * stepMinutes;

  const startMin = toMinutes(gap.start);
  const latestMin = toMinutes(
    latestStartInGap(gap, { serviceMinutes, dayEnd }),
  );

  const clamped = Math.min(Math.max(snapped, startMin), latestMin);
  return toHHMM(clamped);
}

/**
 * All valid appointment start times inside a gap, on the step grid, uncapped
 * (the wheel scrolls the full set; `slots.generateSlots` keeps the capped chip
 * row). A start is included iff it is a multiple of `stepMinutes` from
 * midnight, at or after `gap.start`, and leaves room for `serviceMinutes`
 * before the boundary (`gap.end`, or `dayEnd` when open-ended). Grid-aligned
 * from midnight (unlike `generateSlots`, which steps from `gap.start`) so the
 * wheel's minute column reads cleanly (:00/:05/…); gaps start grid-aligned in
 * practice (day start plus durations that are multiples of the step). Returns
 * `[]` when nothing fits.
 */
export function validStartTimes(
  gap: Gap,
  opts: { stepMinutes: number; serviceMinutes: number; dayEnd: string },
): string[] {
  const { stepMinutes, serviceMinutes, dayEnd } = opts;
  const startMin = toMinutes(gap.start);
  const boundaryMin = gap.end === null ? toMinutes(dayEnd) : toMinutes(gap.end);
  const latestMin = boundaryMin - serviceMinutes;
  const firstMin = Math.ceil(startMin / stepMinutes) * stepMinutes;
  const out: string[] = [];
  for (let t = firstMin; t <= latestMin; t += stepMinutes) out.push(toHHMM(t));
  return out;
}

/**
 * Splits valid start times into the wheel's two columns: distinct hours (in
 * ascending order) and, per hour, its valid minutes (ascending).
 */
export function wheelColumns(times: string[]): {
  hours: string[];
  minutesByHour: Map<string, string[]>;
} {
  const hours: string[] = [];
  const minutesByHour = new Map<string, string[]>();
  for (const time of times) {
    const hh = time.slice(0, 2);
    const mm = time.slice(3, 5);
    let mins = minutesByHour.get(hh);
    if (!mins) {
      mins = [];
      minutesByHour.set(hh, mins);
      hours.push(hh);
    }
    mins.push(mm);
  }
  return { hours, minutesByHour };
}

/**
 * The valid minute in `minutes` closest to `target` ('mm'); on a tie the lower
 * minute wins. `minutes` must be non-empty (a valid hour always has ≥1 minute)
 * and in ascending order (ties resolve to the lower minute).
 */
export function nearestMinute(minutes: string[], target: string): string {
  const t = Number(target);
  return minutes.reduce((best, m) =>
    Math.abs(Number(m) - t) < Math.abs(Number(best) - t) ? m : best,
  );
}
