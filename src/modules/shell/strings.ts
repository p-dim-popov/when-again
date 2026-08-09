import type { Strings } from '../i18n';

const en = {
  'shell.tab.today': 'Today',
  'shell.tab.clients': 'Clients',
  'shell.tab.new': 'New',
  'shell.tab.settings': 'Settings',
  'shell.soon': 'Coming soon',
  'shell.placeholder.clients': 'Clients',
  'shell.placeholder.settings': 'Settings',
  'shell.settings.tagline':
    'Appointment reminders. No server. No accounts. No fees.',
  'shell.settings.lang.auto': 'Auto',
} satisfies Strings;

const bg = {
  'shell.tab.today': 'Днес',
  'shell.tab.clients': 'Клиенти',
  'shell.tab.new': 'Нов час',
  'shell.tab.settings': 'Настройки',
  'shell.soon': 'Скоро',
  'shell.placeholder.clients': 'Клиенти',
  'shell.placeholder.settings': 'Настройки',
  'shell.settings.tagline':
    'Напомняния за часове. Без сървър. Без акаунти. Без такси.',
  'shell.settings.lang.auto': 'Автоматично',
} satisfies Strings;

export const shellStrings = { en, bg };

declare module '../i18n' {
  interface TranslationKeys {
    'shell.tab.today': true;
    'shell.tab.clients': true;
    'shell.tab.new': true;
    'shell.tab.settings': true;
    'shell.soon': true;
    'shell.placeholder.clients': true;
    'shell.placeholder.settings': true;
    'shell.settings.tagline': true;
    'shell.settings.lang.auto': true;
  }
}
