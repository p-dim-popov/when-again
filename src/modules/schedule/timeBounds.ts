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

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

function toHHMM(minutes: number): string {
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
