import { describe, expect, it } from 'vitest';
import { detectLanguage } from './detect';

describe('detectLanguage', () => {
  it('picks bg when a bg entry is present', () => {
    expect(detectLanguage({ languages: ['bg-BG', 'en-US'] })).toBe('bg');
  });

  it('picks en when an en entry is present', () => {
    expect(detectLanguage({ languages: ['en-GB'] })).toBe('en');
  });

  it('returns the first matching entry in order', () => {
    expect(detectLanguage({ languages: ['fr', 'bg', 'en'] })).toBe('bg');
  });

  it('falls back to en when neither is present', () => {
    expect(detectLanguage({ languages: ['de-DE', 'fr'] })).toBe('en');
  });

  it('falls back to en when languages is empty', () => {
    expect(detectLanguage({ languages: [] })).toBe('en');
  });

  it('reads the single language field when languages is absent', () => {
    expect(detectLanguage({ language: 'bg' })).toBe('bg');
  });
});
