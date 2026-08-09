import type { Strings } from '../i18n';

// Month and weekday names are localized via `Intl.DateTimeFormat` (see
// `calendarGrid.ts`), keyed off the active language — only genuine UI-chrome
// copy lives here.
const en = {
  'booking.pickDay': 'Choose a day',
  'booking.nav.prevMonth': 'Previous month',
  'booking.nav.nextMonth': 'Next month',
} satisfies Strings;

const bg = {
  'booking.pickDay': 'Изберете ден',
  'booking.nav.prevMonth': 'Предишен месец',
  'booking.nav.nextMonth': 'Следващ месец',
} satisfies Strings;

export const bookingStrings = { en, bg };

declare module '../i18n' {
  interface TranslationKeys {
    'booking.pickDay': true;
    'booking.nav.prevMonth': true;
    'booking.nav.nextMonth': true;
  }
}
