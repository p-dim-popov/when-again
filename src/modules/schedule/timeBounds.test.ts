import { describe, expect, it } from 'vitest';
import { clampToGap, latestStartInGap } from './timeBounds';

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
