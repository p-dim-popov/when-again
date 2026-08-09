import { describe, expect, it } from 'vitest';
import { addDays, parseDateKey, todayKey, weekOf } from './dateParam';

describe('todayKey', () => {
  it('formats a fixed local date as YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 7, 9))).toBe('2026-08-09');
  });

  it('pads single-digit month and day', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('parseDateKey', () => {
  it('parses a valid date key', () => {
    expect(parseDateKey('2026-08-09')).toEqual({ y: 2026, m: 8, d: 9 });
  });

  it('returns null for a malformed string', () => {
    expect(parseDateKey('2026/08/09')).toBeNull();
    expect(parseDateKey('not-a-date')).toBeNull();
    expect(parseDateKey('')).toBeNull();
    expect(parseDateKey('2026-8-9')).toBeNull();
  });

  it('returns null for an out-of-range calendar date', () => {
    expect(parseDateKey('2026-02-30')).toBeNull();
    expect(parseDateKey('2026-13-01')).toBeNull();
    expect(parseDateKey('2026-00-10')).toBeNull();
  });
});

describe('addDays', () => {
  it('adds days within a month', () => {
    expect(addDays('2026-08-09', 3)).toBe('2026-08-12');
  });

  it('subtracts days', () => {
    expect(addDays('2026-08-09', -3)).toBe('2026-08-06');
  });

  it('crosses a month boundary', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('handles a leap-year February boundary', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('is a no-op when adding zero days', () => {
    expect(addDays('2026-08-09', 0)).toBe('2026-08-09');
  });
});

describe('weekOf', () => {
  it('returns the Monday-first week for a mid-week key', () => {
    // 2026-08-12 is a Wednesday.
    expect(weekOf('2026-08-12')).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ]);
  });

  it('puts a Sunday key at the end of its own week', () => {
    // 2026-08-16 is a Sunday; it should stay in the week starting Monday
    // 2026-08-10, not roll into the following week.
    expect(weekOf('2026-08-16')).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ]);
  });

  it('puts a Monday key at the start of its own week', () => {
    expect(weekOf('2026-08-10')).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ]);
  });

  it('handles a week that crosses a month boundary', () => {
    // 2026-08-31 is a Monday.
    expect(weekOf('2026-08-31')).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
  });
});

describe('week jump (day-view arrows)', () => {
  it('addDays(key, ±7) keeps the weekday and lands in the adjacent week', () => {
    const key = '2026-08-12'; // a Wednesday
    const next = addDays(key, 7);
    const prev = addDays(key, -7);
    expect(next).toBe('2026-08-19');
    expect(prev).toBe('2026-08-05');
    // same weekday index within its own week
    expect(weekOf(next).indexOf(next)).toBe(weekOf(key).indexOf(key));
    expect(weekOf(prev).indexOf(prev)).toBe(weekOf(key).indexOf(key));
  });
});
