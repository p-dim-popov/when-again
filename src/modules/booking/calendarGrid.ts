// Pure calendar-grid helpers for the month picker. Grid math stays local to
// this module (Monday-first, matching `schedule/dateParam.ts`'s `weekOf`),
// while day keys themselves are produced via `schedule`'s `todayKey` so the
// 'YYYY-MM-DD' format stays canonical across modules.
import { todayKey } from '../schedule';
import type { Language } from '../i18n';

export interface CalendarDay {
  dateKey: string;
  day: number;
}

export type CalendarCell = CalendarDay | null;

/**
 * Builds a Monday-first calendar grid for the given year/month (`month` is
 * 1-12): leading `null` cells for the days before the 1st, then one cell per
 * day of the month.
 */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  // `Date#getDay()` is 0 (Sunday) .. 6 (Saturday); shift so Monday is 0.
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: CalendarCell[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ dateKey: todayKey(new Date(year, month - 1, day)), day });
  }
  return cells;
}

// A known Monday, used only to walk through one Monday-first week and format
// each day's weekday name — the specific date is otherwise meaningless.
const A_MONDAY = new Date(2024, 0, 1);

/** Monday-first weekday abbreviations (e.g. `['Mon', 'Tue', ...]`), localized. */
export function weekdayShortLabels(language: Language): string[] {
  const format = new Intl.DateTimeFormat(language, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(A_MONDAY);
    date.setDate(A_MONDAY.getDate() + i);
    return format.format(date);
  });
}

/** e.g. "August 2026" / "Август 2026", localized. */
export function monthYearLabel(
  language: Language,
  year: number,
  month: number,
): string {
  return new Intl.DateTimeFormat(language, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}
