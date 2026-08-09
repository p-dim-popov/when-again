import type { Strings } from '../i18n';

// Month and weekday names are localized via `Intl.DateTimeFormat` (see
// `calendarGrid.ts`), keyed off the active language — only genuine UI-chrome
// copy lives here.
const en = {
  'booking.pickDay': 'Choose a day',
  'booking.nav.prevMonth': 'Previous month',
  'booking.nav.nextMonth': 'Next month',
  'booking.timePicker.title': 'Other time',
  'booking.timePicker.window': 'free {start} – {end}',
  'booking.timePicker.subnote': 'Choose an exact time within the free window.',
  'booking.timePicker.stepCaption': 'step {step} min',
  'booking.timePicker.confirm': 'Choose · {time}',
  'booking.timePicker.hourDown': 'Earlier hour',
  'booking.timePicker.hourUp': 'Later hour',
  'booking.timePicker.minuteDown': 'Earlier minute',
  'booking.timePicker.minuteUp': 'Later minute',
} satisfies Strings;

const bg = {
  'booking.pickDay': 'Изберете ден',
  'booking.nav.prevMonth': 'Предишен месец',
  'booking.nav.nextMonth': 'Следващ месец',
  'booking.timePicker.title': 'Друг час',
  'booking.timePicker.window': 'свободно {start} – {end}',
  'booking.timePicker.subnote': 'Изберете точен час в свободния прозорец.',
  'booking.timePicker.stepCaption': 'стъпка {step} мин',
  'booking.timePicker.confirm': 'Избери · {time}',
  'booking.timePicker.hourDown': 'По-ранен час',
  'booking.timePicker.hourUp': 'По-късен час',
  'booking.timePicker.minuteDown': 'По-ранна минута',
  'booking.timePicker.minuteUp': 'По-късна минута',
} satisfies Strings;

export const bookingStrings = { en, bg };

declare module '../i18n' {
  interface TranslationKeys {
    'booking.pickDay': true;
    'booking.nav.prevMonth': true;
    'booking.nav.nextMonth': true;
    'booking.timePicker.title': true;
    'booking.timePicker.window': true;
    'booking.timePicker.subnote': true;
    'booking.timePicker.stepCaption': true;
    'booking.timePicker.confirm': true;
    'booking.timePicker.hourDown': true;
    'booking.timePicker.hourUp': true;
    'booking.timePicker.minuteDown': true;
    'booking.timePicker.minuteUp': true;
  }
}
