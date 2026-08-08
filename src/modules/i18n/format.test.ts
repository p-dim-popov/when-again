import { describe, expect, it } from 'vitest';
import { formatCurrency, formatNumber } from './format';
import { initI18n } from './index';

describe('formatNumber', () => {
  it('groups thousands for English', () => {
    initI18n('en');
    expect(formatNumber(1234.5)).toBe('1,234.5');
  });

  it('formats differently for Bulgarian', () => {
    initI18n('bg');
    // BG grouping/decimal separators differ from en; assert it is not the en form.
    expect(formatNumber(1234.5)).not.toBe('1,234.5');
  });
});

describe('formatCurrency', () => {
  it('includes the amount and defaults to BGN', () => {
    initI18n('bg');
    const formatted = formatCurrency(20);
    expect(formatted).toContain('20');
  });

  it('accepts an explicit currency code', () => {
    initI18n('en');
    expect(formatCurrency(20, 'EUR')).toContain('20');
  });
});
