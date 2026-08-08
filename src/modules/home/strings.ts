import type { Strings } from '../i18n';

const en = {
  'home.title': 'when-again',
  'home.tagline': 'Appointment reminders. No server. No accounts. No fees.',
  'home.lang.auto': 'Auto',
} satisfies Strings;

const bg = {
  'home.title': 'when-again',
  'home.tagline': 'Напомняния за часове. Без сървър. Без акаунти. Без такси.',
  'home.lang.auto': 'Автоматично',
} satisfies Strings;

export const homeStrings = { en, bg };

declare module '../i18n' {
  interface TranslationKeys {
    'home.title': true;
    'home.tagline': true;
    'home.lang.auto': true;
  }
}
