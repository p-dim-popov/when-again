import type { Strings } from '../i18n';

const en = {
  'shell.nav.label': 'Main navigation',
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
  'shell.update.message': 'A new version is ready.',
  'shell.update.action': 'Refresh',
  'shell.version.dev': 'dev',
  'shell.version.data': 'Data version',
  'shell.version.copy': 'Copy',
  'shell.version.copied': 'Copied',
  'shell.version.copyFailed': 'Could not copy.',
  'shell.version.check': 'Check for updates',
  'shell.version.checking': 'Checking…',
  'shell.version.upToDate': 'You are up to date.',
  'shell.version.updateAvailable': 'New version: {version}',
  'shell.version.checkFailed':
    'Could not check. Connect to the internet and try again.',
} satisfies Strings;

const bg = {
  'shell.nav.label': 'Основна навигация',
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
  'shell.update.message': 'Готова е нова версия.',
  'shell.update.action': 'Обнови',
  'shell.version.dev': 'dev',
  'shell.version.data': 'Версия на данните',
  'shell.version.copy': 'Копирай',
  'shell.version.copied': 'Копирано',
  'shell.version.copyFailed': 'Копирането е неуспешно.',
  'shell.version.check': 'Провери за нова версия',
  'shell.version.checking': 'Проверка…',
  'shell.version.upToDate': 'Използвате най-новата версия.',
  'shell.version.updateAvailable': 'Нова версия: {version}',
  'shell.version.checkFailed':
    'Проверката е неуспешна. Свържете се с интернет и опитайте отново.',
} satisfies Strings;

export const shellStrings = { en, bg };

declare module '../i18n' {
  interface TranslationKeys {
    'shell.nav.label': true;
    'shell.tab.today': true;
    'shell.tab.clients': true;
    'shell.tab.new': true;
    'shell.tab.settings': true;
    'shell.soon': true;
    'shell.placeholder.clients': true;
    'shell.placeholder.settings': true;
    'shell.settings.tagline': true;
    'shell.settings.lang.auto': true;
    'shell.update.message': true;
    'shell.update.action': true;
    'shell.version.dev': true;
    'shell.version.data': true;
    'shell.version.copy': true;
    'shell.version.copied': true;
    'shell.version.copyFailed': true;
    'shell.version.check': true;
    'shell.version.checking': true;
    'shell.version.upToDate': true;
    'shell.version.updateAvailable': true;
    'shell.version.checkFailed': true;
  }
}
