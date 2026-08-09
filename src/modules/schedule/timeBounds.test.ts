import { describe, expect, it } from 'vitest';
import {
  clampToGap,
  latestStartInGap,
  validStartTimes,
  wheelColumns,
  nearestMinute,
} from './timeBounds';

describe('latestStartInGap', () => {
  it('returns the latest start that leaves room for serviceMinutes before gap.end', () => {
    // gap 10:30-12:00, 30-min service -> latest start is 11:30 (11:30+30=12:00, exactly fits).
    expect(
      latestStartInGap(
        { start: '10:30', end: '12:00' },
        { serviceMinutes: 30, dayEnd: '18:00' },
      ),
    ).toBe('11:30');
  });

  it('uses dayEnd as the boundary when the gap is open-ended', () => {
    expect(
      latestStartInGap(
        { start: '16:00', end: null },
        { serviceMinutes: 30, dayEnd: '18:00' },
      ),
    ).toBe('17:30');
  });

  it('clamps to gap.start when the gap is too small to fit serviceMinutes', () => {
    // gap 10:30-10:40 (10 min) can't fit a 30-min service -> falls back to gap.start.
    expect(
      latestStartInGap(
        { start: '10:30', end: '10:40' },
        { serviceMinutes: 30, dayEnd: '18:00' },
      ),
    ).toBe('10:30');
  });
});

describe('clampToGap', () => {
  const gap = { start: '10:30', end: '12:00' };
  const opts = { stepMinutes: 5, serviceMinutes: 30, dayEnd: '18:00' };

  it('snaps to the nearest step (11:13 -> 11:15 at step 5)', () => {
    expect(clampToGap('11:13', gap, opts)).toBe('11:15');
  });

  it('snaps down when nearer to the lower step (11:12 -> 11:10 at step 5)', () => {
    expect(clampToGap('11:12', gap, opts)).toBe('11:10');
  });

  it('clamps a time below gap.start up to gap.start', () => {
    expect(clampToGap('09:00', gap, opts)).toBe('10:30');
  });

  it('clamps a time above latestStart down to latestStart (inclusive-fit edge)', () => {
    // latestStart for this gap+service is 11:30 (11:30+30=12:00).
    expect(clampToGap('11:55', gap, opts)).toBe('11:30');
  });

  it('accepts the exact latestStart unchanged', () => {
    expect(clampToGap('11:30', gap, opts)).toBe('11:30');
  });

  it('uses dayEnd as the boundary for an open-ended gap', () => {
    const openGap = { start: '16:00', end: null };
    expect(clampToGap('17:58', openGap, opts)).toBe('17:30');
  });

  it('returns gap.start when the gap is too small to fit serviceMinutes', () => {
    const tinyGap = { start: '10:30', end: '10:40' };
    expect(clampToGap('10:37', tinyGap, opts)).toBe('10:30');
  });
});

describe('validStartTimes', () => {
  const opts = { stepMinutes: 5, serviceMinutes: 30, dayEnd: '20:00' };

  it('lists grid-aligned starts that fit before a closed boundary', () => {
    // gap 09:00–10:00, 30-min service → last fit 09:30
    expect(validStartTimes({ start: '09:00', end: '10:00' }, opts)).toEqual([
      '09:00', '09:05', '09:10', '09:15', '09:20', '09:25', '09:30',
    ]);
  });

  it('resolves an open-ended gap against dayEnd', () => {
    const times = validStartTimes({ start: '19:00', end: null }, opts);
    expect(times[0]).toBe('19:00');
    expect(times[times.length - 1]).toBe('19:30'); // last fit before 20:00
  });

  it('returns [] when the service cannot fit', () => {
    expect(validStartTimes({ start: '09:45', end: '10:00' }, opts)).toEqual([]);
  });

  it('spans hours, so the last hour offers only its fitting minutes', () => {
    // gap 09:40–11:00 → last fit 10:30; hour 10 stops at :30
    const times = validStartTimes({ start: '09:40', end: '11:00' }, opts);
    expect(times[0]).toBe('09:40');
    expect(times).toContain('10:30');
    expect(times).not.toContain('10:35');
  });
});

describe('wheelColumns', () => {
  it('splits into distinct hours and per-hour minutes', () => {
    const { hours, minutesByHour } = wheelColumns([
      '09:40', '09:45', '10:00', '10:05',
    ]);
    expect(hours).toEqual(['09', '10']);
    expect(minutesByHour.get('09')).toEqual(['40', '45']);
    expect(minutesByHour.get('10')).toEqual(['00', '05']);
  });
});

describe('nearestMinute', () => {
  it('finds the closest valid minute, ties to the lower', () => {
    expect(nearestMinute(['00', '05', '10'], '07')).toBe('05');
    expect(nearestMinute(['00', '10'], '05')).toBe('00'); // tie → lower
    expect(nearestMinute(['30', '35'], '05')).toBe('30'); // clamp up
  });
});
