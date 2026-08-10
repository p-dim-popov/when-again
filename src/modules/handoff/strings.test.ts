import { describe, expect, it } from 'vitest';
import { handoffStrings } from './strings';

describe('handoffStrings', () => {
  it('exposes identical keys for en and bg', () => {
    expect(Object.keys(handoffStrings.bg).sort()).toEqual(
      Object.keys(handoffStrings.en).sort(),
    );
  });

  it('has non-empty string values', () => {
    for (const bundle of [handoffStrings.en, handoffStrings.bg]) {
      for (const value of Object.values(bundle)) {
        expect(String(value).length).toBeGreaterThan(0);
      }
    }
  });
});
