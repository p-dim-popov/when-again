import type { Strings } from '../i18n';

// Month and weekday names are localized via `Intl.DateTimeFormat` (see
// `calendarGrid.ts`), keyed off the active language — only genuine UI-chrome
// copy lives here.
const en = {
  'booking.pickDay': 'Choose a day',
  'booking.nav.prevMonth': 'Previous month',
  'booking.nav.nextMonth': 'Next month',
  // Placeholder-route copy: `/appointment/saved` renders a stand-in screen
  // until the real ShareLanding lands (Task 8).
  'booking.saved.placeholder.title': 'Appointment saved',

  // AppointmentForm (Task 6b)
  'booking.form.title': 'New appointment',
  'booking.form.client': 'Client',
  'booking.form.client.placeholder': 'Search or create…',
  'booking.form.client.create': 'Create "{name}"',
  'booking.form.service': 'Service',
  'booking.form.service.placeholder': 'Service name',
  'booking.form.when': 'When',
  'booking.form.change': 'Change',
  'booking.form.duration': 'Duration',
  'booking.form.duration.suffix': 'min',
  'booking.form.price': 'Price (optional)',
  'booking.form.price.placeholder': '—',
  'booking.form.save': 'Save · share',
  'booking.form.saving': 'Saving…',
  'booking.form.error.required':
    'Fill in the client, service, and time before you save.',
} satisfies Strings;

const bg = {
  'booking.pickDay': 'Изберете ден',
  'booking.nav.prevMonth': 'Предишен месец',
  'booking.nav.nextMonth': 'Следващ месец',
  'booking.saved.placeholder.title': 'Записан час',

  'booking.form.title': 'Нов час',
  'booking.form.client': 'Клиент',
  'booking.form.client.placeholder': 'Търси или създай…',
  'booking.form.client.create': 'Създай „{name}“',
  'booking.form.service': 'Услуга',
  'booking.form.service.placeholder': 'Име на услугата',
  'booking.form.when': 'Кога',
  'booking.form.change': 'Промени',
  'booking.form.duration': 'Времетраене',
  'booking.form.duration.suffix': 'мин',
  'booking.form.price': 'Цена (по избор)',
  'booking.form.price.placeholder': '—',
  'booking.form.save': 'Запази · сподели',
  'booking.form.saving': 'Запазване…',
  'booking.form.error.required':
    'Попълнете клиент, услуга и час, преди да запазите.',
} satisfies Strings;

export const bookingStrings = { en, bg };

declare module '../i18n' {
  interface TranslationKeys {
    'booking.pickDay': true;
    'booking.nav.prevMonth': true;
    'booking.nav.nextMonth': true;
    'booking.saved.placeholder.title': true;

    'booking.form.title': true;
    'booking.form.client': true;
    'booking.form.client.placeholder': true;
    'booking.form.client.create': true;
    'booking.form.service': true;
    'booking.form.service.placeholder': true;
    'booking.form.when': true;
    'booking.form.change': true;
    'booking.form.duration': true;
    'booking.form.duration.suffix': true;
    'booking.form.price': true;
    'booking.form.price.placeholder': true;
    'booking.form.save': true;
    'booking.form.saving': true;
    'booking.form.error.required': true;
  }
}
