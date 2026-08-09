import { describe, expect, it } from 'vitest';
import type { Appointment } from '../appointments';
import { computeDayLayout, generateSlots, type DayLayoutItem } from './slots';

const DAY = '2026-08-22';

let counter = 0;
function apptAt(
  time: string,
  durationMinutes: number,
  overrides: Partial<Appointment> = {},
): Appointment {
  counter += 1;
  return {
    id: `appt-${counter}`,
    clientId: 'client-1',
    start: { dateTime: `${DAY}T${time}`, timeZone: 'Europe/Sofia' },
    durationMinutes,
    service: 'Haircut',
    status: 'booked',
    ...overrides,
  };
}

function describe1(item: DayLayoutItem): string {
  if (item.kind === 'appt') return `appt ${item.appt.start.dateTime.slice(11)}`;
  return `gap ${item.gap.start}-${item.gap.end ?? 'open'}`;
}

describe('computeDayLayout', () => {
  it('returns one gap spanning the whole day when there are no appointments', () => {
    const layout = computeDayLayout([], { dayStart: '08:00', dayEnd: '20:00' });
    expect(layout.items.map(describe1)).toEqual(['gap 08:00-20:00']);
  });

  it('splits the day around one appointment', () => {
    const layout = computeDayLayout([apptAt('10:00', 30)], {
      dayStart: '08:00',
      dayEnd: '20:00',
    });
    expect(layout.items.map(describe1)).toEqual([
      'gap 08:00-10:00',
      'appt 10:00',
      'gap 10:30-20:00',
    ]);
  });

  it('does not create a zero-length gap between back-to-back appointments', () => {
    const layout = computeDayLayout(
      [apptAt('10:00', 30), apptAt('10:30', 30)],
      { dayStart: '08:00', dayEnd: '20:00' },
    );
    expect(layout.items.map(describe1)).toEqual([
      'gap 08:00-10:00',
      'appt 10:00',
      'appt 10:30',
      'gap 11:00-20:00',
    ]);
  });

  it('guards against unsorted input by sorting appointments by start', () => {
    const layout = computeDayLayout(
      [apptAt('10:30', 30), apptAt('10:00', 30)],
      { dayStart: '08:00', dayEnd: '20:00' },
    );
    expect(layout.items.map(describe1)).toEqual([
      'gap 08:00-10:00',
      'appt 10:00',
      'appt 10:30',
      'gap 11:00-20:00',
    ]);
  });

  it('renders a cancelled appointment but does not let it consume gap space', () => {
    const layout = computeDayLayout(
      [apptAt('10:00', 30, { status: 'cancelled' })],
      { dayStart: '08:00', dayEnd: '20:00' },
    );
    // The cancelled appointment still shows up (de-emphasised by the caller),
    // but the surrounding gap is NOT split around it: the full day stays one
    // free gap, so its time range is genuinely offerable again.
    expect(layout.items.map(describe1)).toEqual([
      'gap 08:00-20:00',
      'appt 10:00',
    ]);
  });

  it('lets a booked appointment sit inside the free time freed up by a cancellation', () => {
    // A cancelled slot at 10:00-10:30 does not block a real booking landing
    // on the exact same range.
    const layout = computeDayLayout(
      [apptAt('10:00', 30, { status: 'cancelled' }), apptAt('12:00', 30)],
      { dayStart: '08:00', dayEnd: '20:00' },
    );
    expect(layout.items.map(describe1)).toEqual([
      'gap 08:00-12:00',
      'appt 10:00',
      'appt 12:00',
      'gap 12:30-20:00',
    ]);
  });
});

describe('generateSlots', () => {
  it('steps by stepMinutes across the gap', () => {
    expect(
      generateSlots(
        { start: '09:00', end: '10:00' },
        { stepMinutes: 20, serviceMinutes: 20, dayEnd: '20:00' },
      ),
    ).toEqual(['09:00', '09:20', '09:40']);
  });

  it('excludes a start where serviceMinutes would overrun gap.end', () => {
    expect(
      generateSlots(
        { start: '10:00', end: '10:45' },
        { stepMinutes: 15, serviceMinutes: 30, dayEnd: '20:00' },
      ),
    ).toEqual(['10:00', '10:15']);
  });

  it('fits a slot that ends exactly at gap.end', () => {
    expect(
      generateSlots(
        { start: '10:00', end: '11:00' },
        { stepMinutes: 30, serviceMinutes: 30, dayEnd: '20:00' },
      ),
    ).toEqual(['10:00', '10:30']);
  });

  it('falls back to dayEnd as the boundary for an open-ended gap', () => {
    expect(
      generateSlots(
        { start: '19:50', end: null },
        { stepMinutes: 10, serviceMinutes: 15, dayEnd: '20:00' },
      ),
    ).toEqual([]);
  });

  it('caps the number of generated slots', () => {
    const slots = generateSlots(
      { start: '09:00', end: null },
      { stepMinutes: 15, serviceMinutes: 15, dayEnd: '20:00' },
    );
    expect(slots.length).toBe(8);
    expect(slots).toEqual([
      '09:00',
      '09:15',
      '09:30',
      '09:45',
      '10:00',
      '10:15',
      '10:30',
      '10:45',
    ]);
  });
});
