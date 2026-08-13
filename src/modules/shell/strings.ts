import type { Strings } from '../i18n';

const en = {
  'shell.nav.label': 'Main navigation',
  'shell.tab.today': 'Today',
  'shell.tab.clients': 'Clients',
  'shell.tab.new': 'New',
  'shell.tab.settings': 'Settings',
  'shell.soon': 'Coming soon',
  'shell.placeholder.clients': 'Clients',
  'shell.settings.lang.auto': 'Auto',
  'shell.settings.title': 'Settings',
  'shell.settings.mode.label': 'Mode',
  'shell.settings.mode.provider': 'Provider',
  'shell.settings.mode.client': 'Client',
  'shell.settings.profile.title': 'Profile',
  'shell.settings.profile.name': 'Business name',
  'shell.settings.profile.address': 'Address',
  'shell.settings.profile.save': 'Save',
  'shell.settings.profile.saved': 'Saved',
  'shell.settings.appearance.title': 'Appearance',
  'shell.settings.appearance.light': 'Light',
  'shell.settings.appearance.dark': 'Dark',
  'shell.settings.appearance.auto': 'Auto',
  'shell.settings.language.title': 'Language',
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
  'shell.clientHome.title': 'Your appointments',
  'shell.clientHome.upcoming': 'Upcoming',
  'shell.clientHome.past': 'Past',
  'shell.clientHome.cancelled': 'Cancelled',
  'shell.clientHome.empty':
    'Appointments you receive from a salon appear here.',
  'shell.chooser.title': 'How will you use it?',
  'shell.chooser.client': 'I book appointments',
  'shell.chooser.clientHint': 'See the visits a salon sends you.',
  'shell.chooser.provider': 'I manage a schedule',
  'shell.chooser.providerHint': 'Keep your calendar and share visits.',
  'shell.chooser.note': 'You can change this later in Settings.',
  'shell.tab.home': 'Home',
  'shell.settings.backup.title': 'Backup',
  'shell.settings.backup.export': 'Export backup',
  'shell.settings.backup.import': 'Import backup',
  'shell.settings.backup.confirm':
    'Replace all data with the backup from {date}?',
  'shell.settings.backup.confirmAction': 'Replace',
  'shell.settings.backup.cancelAction': 'Cancel',
  'shell.settings.backup.invalid': 'This file is not a valid backup.',
  'shell.settings.backup.last': 'Last backup: {date}',
  'shell.settings.backup.never': 'No backup yet.',
  'shell.settings.backup.stale': 'Your last backup is more than a month old.',
  'shell.settings.backup.exportFailed': 'Could not export. Try again.',
  'shell.settings.backup.importFailed':
    'Could not restore the backup. Try again.',
} satisfies Strings;

const bg = {
  'shell.nav.label': 'Основна навигация',
  'shell.tab.today': 'Днес',
  'shell.tab.clients': 'Клиенти',
  'shell.tab.new': 'Нов час',
  'shell.tab.settings': 'Настройки',
  'shell.soon': 'Скоро',
  'shell.placeholder.clients': 'Клиенти',
  'shell.settings.lang.auto': 'Автоматично',
  'shell.settings.title': 'Настройки',
  'shell.settings.mode.label': 'Режим',
  'shell.settings.mode.provider': 'Салон',
  'shell.settings.mode.client': 'Клиент',
  'shell.settings.profile.title': 'Профил',
  'shell.settings.profile.name': 'Име на салона',
  'shell.settings.profile.address': 'Адрес',
  'shell.settings.profile.save': 'Запази',
  'shell.settings.profile.saved': 'Запазено',
  'shell.settings.appearance.title': 'Изглед',
  'shell.settings.appearance.light': 'Светъл',
  'shell.settings.appearance.dark': 'Тъмен',
  'shell.settings.appearance.auto': 'Автоматично',
  'shell.settings.language.title': 'Език',
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
  'shell.clientHome.title': 'Вашите часове',
  'shell.clientHome.upcoming': 'Предстоящи',
  'shell.clientHome.past': 'Минали',
  'shell.clientHome.cancelled': 'Отменен',
  'shell.clientHome.empty':
    'Часовете, които получите от салон, се показват тук.',
  'shell.chooser.title': 'Как ще го използвате?',
  'shell.chooser.client': 'Записвам си часове',
  'shell.chooser.clientHint': 'Вижте часовете, които салонът ви изпраща.',
  'shell.chooser.provider': 'Управлявам график',
  'shell.chooser.providerHint': 'Водете календара си и споделяйте часове.',
  'shell.chooser.note': 'Можете да промените това по-късно в Настройки.',
  'shell.tab.home': 'Начало',
  'shell.settings.backup.title': 'Резервно копие',
  'shell.settings.backup.export': 'Изтегли резервно копие',
  'shell.settings.backup.import': 'Възстанови от копие',
  'shell.settings.backup.confirm':
    'Да заменим ли всички данни с копието от {date}?',
  'shell.settings.backup.confirmAction': 'Замени',
  'shell.settings.backup.cancelAction': 'Отказ',
  'shell.settings.backup.invalid': 'Този файл не е валидно резервно копие.',
  'shell.settings.backup.last': 'Последно копие: {date}',
  'shell.settings.backup.never': 'Все още няма резервно копие.',
  'shell.settings.backup.stale':
    'Последното ви копие е отпреди повече от месец.',
  'shell.settings.backup.exportFailed':
    'Изтеглянето е неуспешно. Опитайте отново.',
  'shell.settings.backup.importFailed':
    'Възстановяването е неуспешно. Опитайте отново.',
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
    'shell.settings.lang.auto': true;
    'shell.settings.title': true;
    'shell.settings.mode.label': true;
    'shell.settings.mode.provider': true;
    'shell.settings.mode.client': true;
    'shell.settings.profile.title': true;
    'shell.settings.profile.name': true;
    'shell.settings.profile.address': true;
    'shell.settings.profile.save': true;
    'shell.settings.profile.saved': true;
    'shell.settings.appearance.title': true;
    'shell.settings.appearance.light': true;
    'shell.settings.appearance.dark': true;
    'shell.settings.appearance.auto': true;
    'shell.settings.language.title': true;
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
    'shell.clientHome.title': true;
    'shell.clientHome.upcoming': true;
    'shell.clientHome.past': true;
    'shell.clientHome.cancelled': true;
    'shell.clientHome.empty': true;
    'shell.chooser.title': true;
    'shell.chooser.client': true;
    'shell.chooser.clientHint': true;
    'shell.chooser.provider': true;
    'shell.chooser.providerHint': true;
    'shell.chooser.note': true;
    'shell.tab.home': true;
    'shell.settings.backup.title': true;
    'shell.settings.backup.export': true;
    'shell.settings.backup.import': true;
    'shell.settings.backup.confirm': true;
    'shell.settings.backup.confirmAction': true;
    'shell.settings.backup.cancelAction': true;
    'shell.settings.backup.invalid': true;
    'shell.settings.backup.last': true;
    'shell.settings.backup.never': true;
    'shell.settings.backup.stale': true;
    'shell.settings.backup.exportFailed': true;
    'shell.settings.backup.importFailed': true;
  }
}
