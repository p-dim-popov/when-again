import type { Strings } from '../i18n';

// Month and weekday names are localized via `Intl.DateTimeFormat` (see
// `calendarGrid.ts`), keyed off the active language — only genuine UI-chrome
// copy lives here.
const en = {
  'booking.pickDay': 'Choose a day',
  'booking.nav.prevMonth': 'Previous month',
  'booking.nav.nextMonth': 'Next month',
  // Placeholder-route copy: `/appointment/new` renders a stand-in screen
  // until the real AppointmentForm lands (a later dispatch of this task).
  'booking.new.placeholder.title': 'New appointment',
  'booking.new.placeholder.echo': '{date} · {time}',
} satisfies Strings;

const bg = {
  'booking.pickDay': 'Изберете ден',
  'booking.nav.prevMonth': 'Предишен месец',
  'booking.nav.nextMonth': 'Следващ месец',
  'booking.new.placeholder.title': 'Нов час',
  'booking.new.placeholder.echo': '{date} · {time}',
} satisfies Strings;

export const bookingStrings = { en, bg };

declare module '../i18n' {
  interface TranslationKeys {
    'booking.pickDay': true;
    'booking.nav.prevMonth': true;
    'booking.nav.nextMonth': true;
    'booking.new.placeholder.title': true;
    'booking.new.placeholder.echo': true;
  }
}
