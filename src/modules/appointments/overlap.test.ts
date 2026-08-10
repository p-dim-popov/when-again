import { describe, expect, it } from 'vitest';
import type { Appointment } from './appointments';
import { findClashingAppointment } from './overlap';

// Minimal appointment factory — only the fields the overlap check reads.
function appt(
  id: string,
  dateTime: string,
  durationMinutes: number,
  overrides: Partial<Appointment> = {},
): Appointment {
  return {
    id,
    clientId: 'c1',
    start: { dateTime, timeZone: 'Europe/Sofia' },
    durationMinutes,
    service: 'Haircut',
    status: 'booked',
    ...overrides,
  };
}

const candidate = (dateTime: string, durationMinutes: number, id?: string) => ({
  id,
  start: { dateTime },
  durationMinutes,
});

describe('findClashingAppointment', () => {
  it('returns null when the day has no other appointments', () => {
    expect(findClashingAppointment(candidate('2026-08-10T14:00', 30), [])).toBe(
      null,
    );
  });

  it('detects a partial overlap (candidate starts inside another)', () => {
    const existing = appt('a', '2026-08-10T14:00', 60); // 14:00–15:00
    const clash = findClashingAppointment(
      candidate('2026-08-10T14:30', 30), // 14:30–15:00
      [existing],
    );
    expect(clash).toBe(existing);
  });

  it('detects an overlap where the candidate overruns into the next', () => {
    const existing = appt('a', '2026-08-10T15:00', 30); // 15:00–15:30
    // Slot sized for 30 min, but the user typed 90 → 14:00–15:30 overruns.
    const clash = findClashingAppointment(candidate('2026-08-10T14:00', 90), [
      existing,
    ]);
    expect(clash).toBe(existing);
  });

  it('treats back-to-back appointments as NOT overlapping (half-open)', () => {
    const before = appt('a', '2026-08-10T13:00', 60); // 13:00–14:00
    const after = appt('b', '2026-08-10T15:00', 30); // 15:00–15:30
    // Candidate 14:00–15:00 abuts both exactly.
    expect(
      findClashingAppointment(candidate('2026-08-10T14:00', 60), [
        before,
        after,
      ]),
    ).toBe(null);
  });

  it('detects full containment (candidate swallows an existing one)', () => {
    const existing = appt('a', '2026-08-10T14:15', 15); // 14:15–14:30
    const clash = findClashingAppointment(
      candidate('2026-08-10T14:00', 60), // 14:00–15:00 contains it
      [existing],
    );
    expect(clash).toBe(existing);
  });

  it('ignores cancelled appointments (their slot is free)', () => {
    const cancelled = appt('a', '2026-08-10T14:00', 60, {
      status: 'cancelled',
    });
    expect(
      findClashingAppointment(candidate('2026-08-10T14:30', 30), [cancelled]),
    ).toBe(null);
  });

  it('still clashes with a done appointment (its slot is occupied)', () => {
    const done = appt('a', '2026-08-10T14:00', 60, { status: 'done' });
    expect(
      findClashingAppointment(candidate('2026-08-10T14:30', 30), [done]),
    ).toBe(done);
  });

  it('excludes the appointment being edited by id', () => {
    const self = appt('self', '2026-08-10T14:00', 60);
    // Editing "self": rescheduling within its own footprint must not self-clash.
    expect(
      findClashingAppointment(candidate('2026-08-10T14:00', 90, 'self'), [
        self,
      ]),
    ).toBe(null);
  });

  it('does not clash across different days', () => {
    const other = appt('a', '2026-08-11T14:00', 60);
    expect(
      findClashingAppointment(candidate('2026-08-10T14:00', 120), [other]),
    ).toBe(null);
  });

  it('returns the first clash when several overlap', () => {
    const first = appt('a', '2026-08-10T14:00', 30); // 14:00–14:30
    const second = appt('b', '2026-08-10T14:45', 30); // 14:45–15:15
    const clash = findClashingAppointment(
      candidate('2026-08-10T14:00', 120), // 14:00–16:00 overlaps both
      [first, second],
    );
    expect(clash).toBe(first);
  });
});
