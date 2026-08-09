import { describe, expect, it } from 'vitest';
import { shellStrings } from './strings';

describe('shellStrings', () => {
  it('exposes identical keys for en and bg', () => {
    expect(Object.keys(shellStrings.bg).sort()).toEqual(
      Object.keys(shellStrings.en).sort(),
    );
  });

  it('has non-empty string values', () => {
    for (const bundle of [shellStrings.en, shellStrings.bg]) {
      for (const value of Object.values(bundle)) {
        const length =
          typeof value === 'string' ? value.length : Object.keys(value).length;
        expect(length).toBeGreaterThan(0);
      }
    }
  });
});
