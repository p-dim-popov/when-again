import type { Strings } from '../i18n';

const en = {
  // Provider share widget
  'handoff.share.link': 'Share link',
  'handoff.share.copy': 'Copy link',
  'handoff.share.copied': 'Link copied',
  'handoff.share.copyFailed': "Couldn't copy the link",
  'handoff.share.setNameHint':
    'Set your name in Settings so clients see who the appointment is from.',
  // Import screen — titles
  'handoff.import.new.title': 'New appointment',
  'handoff.import.changed.title': 'Updated appointment',
  'handoff.import.cancelled.title': 'Appointment cancelled',
  'handoff.import.upToDate.title': 'Already added',
  // Import screen — field labels
  'handoff.field.provider': 'From',
  'handoff.field.service': 'Service',
  'handoff.field.when': 'When',
  'handoff.field.duration': 'Duration',
  'handoff.field.address': 'Address',
  'handoff.import.previously': 'was {value}',
  // Import screen — actions + confirmations
  'handoff.import.add': 'Add appointment',
  'handoff.import.update': 'Update',
  'handoff.import.ok': 'OK',
  'handoff.import.done': 'Done',
  'handoff.import.added': 'Added',
  'handoff.import.updated': 'Updated',
  'handoff.import.removed': 'Cancelled',
  'handoff.import.writeFailed': "Couldn't save. Try again.",
  // Import screen — edge states
  'handoff.import.invalid.malformed': "This link isn't valid.",
  'handoff.import.invalid.version':
    'This link is from a newer version. Update the app to open it.',
  'handoff.import.empty': 'Nothing to import.',
} satisfies Strings;

const bg = {
  'handoff.share.link': 'Сподели връзка',
  'handoff.share.copy': 'Копирай връзка',
  'handoff.share.copied': 'Връзката е копирана',
  'handoff.share.copyFailed': 'Връзката не бе копирана',
  'handoff.share.setNameHint':
    'Въведете името си в Настройки, за да виждат клиентите от кого е часът.',
  'handoff.import.new.title': 'Нов час',
  'handoff.import.changed.title': 'Променен час',
  'handoff.import.cancelled.title': 'Отменен час',
  'handoff.import.upToDate.title': 'Вече е добавен',
  'handoff.field.provider': 'От',
  'handoff.field.service': 'Услуга',
  'handoff.field.when': 'Кога',
  'handoff.field.duration': 'Времетраене',
  'handoff.field.address': 'Адрес',
  'handoff.import.previously': 'беше {value}',
  'handoff.import.add': 'Добави часа',
  'handoff.import.update': 'Обнови',
  'handoff.import.ok': 'Добре',
  'handoff.import.done': 'Готово',
  'handoff.import.added': 'Добавен',
  'handoff.import.updated': 'Обновен',
  'handoff.import.removed': 'Отменен',
  'handoff.import.writeFailed': 'Неуспешен запис. Опитайте отново.',
  'handoff.import.invalid.malformed': 'Тази връзка е невалидна.',
  'handoff.import.invalid.version':
    'Тази връзка е от по-нова версия. Обновете приложението.',
  'handoff.import.empty': 'Няма какво да се внесе.',
} satisfies Strings;

export const handoffStrings = { en, bg };

declare module '../i18n' {
  interface TranslationKeys {
    'handoff.share.link': true;
    'handoff.share.copy': true;
    'handoff.share.copied': true;
    'handoff.share.copyFailed': true;
    'handoff.share.setNameHint': true;
    'handoff.import.new.title': true;
    'handoff.import.changed.title': true;
    'handoff.import.cancelled.title': true;
    'handoff.import.upToDate.title': true;
    'handoff.field.provider': true;
    'handoff.field.service': true;
    'handoff.field.when': true;
    'handoff.field.duration': true;
    'handoff.field.address': true;
    'handoff.import.previously': true;
    'handoff.import.add': true;
    'handoff.import.update': true;
    'handoff.import.ok': true;
    'handoff.import.done': true;
    'handoff.import.added': true;
    'handoff.import.updated': true;
    'handoff.import.removed': true;
    'handoff.import.writeFailed': true;
    'handoff.import.invalid.malformed': true;
    'handoff.import.invalid.version': true;
    'handoff.import.empty': true;
  }
}
