import { describe, expect, it } from 'vitest';
import type { ServicePreset } from '../settings';
import { rememberService } from './remembered';

describe('rememberService', () => {
  it('adds a brand-new service to the front of an empty list', () => {
    const result = rememberService([], {
      name: 'Haircut',
      durationMinutes: 30,
      price: 25,
    });
    expect(result).toEqual([
      { name: 'Haircut', durationMinutes: 30, price: 25 },
    ]);
  });

  it('adds a brand-new service to the front of a non-empty list', () => {
    const services: ServicePreset[] = [
      { name: 'Beard trim', durationMinutes: 15 },
    ];
    const result = rememberService(services, {
      name: 'Haircut',
      durationMinutes: 30,
      price: 25,
    });
    expect(result).toEqual([
      { name: 'Haircut', durationMinutes: 30, price: 25 },
      { name: 'Beard trim', durationMinutes: 15 },
    ]);
  });

  it('moves an existing case-insensitive match to the front and updates its duration/price', () => {
    const services: ServicePreset[] = [
      { name: 'Beard trim', durationMinutes: 15 },
      { name: 'haircut', durationMinutes: 20, price: 18 },
      { name: 'Colour', durationMinutes: 90, price: 60 },
    ];
    const result = rememberService(services, {
      name: 'Haircut',
      durationMinutes: 35,
      price: 28,
    });
    expect(result).toEqual([
      { name: 'Haircut', durationMinutes: 35, price: 28 },
      { name: 'Beard trim', durationMinutes: 15 },
      { name: 'Colour', durationMinutes: 90, price: 60 },
    ]);
  });

  it('does not mutate the input array or its elements', () => {
    const services: ServicePreset[] = [
      { name: 'Beard trim', durationMinutes: 15 },
    ];
    const servicesCopy = services.map((s) => ({ ...s }));

    const result = rememberService(services, {
      name: 'Haircut',
      durationMinutes: 30,
    });

    expect(services).toEqual(servicesCopy);
    expect(result).not.toBe(services);
    expect(result[0]).not.toBe(services[0]);
  });

  it('handles the empty-list case', () => {
    const result = rememberService([], {
      name: 'Haircut',
      durationMinutes: 30,
    });
    expect(result).toEqual([{ name: 'Haircut', durationMinutes: 30 }]);
  });

  it('drops price when the remembered entry has none, even if the existing preset had one', () => {
    const services: ServicePreset[] = [
      { name: 'Haircut', durationMinutes: 20, price: 18 },
    ];
    const result = rememberService(services, {
      name: 'Haircut',
      durationMinutes: 25,
    });
    expect(result).toEqual([{ name: 'Haircut', durationMinutes: 25 }]);
  });
});
