import { describe, expect, it } from 'vitest';
import { type ReceivedAppointment } from '../received';
import { classifyImport } from './classify';

const base: ReceivedAppointment = {
  id: 'appt-1',
  providerName: 'Салон Арома',
  service: 'Подстригване',
  start: { dateTime: '2026-08-15T15:00', timeZone: 'Europe/Sofia' },
  durationMinutes: 45,
  status: 'booked',
};

describe('classifyImport', () => {
  it('is "new" when the id is not stored and status is booked', () => {
    expect(classifyImport(base, undefined).kind).toBe('new');
  });

  it('is "upToDate" when the stored copy is identical', () => {
    expect(classifyImport(base, { ...base }).kind).toBe('upToDate');
  });

  it('is "changed" when a stored booked copy differs', () => {
    const stored = {
      ...base,
      start: { dateTime: '2026-08-15T16:00', timeZone: 'Europe/Sofia' },
    };
    const out = classifyImport(base, stored);
    expect(out.kind).toBe('changed');
    expect(out.kind === 'changed' && out.stored).toEqual(stored);
  });

  it('is "cancelled" whenever the incoming status is cancelled, seen or not', () => {
    const incoming = { ...base, status: 'cancelled' as const };
    expect(classifyImport(incoming, undefined).kind).toBe('cancelled');
    expect(classifyImport(incoming, { ...base }).kind).toBe('cancelled');
  });

  it('treats a status flip (cancelled → booked) as "changed"', () => {
    expect(classifyImport(base, { ...base, status: 'cancelled' }).kind).toBe(
      'changed',
    );
  });
});
