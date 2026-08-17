import { describe, expect, it } from 'vitest';
import {
  nextVisitByProvider,
  partitionVisits,
  selectNextVisit,
} from './clientVisits';
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

describe('selectNextVisit', () => {
  it('picks the earliest upcoming non-cancelled visit', () => {
    const upcoming = [
      visit('v1', '2026-09-01T10:00', 'cancelled'),
      visit('v2', '2026-09-02T10:00', 'booked'),
      visit('v3', '2026-09-03T10:00', 'booked'),
    ];
    expect(selectNextVisit(upcoming)?.id).toBe('v2');
  });
  it('returns undefined when everything upcoming is cancelled', () => {
    expect(
      selectNextVisit([visit('v1', '2026-09-01T10:00', 'cancelled')]),
    ).toBeUndefined();
  });
});

describe('nextVisitByProvider', () => {
  it('maps each provider to its earliest upcoming non-cancelled visit', () => {
    const items = [
      { ...visit('v1', '2026-09-05T10:00', 'booked'), providerId: 'p1' },
      { ...visit('v2', '2026-09-02T10:00', 'booked'), providerId: 'p1' },
      { ...visit('v3', '2026-09-03T10:00', 'cancelled'), providerId: 'p2' },
      { ...visit('v4', '2026-08-01T10:00', 'booked'), providerId: 'p2' }, // past
    ];
    const map = nextVisitByProvider(items, '2026-09-01T00:00');
    expect(map.get('p1')?.id).toBe('v2');
    expect(map.has('p2')).toBe(false);
  });
});
