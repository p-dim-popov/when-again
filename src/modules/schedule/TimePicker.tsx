import { useState } from 'react';
import { t } from '../i18n';
import { clampToGap } from './timeBounds';
import { DAY_END } from './dayWindow';
import './TimePicker.css';

// Default step for the wheel, per the design brief (fine enough for a salon;
// not exposed as a prop — all of this picker's callers want the same
// granularity).
const STEP_MINUTES = 5;

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
  // `DAY_END` (schedule/dayWindow.ts) is the single source of truth for the
  // day window; this fallback only matters for an open-ended gap when a
  // caller doesn't have a better value to pass (ScheduleScreen always does).
  dayEnd = DAY_END,
}: {
  gap: Gap;
  serviceMinutes: number;
  value?: string;
  onPick: (time: string) => void;
  dayEnd?: string;
}) {
  const opts = { stepMinutes: STEP_MINUTES, serviceMinutes, dayEnd };

  // Re-derive whenever the caller hands us a different gap/service/value
  // (e.g. ScheduleScreen reopening the sheet for a different gap) so the
  // picker never keeps a stale selection that no longer fits. This adjusts state
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
    <div className="schedule-tpSheet">
      <div className="schedule-tpHandle" />
      <div className="schedule-tpTitleRow">
        <span className="schedule-tpTitle">
          {t('schedule.timePicker.title')}
        </span>
        <span className="schedule-tpWindow">
          {t('schedule.timePicker.window', {
            start: gap.start,
            end: windowEnd,
          })}
        </span>
      </div>
      <p className="schedule-tpSubnote">{t('schedule.timePicker.subnote')}</p>

      <div className="schedule-tpWheel">
        <div className="schedule-tpBand" aria-hidden="true" />

        <div className="schedule-tpCol">
          <button
            type="button"
            className="schedule-tpVal"
            disabled={hourPrev === selected}
            aria-label={t('schedule.timePicker.hourDown')}
            onClick={() => setSelected(hourPrev)}
          >
            {hourPrev.split(':')[0]}
          </button>
          <div className="schedule-tpVal schedule-tpVal-sel" aria-live="polite">
            {selHH}
          </div>
          <button
            type="button"
            className="schedule-tpVal"
            disabled={hourNext === selected}
            aria-label={t('schedule.timePicker.hourUp')}
            onClick={() => setSelected(hourNext)}
          >
            {hourNext.split(':')[0]}
          </button>
        </div>

        <div className="schedule-tpSep">:</div>

        <div className="schedule-tpCol">
          <button
            type="button"
            className="schedule-tpVal"
            disabled={minutePrev === selected}
            aria-label={t('schedule.timePicker.minuteDown')}
            onClick={() => setSelected(minutePrev)}
          >
            {minutePrev.split(':')[1]}
          </button>
          <div className="schedule-tpVal schedule-tpVal-sel" aria-live="polite">
            {selMM}
          </div>
          <button
            type="button"
            className="schedule-tpVal"
            disabled={minuteNext === selected}
            aria-label={t('schedule.timePicker.minuteUp')}
            onClick={() => setSelected(minuteNext)}
          >
            {minuteNext.split(':')[1]}
          </button>
        </div>
      </div>

      <p className="schedule-tpCaption">
        {t('schedule.timePicker.stepCaption', { step: STEP_MINUTES })}
      </p>

      <button
        type="button"
        className="schedule-tpSave"
        // `selected` is always the output of clampToGap (set at init, on
        // every re-derive, and on every stepper click), so this can never
        // emit a time outside [gap.start, latestStart] — a clash with the
        // next appointment is impossible by construction.
        onClick={() => onPick(clampToGap(selected, gap, opts))}
      >
        {t('schedule.timePicker.confirm', { time: selected })}
      </button>
    </div>
  );
}
