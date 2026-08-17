import { describe, expect, it } from 'vitest';
import { countdownBucket } from './countdown';

describe('countdownBucket', () => {
  it('under an hour → minutes', () => {
    expect(countdownBucket('2026-09-01T14:20', '2026-09-01T15:00')).toEqual({
      kind: 'minutes',
      minutes: 40,
    });
  });
  it('exactly now → floors at 1 minute', () => {
    expect(countdownBucket('2026-09-01T15:00', '2026-09-01T15:00')).toEqual({
      kind: 'minutes',
      minutes: 1,
    });
  });
  it('across midnight but under an hour → minutes, not tomorrow', () => {
    expect(countdownBucket('2026-09-01T23:30', '2026-09-02T00:15')).toEqual({
      kind: 'minutes',
      minutes: 45,
    });
  });
  it('later the same day → today + time', () => {
    expect(countdownBucket('2026-09-01T08:00', '2026-09-01T15:00')).toEqual({
      kind: 'today',
      time: '15:00',
    });
  });
  it('next calendar day → tomorrow + time', () => {
    expect(countdownBucket('2026-09-01T08:00', '2026-09-02T09:30')).toEqual({
      kind: 'tomorrow',
      time: '09:30',
    });
  });
  it('further out → calendar-day difference', () => {
    expect(countdownBucket('2026-09-01T23:00', '2026-09-04T08:00')).toEqual({
      kind: 'days',
      days: 3,
    });
  });
  it('month boundary days are calendar days, not 24h blocks', () => {
    expect(countdownBucket('2026-08-31T23:50', '2026-09-02T00:10')).toEqual({
      kind: 'days',
      days: 2,
    });
  });
});
