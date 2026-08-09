import { describe, expect, it } from 'vitest';
import { buildMonthGrid } from './calendarGrid';

describe('buildMonthGrid', () => {
  it('builds a normal month (August 2026, 1st is a Saturday) with the right leading count and day-1 key', () => {
    const cells = buildMonthGrid(2026, 8);
    // Saturday is 5 days after Monday -> 5 leading nulls, then 31 day cells.
    expect(cells.length).toBe(5 + 31);
    expect(cells.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(cells[5]).toEqual({ dateKey: '2026-08-01', day: 1 });
    expect(cells[cells.length - 1]).toEqual({ dateKey: '2026-08-31', day: 31 });
  });

  it('produces 6 leading nulls when the 1st falls on a Sunday (Monday-first shift)', () => {
    // 2026-02-01 is a Sunday.
    const cells = buildMonthGrid(2026, 2);
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells[6]).toEqual({ dateKey: '2026-02-01', day: 1 });
  });

  it('gives February 28 day cells in a non-leap year', () => {
    const cells = buildMonthGrid(2026, 2);
    const dayCells = cells.filter((c) => c !== null);
    expect(dayCells.length).toBe(28);
    expect(dayCells[dayCells.length - 1]).toEqual({
      dateKey: '2026-02-28',
      day: 28,
    });
  });

  it('gives February 29 day cells in a leap year', () => {
    const cells = buildMonthGrid(2028, 2);
    const dayCells = cells.filter((c) => c !== null);
    expect(dayCells.length).toBe(29);
    expect(dayCells[dayCells.length - 1]).toEqual({
      dateKey: '2028-02-29',
      day: 29,
    });
  });

  it('gives a 31-day month (December 2026) the right number of day cells', () => {
    const cells = buildMonthGrid(2026, 12);
    const dayCells = cells.filter((c) => c !== null);
    expect(dayCells.length).toBe(31);
    expect(dayCells[0]).toEqual({ dateKey: '2026-12-01', day: 1 });
    expect(dayCells[dayCells.length - 1]).toEqual({
      dateKey: '2026-12-31',
      day: 31,
    });
  });
});
