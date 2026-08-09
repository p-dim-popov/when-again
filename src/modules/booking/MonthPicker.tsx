import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getActiveLanguage, t } from '../i18n';
import { listAllAppointments } from '../appointments';
import { parseDateKey, todayKey } from '../schedule';
import { resetDraft, setDraftDate, useBookingDraft } from './draftStore';
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
//
// Reached two ways: (1) the canonical ＋ Нов час entry (bottom bar), with no
// search params — a brand-new booking; (2) the day view's tappable month
// header (Task 7b), carrying the day it was opened from (`date`) and, during
// a reschedule detour, the appointment being edited (`appt`).
export function MonthPicker({ date, appt }: { date?: string; appt?: string }) {
  const navigate = useNavigate();
  const draft = useBookingDraft();
  const language = getActiveLanguage();
  const todayDateKey = todayKey(new Date());
  const todayParts = parseDateKey(todayDateKey)!;
  // Opening from a day view's month header (`date` present) shows THAT
  // month, not always the current one.
  const initialParts = date ? parseDateKey(date) : null;

  const [viewYear, setViewYear] = useState(
    initialParts ? initialParts.y : todayParts.y,
  );
  const [viewMonth, setViewMonth] = useState(
    initialParts ? initialParts.m : todayParts.m,
  );

  // Fresh-booking reset: the canonical ＋ Нов час entry has neither `date`
  // nor `appt` — that's the signal a brand-new booking is starting, so the
  // draft (which may still hold a prior edit's or booking's fields) is
  // cleared. Coming from the day view mid-flow (`date` present) or a
  // reschedule (`appt` present) preserves the draft instead. Guarded by a
  // ref so it fires once per mount, not on every render.
  const didResetOnMount = useRef(false);
  useEffect(() => {
    if (didResetOnMount.current) return;
    didResetOnMount.current = true;
    if (!date && !appt) {
      resetDraft();
    }
  }, [date, appt]);

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
    void navigate({
      to: '/',
      search: { date: dateKey, ...(appt ? { appt } : {}) },
    });
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
