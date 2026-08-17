import { beforeEach, describe, expect, it } from 'vitest';
import { initI18n, registerStrings, t } from './index';

// Register test keys into the type system via the public-API augmentation path.
declare module './index' {
  interface TranslationKeys {
    greeting: true;
    'appt.count': true;
    'settings.title': true;
    missing: true;
  }
}

beforeEach(() => {
  registerStrings('en', {
    greeting: 'Hello, {name}',
    'appt.count': { one: '{count} appointment', other: '{count} appointments' },
  });
  registerStrings('bg', {
    greeting: 'Здравей, {name}',
    'appt.count': { one: '{count} час', other: '{count} часа' },
  });
  initI18n('en');
});

describe('t', () => {
  it('interpolates {var} placeholders', () => {
    expect(t('greeting', { name: 'Maria' })).toBe('Hello, Maria');
  });

  it('resolves the active language', () => {
    initI18n('bg');
    expect(t('greeting', { name: 'Мария' })).toBe('Здравей, Мария');
  });

  it('selects the English plural form by count', () => {
    expect(t('appt.count', { count: 1 })).toBe('1 appointment');
    expect(t('appt.count', { count: 5 })).toBe('5 appointments');
  });

  it('selects the Bulgarian plural form by count', () => {
    initI18n('bg');
    expect(t('appt.count', { count: 1 })).toBe('1 час');
    expect(t('appt.count', { count: 3 })).toBe('3 часа');
  });

  it('returns the key itself when the string is missing', () => {
    expect(t('missing')).toBe('missing');
  });

  it('merges later registration without clobbering earlier keys', () => {
    registerStrings('en', { 'settings.title': 'Settings' });
    expect(t('settings.title')).toBe('Settings');
    expect(t('greeting', { name: 'Sam' })).toBe('Hello, Sam');
  });

  it('plural selection is stable across repeated calls (cached rules)', () => {
    registerStrings('en', {
      'x.days': { one: 'in {count} day', other: 'in {count} days' },
    });
    initI18n('en');
    expect(t('x.days' as never, { count: 1 })).toBe('in 1 day');
    expect(t('x.days' as never, { count: 3 })).toBe('in 3 days');
    expect(t('x.days' as never, { count: 1 })).toBe('in 1 day');
  });
});
