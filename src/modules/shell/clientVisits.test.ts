import { describe, expect, it } from 'vitest';
import { partitionVisits } from './clientVisits';
import type { ReceivedAppointment } from '../received';

function visit(
  id: string,
  dateTime: string,
  status: 'booked' | 'cancelled' = 'booked',
): ReceivedAppointment {
  return {
    id,
    providerName: 'Salon',
    service: 'Cut',
    start: { dateTime, timeZone: 'Europe/Sofia' },
    durationMinutes: 30,
    status,
  };
}

describe('partitionVisits', () => {
  const now = '2026-08-12T10:00';

  it('splits around now: upcoming soonest-first, past most-recent-first', () => {
    const { upcoming, past } = partitionVisits(
      [
        visit('a', '2026-08-20T09:00'),
        visit('b', '2026-08-13T15:00'),
        visit('c', '2026-08-01T11:00'),
        visit('d', '2026-08-10T18:30'),
      ],
      now,
    );
    expect(upcoming.map((v) => v.id)).toEqual(['b', 'a']);
    expect(past.map((v) => v.id)).toEqual(['d', 'c']);
  });

  it('counts an appointment starting exactly now as upcoming', () => {
    const { upcoming, past } = partitionVisits([visit('x', now)], now);
    expect(upcoming.map((v) => v.id)).toEqual(['x']);
    expect(past).toEqual([]);
  });

  it('keeps cancelled visits in time order (display handles the strike-through)', () => {
    const { upcoming } = partitionVisits(
      [
        visit('a', '2026-08-14T10:00'),
        visit('b', '2026-08-13T10:00', 'cancelled'),
      ],
      now,
    );
    expect(upcoming.map((v) => v.id)).toEqual(['b', 'a']);
  });
});
