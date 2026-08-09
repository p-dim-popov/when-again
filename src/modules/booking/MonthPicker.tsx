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
    <div className="flex flex-col pb-2">
      <div className="px-[15px] pt-3.5 text-center">
        <h1 className="font-serif text-[15px] font-[680] tracking-[-0.01em]">
          {t('booking.pickDay')}
        </h1>
      </div>

      <div className="flex items-center justify-center gap-2.5 px-[13px] pt-2 pb-1.5">
        <button
          type="button"
          className="rounded-sm2 border-line bg-surface text-muted inline-flex size-[30px] flex-none cursor-pointer items-center justify-center border text-sm"
          aria-label={t('booking.nav.prevMonth')}
          onClick={goToPrevMonth}
        >
          ‹
        </button>
        <div className="text-ink min-w-[120px] text-center text-xs font-[620] capitalize">
          {monthYearLabel(language, viewYear, viewMonth)}
        </div>
        <button
          type="button"
          className="rounded-sm2 border-line bg-surface text-muted inline-flex size-[30px] flex-none cursor-pointer items-center justify-center border text-sm"
          aria-label={t('booking.nav.nextMonth')}
          onClick={goToNextMonth}
        >
          ›
        </button>
      </div>

      <div className="px-3.5 pt-0.5 pb-4">
        <div className="grid grid-cols-7 gap-[3px]">
          {weekdayLabels.map((label, i) => (
            <div
              key={`wd-${i}`}
              className="text-faint pt-1 pb-1.5 text-center text-[9.5px] tracking-[0.05em] uppercase"
            >
              {label}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) {
              return (
                <div key={`empty-${i}`} className="invisible aspect-square" />
              );
            }
            const isPast = cell.dateKey < todayDateKey;
            const isToday = cell.dateKey === todayDateKey;
            const isSelected = cell.dateKey === draft.dateKey;
            const hasDot = dottedDays.has(cell.dateKey);
            const className = [
              'relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-[10px] border-0 bg-transparent p-0 text-[13px] tabular-nums',
              isSelected
                ? 'bg-accent text-on-accent font-bold'
                : isPast
                  ? 'text-faint'
                  : 'text-ink',
              isPast && 'opacity-50',
              isToday && 'ring-accent-line ring-[1.5px] ring-inset',
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
                {hasDot && (
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 size-1 rounded-full ${
                      isSelected ? 'bg-on-accent/85' : 'bg-accent'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
