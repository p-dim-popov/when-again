import { getActiveLanguage } from './i18n';

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(getActiveLanguage(), options).format(value);
}

export function formatCurrency(value: number, currency = 'BGN'): string {
  return new Intl.NumberFormat(getActiveLanguage(), {
    style: 'currency',
    currency,
  }).format(value);
}
