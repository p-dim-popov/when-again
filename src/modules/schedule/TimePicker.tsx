import { useState } from 'react';
import { t } from '../i18n';
import { clampToGap, toHHMM, toMinutes } from './timeBounds';
import { DAY_END } from './dayWindow';

// Default step for the wheel, per the design brief (fine enough for a salon;
// not exposed as a prop — all of this picker's callers want the same
// granularity).
const STEP_MINUTES = 5;

interface Gap {
  start: string;
  end: string | null;
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

  // Unselected stepper value: a plain, borderless tap target that steps the
  // hour/minute up or down.
  const valClass =
    'text-faint m-0 cursor-pointer border-0 bg-transparent p-1 text-[15px] leading-none tabular-nums disabled:cursor-default disabled:opacity-[0.35]';
  // The center (selected) value in each column: larger, bold, non-interactive.
  const selClass =
    'text-accent-ink cursor-default text-[22px] leading-none font-extrabold tabular-nums';

  return (
    <div
      data-testid="time-sheet"
      className="bg-surface shadow-sheet fixed inset-x-0 bottom-0 z-[3] rounded-t-[22px] px-4 pt-2.5 pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <div className="bg-line mx-auto mt-0.5 mb-3 h-1 w-9 rounded-full" />
      <div className="mb-0.5 flex items-baseline justify-between gap-2.5">
        <span className="text-ink text-base font-bold tracking-[-0.01em]">
          {t('schedule.timePicker.title')}
        </span>
        <span className="text-faint text-xs whitespace-nowrap tabular-nums">
          {t('schedule.timePicker.window', {
            start: gap.start,
            end: windowEnd,
          })}
        </span>
      </div>
      <p className="text-muted mt-1 mb-1.5 text-[11.5px]">
        {t('schedule.timePicker.subnote')}
      </p>

      <div className="relative flex items-center justify-center gap-1.5 pt-2 pb-1">
        <div
          className="bg-accent-soft border-accent-line rounded-card absolute top-1/2 left-1/2 h-[42px] w-[150px] -translate-x-1/2 -translate-y-1/2 border"
          aria-hidden="true"
        />

        <div className="relative flex w-14 flex-col items-center gap-2">
          <button
            type="button"
            className={valClass}
            disabled={hourPrev === selected}
            aria-label={t('schedule.timePicker.hourDown')}
            onClick={() => setSelected(hourPrev)}
          >
            {hourPrev.split(':')[0]}
          </button>
          <div className={selClass} aria-live="polite">
            {selHH}
          </div>
          <button
            type="button"
            className={valClass}
            disabled={hourNext === selected}
            aria-label={t('schedule.timePicker.hourUp')}
            onClick={() => setSelected(hourNext)}
          >
            {hourNext.split(':')[0]}
          </button>
        </div>

        <div className="text-accent-ink relative pb-0.5 text-xl font-extrabold">
          :
        </div>

        <div className="relative flex w-14 flex-col items-center gap-2">
          <button
            type="button"
            className={valClass}
            disabled={minutePrev === selected}
            aria-label={t('schedule.timePicker.minuteDown')}
            onClick={() => setSelected(minutePrev)}
          >
            {minutePrev.split(':')[1]}
          </button>
          <div className={selClass} aria-live="polite">
            {selMM}
          </div>
          <button
            type="button"
            className={valClass}
            disabled={minuteNext === selected}
            aria-label={t('schedule.timePicker.minuteUp')}
            onClick={() => setSelected(minuteNext)}
          >
            {minuteNext.split(':')[1]}
          </button>
        </div>
      </div>

      <p className="text-faint mt-1.5 text-center text-[11px]">
        {t('schedule.timePicker.stepCaption', { step: STEP_MINUTES })}
      </p>

      <button
        type="button"
        className="bg-accent text-on-accent rounded-card mt-3 w-full cursor-pointer border-0 p-[13px] text-center text-[15px] font-[650] tabular-nums"
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
