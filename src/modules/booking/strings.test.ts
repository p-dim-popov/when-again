import { describe, expect, it } from 'vitest';
import { bookingStrings } from './strings';

describe('bookingStrings', () => {
  it('exposes identical keys for en and bg', () => {
    expect(Object.keys(bookingStrings.bg).sort()).toEqual(
      Object.keys(bookingStrings.en).sort(),
    );
  });

  it('has non-empty string values', () => {
    for (const bundle of [bookingStrings.en, bookingStrings.bg]) {
      for (const value of Object.values(bundle)) {
        const length =
          typeof value === 'string' ? value.length : Object.keys(value).length;
        expect(length).toBeGreaterThan(0);
      }
    }
  });
});
