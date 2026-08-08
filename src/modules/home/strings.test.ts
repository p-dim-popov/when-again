import { describe, expect, it } from 'vitest';
import { homeStrings } from './strings';

describe('homeStrings', () => {
  it('exposes identical keys for en and bg', () => {
    expect(Object.keys(homeStrings.bg).sort()).toEqual(
      Object.keys(homeStrings.en).sort(),
    );
  });

  it('has non-empty string values', () => {
    for (const bundle of [homeStrings.en, homeStrings.bg]) {
      for (const value of Object.values(bundle)) {
        const length =
          typeof value === 'string' ? value.length : Object.keys(value).length;
        expect(length).toBeGreaterThan(0);
      }
    }
  });
});
