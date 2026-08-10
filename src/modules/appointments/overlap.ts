import type { Appointment } from './appointments';

// Wall-clock helpers over a 'YYYY-MM-DDTHH:mm' string. Appointments store a
// wall-clock start (see the `WallClock` type in `../time`), so overlap is a
// pure minute-of-day comparison within one calendar day — no time zone math.
function dateOf(dateTime: string): string {
  return dateTime.slice(0, 10);
}

function minutesOfDay(dateTime: string): number {
  return Number(dateTime.slice(11, 13)) * 60 + Number(dateTime.slice(14, 16));
}

export interface ClashCandidate {
  // When editing/rescheduling, the id of the appointment being saved — it is
  // skipped so an appointment never clashes with its own former self.
  id?: string;
  start: { dateTime: string };
  durationMinutes: number;
}

// The save-time fit guarantee (#21): the pick-time bounding in the day view is
// a soft guard (it assumes a duration before the real one is chosen), so this
// is the real check. Returns the first booked/done appointment whose time
// interval overlaps the candidate's `[start, start + durationMinutes)` on the
// same day, or null if the candidate fits.
//
// Intervals are half-open, so back-to-back appointments (one ends exactly when
// the next begins) do NOT clash. Cancelled appointments are freed slots and
// never clash.
export function findClashingAppointment(
  candidate: ClashCandidate,
  appointments: Appointment[],
): Appointment | null {
  const candDate = dateOf(candidate.start.dateTime);
  const candStart = minutesOfDay(candidate.start.dateTime);
  const candEnd = candStart + candidate.durationMinutes;

  for (const other of appointments) {
    if (other.id === candidate.id) continue;
    if (other.status === 'cancelled') continue;
    if (dateOf(other.start.dateTime) !== candDate) continue;

    const otherStart = minutesOfDay(other.start.dateTime);
    const otherEnd = otherStart + other.durationMinutes;
    if (candStart < otherEnd && otherStart < candEnd) return other;
  }
  return null;
}
