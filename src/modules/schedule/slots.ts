import type { Appointment } from '../appointments';

/** A stretch of free time within a day. 'HH:mm'; `end: null` means open-ended
 * to the day window's end (resolved against `dayEnd` by the caller). */
export interface FreeGap {
  start: string;
  end: string | null;
}

export type DayLayoutItem =
  { kind: 'appt'; appt: Appointment } | { kind: 'gap'; gap: FreeGap };

export interface DayLayout {
  items: DayLayoutItem[];
}

const MAX_SLOTS = 8;

/**
 * The slot-sizing minutes for a day: the grid step for quick-slot chips and
 * the minimum duration that must fit for a start to be offered (quick slots
 * and the "other time" picker alike).
 *
 * Uses the **shortest** recorded service duration, not the most-recent one:
 * a single long outlier (e.g. a 300-minute colour) must not hide every slot
 * in gaps shorter than it. Falls back to `fallback` when no services are
 * remembered yet.
 */
export function slotStepMinutes(
  services: { durationMinutes: number }[],
  fallback: number,
): number {
  if (services.length === 0) return fallback;
  return Math.min(...services.map((service) => service.durationMinutes));
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

function apptStartMinutes(appt: Appointment): number {
  return toMinutes(appt.start.dateTime.slice(11));
}

function itemStartMinutes(item: DayLayoutItem): number {
  return item.kind === 'gap'
    ? toMinutes(item.gap.start)
    : apptStartMinutes(item.appt);
}

/**
 * Lays out a day's appointments interleaved with the free gaps between them.
 *
 * Only non-cancelled appointments consume gap space. Cancelled appointments
 * still appear as `appt` items (for the caller to render de-emphasised), but
 * the time they occupy is not removed from the surrounding gap: it stays
 * genuinely bookable.
 */
export function computeDayLayout(
  appts: Appointment[],
  opts: { dayStart: string; dayEnd: string },
): DayLayout {
  const dayStartMin = toMinutes(opts.dayStart);
  const dayEndMin = toMinutes(opts.dayEnd);

  const blocking = appts
    .filter((appt) => appt.status !== 'cancelled')
    .slice()
    .sort((a, b) => apptStartMinutes(a) - apptStartMinutes(b));

  const gaps: FreeGap[] = [];
  let cursor = dayStartMin;
  for (const appt of blocking) {
    const start = apptStartMinutes(appt);
    if (start > cursor) {
      gaps.push({ start: toHHMM(cursor), end: toHHMM(start) });
    }
    cursor = Math.max(cursor, start + appt.durationMinutes);
  }
  if (cursor < dayEndMin) {
    gaps.push({ start: toHHMM(cursor), end: toHHMM(dayEndMin) });
  }

  const items: DayLayoutItem[] = [
    ...gaps.map((gap): DayLayoutItem => ({ kind: 'gap', gap })),
    ...appts.map((appt): DayLayoutItem => ({ kind: 'appt', appt })),
  ];
  items.sort((a, b) => itemStartMinutes(a) - itemStartMinutes(b));

  return { items };
}

/**
 * Generates candidate appointment start times within a free gap, stepping by
 * `stepMinutes` from `gap.start`. Only start times where a `serviceMinutes`
 * appointment fits before the boundary (`gap.end`, or `dayEnd` when the gap
 * is open-ended) are included. The result is capped so the caller can offer
 * a "show more" affordance for the remainder.
 */
export function generateSlots(
  gap: FreeGap,
  opts: { stepMinutes: number; serviceMinutes: number; dayEnd: string },
): string[] {
  const { stepMinutes, serviceMinutes, dayEnd } = opts;
  const startMin = toMinutes(gap.start);
  const boundaryMin = gap.end === null ? toMinutes(dayEnd) : toMinutes(gap.end);

  const slots: string[] = [];
  for (
    let t = startMin;
    t + serviceMinutes <= boundaryMin && slots.length < MAX_SLOTS;
    t += stepMinutes
  ) {
    slots.push(toHHMM(t));
  }
  return slots;
}
