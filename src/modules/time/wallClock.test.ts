import { describe, expect, it } from 'vitest';
import { compareWallClock, isBefore, wallClockNow } from './wallClock';

describe('wallClockNow', () => {
  it('formats a Date as local wall-clock YYYY-MM-DDTHH:mm', () => {
    const d = new Date(2026, 7, 21, 14, 5); // 2026-08-21 14:05 local
    expect(wallClockNow(d, 'Europe/Sofia')).toEqual({
      dateTime: '2026-08-21T14:05',
      timeZone: 'Europe/Sofia',
    });
  });

  it('defaults the timezone to the device timezone', () => {
    const wc = wallClockNow(new Date(2026, 0, 2, 3, 4));
    expect(wc.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(wc.dateTime).toBe('2026-01-02T03:04');
  });
});

describe('compareWallClock / isBefore', () => {
  const a = { dateTime: '2026-08-21T14:00', timeZone: 'Europe/Sofia' };
  const b = { dateTime: '2026-08-21T15:30', timeZone: 'Europe/Sofia' };

  it('orders by wall-clock datetime', () => {
    expect(compareWallClock(a, b)).toBeLessThan(0);
    expect(compareWallClock(b, a)).toBeGreaterThan(0);
    expect(compareWallClock(a, { ...a })).toBe(0);
  });

  it('isBefore mirrors the comparison', () => {
    expect(isBefore(a, b)).toBe(true);
    expect(isBefore(b, a)).toBe(false);
  });
});
