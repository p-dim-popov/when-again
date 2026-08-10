import type { Strings } from '../i18n';

// Month and weekday names are localized via `Intl.DateTimeFormat` (see
// `calendarGrid.ts`), keyed off the active language — only genuine UI-chrome
// copy lives here.
const en = {
  'booking.pickDay': 'Choose a day',
  'booking.nav.prevMonth': 'Previous month',
  'booking.nav.nextMonth': 'Next month',

  // ShareLanding (Task 8) — the funnel's terminal screen after save, cancel,
  // or reschedule.
  'booking.landing.savedTitle': 'Appointment saved',
  'booking.landing.cancelledTitle': 'Appointment cancelled',
  'booking.landing.client': 'Client',
  'booking.landing.service': 'Service',
  'booking.landing.when': 'When',
  'booking.landing.duration': 'Duration',
  'booking.landing.price': 'Price',
  'booking.landing.shareSoon': 'Sharing (QR / link) coming soon',
  'booking.landing.done': 'Done',
  'booking.landing.empty': 'Nothing to show',

  // AppointmentForm (Task 6b)
  'booking.form.title': 'New appointment',
  // Edit mode (Task 7): shown when the form opened on an existing appointment.
  'booking.form.editTitle': 'Edit appointment',
  'booking.form.cancel': 'Cancel appointment',
  'booking.form.client': 'Client',
  'booking.form.client.placeholder': 'Search or add a name…',
  'booking.form.client.willCreate': 'New client — will be added when you save.',
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

  'booking.landing.savedTitle': 'Часът е записан',
  'booking.landing.cancelledTitle': 'Часът е отменен',
  'booking.landing.client': 'Клиент',
  'booking.landing.service': 'Услуга',
  'booking.landing.when': 'Кога',
  'booking.landing.duration': 'Времетраене',
  'booking.landing.price': 'Цена',
  'booking.landing.shareSoon': 'Споделяне (QR/връзка) идва скоро',
  'booking.landing.done': 'Готово',
  'booking.landing.empty': 'Няма какво да се покаже',

  'booking.form.title': 'Нов час',
  'booking.form.editTitle': 'Промяна на час',
  'booking.form.cancel': 'Откажи часа',
  'booking.form.client': 'Клиент',
  'booking.form.client.placeholder': 'Търси или добави име…',
  'booking.form.client.willCreate': 'Нов клиент — ще бъде добавен при запис.',
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

    'booking.landing.savedTitle': true;
    'booking.landing.cancelledTitle': true;
    'booking.landing.client': true;
    'booking.landing.service': true;
    'booking.landing.when': true;
    'booking.landing.duration': true;
    'booking.landing.price': true;
    'booking.landing.shareSoon': true;
    'booking.landing.done': true;
    'booking.landing.empty': true;

    'booking.form.title': true;
    'booking.form.editTitle': true;
    'booking.form.cancel': true;
    'booking.form.client': true;
    'booking.form.client.placeholder': true;
    'booking.form.client.willCreate': true;
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
