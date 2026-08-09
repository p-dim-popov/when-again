import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getActiveLanguage, t } from '../i18n';
import { listAllAppointments } from '../appointments';
import { parseDateKey, todayKey } from '../schedule';
import { setDraftDate, useBookingDraft } from './draftStore';
import {
  buildMonthGrid,
  monthYearLabel,
  weekdayShortLabels,
} from './calendarGrid';
import './MonthPicker.css';

// Step 1 of the booking funnel, ported from the "month picker" section of
// docs/design/epic-4/schedule-and-booking-flow.html. Selecting a day hands
// off to the ordinary schedule screen (step 2) via `/?date=<key>`, so the
// funnel never introduces a second time-picking UI.
export function MonthPicker() {
  const navigate = useNavigate();
  const draft = useBookingDraft();
  const language = getActiveLanguage();
  const todayDateKey = todayKey(new Date());
  const todayParts = parseDateKey(todayDateKey)!;

  const [viewYear, setViewYear] = useState(todayParts.y);
  const [viewMonth, setViewMonth] = useState(todayParts.m);

  const { data: appointments } = useQuery({
    queryKey: ['appointments', 'all'],
    queryFn: listAllAppointments,
  });

  const dottedDays = useMemo(() => {
    const days = new Set<string>();
    for (const appt of appointments ?? []) {
      if (appt.status === 'cancelled') continue;
      days.add(appt.start.dateTime.slice(0, 10));
    }
    return days;
  }, [appointments]);

  const cells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );
  const weekdayLabels = useMemo(() => weekdayShortLabels(language), [language]);

  function goToPrevMonth() {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function handleSelectDay(dateKey: string) {
    setDraftDate(dateKey);
    void navigate({ to: '/', search: { date: dateKey } });
  }

  return (
    <div className="booking">
      <div className="booking-head">
        <h1 className="booking-title">{t('booking.pickDay')}</h1>
      </div>

      <div className="booking-monthNav">
        <button
          type="button"
          className="booking-navBtn"
          aria-label={t('booking.nav.prevMonth')}
          onClick={goToPrevMonth}
        >
          ‹
        </button>
        <div className="booking-monthLabel">
          {monthYearLabel(language, viewYear, viewMonth)}
        </div>
        <button
          type="button"
          className="booking-navBtn"
          aria-label={t('booking.nav.nextMonth')}
          onClick={goToNextMonth}
        >
          ›
        </button>
      </div>

      <div className="booking-cal">
        <div className="booking-calGrid">
          {weekdayLabels.map((label, i) => (
            <div key={`wd-${i}`} className="booking-wd">
              {label}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) {
              return (
                <div
                  key={`empty-${i}`}
                  className="booking-day booking-day-empty"
                />
              );
            }
            const isPast = cell.dateKey < todayDateKey;
            const isToday = cell.dateKey === todayDateKey;
            const isSelected = cell.dateKey === draft.dateKey;
            const hasDot = dottedDays.has(cell.dateKey);
            const className = [
              'booking-day',
              isPast && 'booking-day-past',
              isToday && 'booking-day-today',
              isSelected && 'booking-day-selected',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={cell.dateKey}
                type="button"
                className={className}
                onClick={() => handleSelectDay(cell.dateKey)}
              >
                {cell.day}
                {hasDot && <span className="booking-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
