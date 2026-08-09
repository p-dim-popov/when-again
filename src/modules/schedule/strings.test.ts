import { describe, expect, it } from 'vitest';
import { scheduleStrings } from './strings';

describe('scheduleStrings', () => {
  it('exposes identical keys for en and bg', () => {
    expect(Object.keys(scheduleStrings.bg).sort()).toEqual(
      Object.keys(scheduleStrings.en).sort(),
    );
  });

  it('has non-empty string values', () => {
    for (const bundle of [scheduleStrings.en, scheduleStrings.bg]) {
      for (const value of Object.values(bundle)) {
        const length =
          typeof value === 'string' ? value.length : Object.keys(value).length;
        expect(length).toBeGreaterThan(0);
      }
    }
  });
});
