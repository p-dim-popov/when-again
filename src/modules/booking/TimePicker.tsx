import { useState } from 'react';
import { t } from '../i18n';
import { clampToGap } from './timeBounds';
import './TimePicker.css';

// Default step for the wheel, per the design brief (fine enough for a salon;
// not exposed as a prop — Task 6's callers all want the same granularity).
const STEP_MINUTES = 5;

// Mirrors schedule/ScheduleScreen.tsx's DAY_END. schedule doesn't export it
// (and booking must not import it anyway — schedule must not import booking,
// but more importantly this keeps timeBounds/TimePicker leaf-pure). Callers
// that know the real day-end (Task 6, wiring from the schedule screen) should
// pass it explicitly via the optional `dayEnd` prop; this is only the
// fallback for an open-ended gap when no better value is available.
const DEFAULT_DAY_END = '20:00';

interface Gap {
  start: string;
  end: string | null;
}

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

function toHHMM(minutes: number): string {
  const bounded = Math.min(Math.max(minutes, 0), 24 * 60 - 1);
  const hours = Math.floor(bounded / 60);
  const mins = bounded % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function TimePicker({
  gap,
  serviceMinutes,
  value,
  onPick,
  dayEnd = DEFAULT_DAY_END,
}: {
  gap: Gap;
  serviceMinutes: number;
  value?: string;
  onPick: (time: string) => void;
  dayEnd?: string;
}) {
  const opts = { stepMinutes: STEP_MINUTES, serviceMinutes, dayEnd };

  // Re-derive whenever the caller hands us a different gap/service/value
  // (e.g. Task 6 reopening the sheet for a different slot) so the picker
  // never keeps a stale selection that no longer fits. This adjusts state
  // during render (the React-recommended alternative to a setState-in-effect
  // for "reset derived state when inputs change") rather than an effect, to
  // avoid the extra render pass an effect would cause.
  const resetKey = `${gap.start}|${gap.end}|${serviceMinutes}|${value}|${dayEnd}`;
  const [selected, setSelected] = useState(() =>
    clampToGap(value ?? gap.start, gap, opts),
  );
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setSelected(clampToGap(value ?? gap.start, gap, opts));
  }

  const windowEnd = gap.end ?? dayEnd;

  function candidateFor(deltaMinutes: number): string {
    const raw = toHHMM(toMinutes(selected) + deltaMinutes);
    return clampToGap(raw, gap, opts);
  }

  const hourPrev = candidateFor(-60);
  const hourNext = candidateFor(60);
  const minutePrev = candidateFor(-STEP_MINUTES);
  const minuteNext = candidateFor(STEP_MINUTES);

  const [selHH, selMM] = selected.split(':');

  return (
    <div className="booking-tpSheet">
      <div className="booking-tpHandle" />
      <div className="booking-tpTitleRow">
        <span className="booking-tpTitle">{t('booking.timePicker.title')}</span>
        <span className="booking-tpWindow">
          {t('booking.timePicker.window', {
            start: gap.start,
            end: windowEnd,
          })}
        </span>
      </div>
      <p className="booking-tpSubnote">{t('booking.timePicker.subnote')}</p>

      <div className="booking-tpWheel">
        <div className="booking-tpBand" aria-hidden="true" />

        <div className="booking-tpCol">
          <button
            type="button"
            className="booking-tpVal"
            disabled={hourPrev === selected}
            aria-label={t('booking.timePicker.hourDown')}
            onClick={() => setSelected(hourPrev)}
          >
            {hourPrev.split(':')[0]}
          </button>
          <div className="booking-tpVal booking-tpVal-sel" aria-live="polite">
            {selHH}
          </div>
          <button
            type="button"
            className="booking-tpVal"
            disabled={hourNext === selected}
            aria-label={t('booking.timePicker.hourUp')}
            onClick={() => setSelected(hourNext)}
          >
            {hourNext.split(':')[0]}
          </button>
        </div>

        <div className="booking-tpSep">:</div>

        <div className="booking-tpCol">
          <button
            type="button"
            className="booking-tpVal"
            disabled={minutePrev === selected}
            aria-label={t('booking.timePicker.minuteDown')}
            onClick={() => setSelected(minutePrev)}
          >
            {minutePrev.split(':')[1]}
          </button>
          <div className="booking-tpVal booking-tpVal-sel" aria-live="polite">
            {selMM}
          </div>
          <button
            type="button"
            className="booking-tpVal"
            disabled={minuteNext === selected}
            aria-label={t('booking.timePicker.minuteUp')}
            onClick={() => setSelected(minuteNext)}
          >
            {minuteNext.split(':')[1]}
          </button>
        </div>
      </div>

      <p className="booking-tpCaption">
        {t('booking.timePicker.stepCaption', { step: STEP_MINUTES })}
      </p>

      <button
        type="button"
        className="booking-tpSave"
        // `selected` is always the output of clampToGap (set at init, on
        // every re-derive, and on every stepper click), so this can never
        // emit a time outside [gap.start, latestStart] — a clash with the
        // next appointment is impossible by construction.
        onClick={() => onPick(clampToGap(selected, gap, opts))}
      >
        {t('booking.timePicker.confirm', { time: selected })}
      </button>
    </div>
  );
}
