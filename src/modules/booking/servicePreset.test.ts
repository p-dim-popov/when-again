import { describe, expect, it } from 'vitest';
import { presetPatch } from './servicePreset';

describe('presetPatch', () => {
  it('carries the price through for a priced preset', () => {
    expect(
      presetPatch({ name: 'Colour', durationMinutes: 90, price: 60 }),
    ).toEqual({ service: 'Colour', durationMinutes: 90, price: 60 });
  });

  it('sets price to null (not undefined) for an unpriced preset', () => {
    expect(presetPatch({ name: 'Beard trim', durationMinutes: 15 })).toEqual({
      service: 'Beard trim',
      durationMinutes: 15,
      price: null,
    });
  });

  it('regression: switching from a priced preset to an unpriced one must not leave a stale price', () => {
    // Simulates applyPreset's two calls in sequence, as AppointmentForm
    // does when the user taps one preset chip then another. Both patches
    // must be applied to the same fields (form + draft) unconditionally, so
    // a `price: null` here always overwrites a previous `price: 60`.
    const priced = presetPatch({
      name: 'Colour',
      durationMinutes: 90,
      price: 60,
    });
    const unpriced = presetPatch({ name: 'Beard trim', durationMinutes: 15 });

    expect(priced.price).toBe(60);
    expect(unpriced.price).toBeNull();
    expect(unpriced).not.toHaveProperty('price', 60);
  });
});
