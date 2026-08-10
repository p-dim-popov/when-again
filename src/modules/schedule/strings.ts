import type { Strings } from '../i18n';

const en = {
  'schedule.weekday.mon.short': 'Mon',
  'schedule.weekday.tue.short': 'Tue',
  'schedule.weekday.wed.short': 'Wed',
  'schedule.weekday.thu.short': 'Thu',
  'schedule.weekday.fri.short': 'Fri',
  'schedule.weekday.sat.short': 'Sat',
  'schedule.weekday.sun.short': 'Sun',
  'schedule.weekday.mon.long': 'Monday',
  'schedule.weekday.tue.long': 'Tuesday',
  'schedule.weekday.wed.long': 'Wednesday',
  'schedule.weekday.thu.long': 'Thursday',
  'schedule.weekday.fri.long': 'Friday',
  'schedule.weekday.sat.long': 'Saturday',
  'schedule.weekday.sun.long': 'Sunday',
  'schedule.free': 'free',
  'schedule.today': 'today',
  'schedule.otherTime': 'other time',
  'schedule.relative.tomorrow': 'tomorrow',
  'schedule.relative.yesterday': 'yesterday',
  'schedule.relative.inDays': { one: 'in 1 day', other: 'in {count} days' },
  'schedule.relative.daysAgo': {
    one: '1 day ago',
    other: '{count} days ago',
  },
  'schedule.minutesShort': '{count} min',
  'schedule.cancelled': 'Cancelled',
  'schedule.loading': 'Loading…',
  'schedule.emptyDay': 'The whole day is free.',
  'schedule.nav.prevWeek': 'Previous week',
  'schedule.nav.nextWeek': 'Next week',
  'schedule.chooseMonth': 'Choose month',
  'schedule.timePicker.title': 'Other time',
  'schedule.timePicker.window': 'free {start} – {end}',
  'schedule.timePicker.subnote': 'Choose an exact time within the free window.',
  'schedule.timePicker.confirm': 'Choose · {time}',
  'schedule.timePicker.hours': 'Hours',
  'schedule.timePicker.minutes': 'Minutes',
} satisfies Strings;

const bg = {
  'schedule.weekday.mon.short': 'пн',
  'schedule.weekday.tue.short': 'вт',
  'schedule.weekday.wed.short': 'ср',
  'schedule.weekday.thu.short': 'чт',
  'schedule.weekday.fri.short': 'пт',
  'schedule.weekday.sat.short': 'сб',
  'schedule.weekday.sun.short': 'нд',
  'schedule.weekday.mon.long': 'Понеделник',
  'schedule.weekday.tue.long': 'Вторник',
  'schedule.weekday.wed.long': 'Сряда',
  'schedule.weekday.thu.long': 'Четвъртък',
  'schedule.weekday.fri.long': 'Петък',
  'schedule.weekday.sat.long': 'Събота',
  'schedule.weekday.sun.long': 'Неделя',
  'schedule.free': 'свободно',
  'schedule.today': 'днес',
  'schedule.otherTime': 'друг час',
  'schedule.relative.tomorrow': 'утре',
  'schedule.relative.yesterday': 'вчера',
  'schedule.relative.inDays': {
    one: 'след 1 ден',
    other: 'след {count} дни',
  },
  'schedule.relative.daysAgo': {
    one: 'преди 1 ден',
    other: 'преди {count} дни',
  },
  'schedule.minutesShort': '{count} мин',
  'schedule.cancelled': 'Отказан',
  'schedule.loading': 'Зареждане…',
  'schedule.emptyDay': 'Целият ден е свободен.',
  'schedule.nav.prevWeek': 'Предишна седмица',
  'schedule.nav.nextWeek': 'Следваща седмица',
  'schedule.chooseMonth': 'Изберете месец',
  'schedule.timePicker.title': 'Друг час',
  'schedule.timePicker.window': 'свободно {start} – {end}',
  'schedule.timePicker.subnote': 'Изберете точен час в свободния прозорец.',
  'schedule.timePicker.confirm': 'Избери · {time}',
  'schedule.timePicker.hours': 'Часове',
  'schedule.timePicker.minutes': 'Минути',
} satisfies Strings;

export const scheduleStrings = { en, bg };

declare module '../i18n' {
  interface TranslationKeys {
    'schedule.weekday.mon.short': true;
    'schedule.weekday.tue.short': true;
    'schedule.weekday.wed.short': true;
    'schedule.weekday.thu.short': true;
    'schedule.weekday.fri.short': true;
    'schedule.weekday.sat.short': true;
    'schedule.weekday.sun.short': true;
    'schedule.weekday.mon.long': true;
    'schedule.weekday.tue.long': true;
    'schedule.weekday.wed.long': true;
    'schedule.weekday.thu.long': true;
    'schedule.weekday.fri.long': true;
    'schedule.weekday.sat.long': true;
    'schedule.weekday.sun.long': true;
    'schedule.free': true;
    'schedule.today': true;
    'schedule.otherTime': true;
    'schedule.relative.tomorrow': true;
    'schedule.relative.yesterday': true;
    'schedule.relative.inDays': true;
    'schedule.relative.daysAgo': true;
    'schedule.minutesShort': true;
    'schedule.cancelled': true;
    'schedule.loading': true;
    'schedule.emptyDay': true;
    'schedule.nav.prevWeek': true;
    'schedule.nav.nextWeek': true;
    'schedule.chooseMonth': true;
    'schedule.timePicker.title': true;
    'schedule.timePicker.window': true;
    'schedule.timePicker.subnote': true;
    'schedule.timePicker.confirm': true;
    'schedule.timePicker.hours': true;
    'schedule.timePicker.minutes': true;
  }
}
