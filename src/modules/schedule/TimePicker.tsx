import { useId, useMemo, useState } from 'react';
import { t } from '../i18n';
import {
  clampToGap,
  nearestMinute,
  validStartTimes,
  wheelColumns,
} from './timeBounds';
import { DAY_END } from './dayWindow';

const STEP_MINUTES = 5;

interface Gap {
  start: string;
  end: string | null;
}

// One scrollable column of the wheel. Focusable listbox; options are clickable
// and arrow-key navigable. Selection is reported through `onChange`; the
// centered/selected option scrolls into view via `scrollIntoView`.
function WheelColumn({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  const baseId = useId();
  const index = Math.max(0, options.indexOf(value));
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  function move(delta: number) {
    const next = options[Math.min(Math.max(index + delta, 0), options.length - 1)];
    if (next && next !== value) onChange(next);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    }
  }

  return (
    <div
      role="listbox"
      aria-label={label}
      tabIndex={0}
      aria-activedescendant={optionId(index)}
      onKeyDown={handleKeyDown}
      className="h-[132px] w-16 snap-y snap-mandatory overflow-y-auto py-[44px] outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((opt, i) => {
        const selected = opt === value;
        return (
          <button
            key={opt}
            id={optionId(i)}
            type="button"
            role="option"
            aria-selected={selected}
            ref={(el) => {
              if (el && selected)
                el.scrollIntoView({
                  block: 'center',
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                    .matches
                    ? 'auto'
                    : 'smooth',
                });
            }}
            onClick={() => onChange(opt)}
            className={`flex h-11 w-full cursor-pointer snap-center items-center justify-center border-0 bg-transparent tabular-nums ${
              selected
                ? 'text-accent-ink text-[22px] font-extrabold'
                : 'text-faint text-[15px]'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function TimePicker({
  gap,
  serviceMinutes,
  value,
  onPick,
  dayEnd = DAY_END,
}: {
  gap: Gap;
  serviceMinutes: number;
  value?: string;
  onPick: (time: string) => void;
  dayEnd?: string;
}) {
  const opts = { stepMinutes: STEP_MINUTES, serviceMinutes, dayEnd };
  const windowEnd = gap.end ?? dayEnd;

  // Every rendered option is a valid start; fall back to a single clamped
  // option so a too-small gap is still confirmable (mirrors the old picker,
  // which always had a value).
  const times = useMemo(() => {
    const all = validStartTimes(gap, opts);
    return all.length > 0 ? all : [clampToGap(value ?? gap.start, gap, opts)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gap.start, gap.end, serviceMinutes, dayEnd, value]);

  const { hours, minutesByHour } = useMemo(() => wheelColumns(times), [times]);

  const initial = times.includes(clampToGap(value ?? gap.start, gap, opts))
    ? clampToGap(value ?? gap.start, gap, opts)
    : times[0];

  const [selHour, setSelHour] = useState(initial.slice(0, 2));
  const [selMin, setSelMin] = useState(initial.slice(3, 5));

  // Re-derive selection when the caller hands a different gap/service/value
  // (reopening the sheet for another gap) — the render-time reset pattern the
  // old picker used.
  const resetKey = `${gap.start}|${gap.end}|${serviceMinutes}|${value}|${dayEnd}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setSelHour(initial.slice(0, 2));
    setSelMin(initial.slice(3, 5));
  }

  const minutes = minutesByHour.get(selHour) ?? [times[0].slice(3, 5)];
  const effectiveMin = minutes.includes(selMin)
    ? selMin
    : nearestMinute(minutes, selMin);
  const selected = `${selHour}:${effectiveMin}`;

  function changeHour(hh: string) {
    setSelHour(hh);
    const mins = minutesByHour.get(hh) ?? [];
    if (mins.length > 0 && !mins.includes(selMin)) {
      setSelMin(nearestMinute(mins, selMin));
    }
  }

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
          {t('schedule.timePicker.window', { start: gap.start, end: windowEnd })}
        </span>
      </div>
      <p className="text-muted mt-1 mb-1.5 text-[11.5px]">
        {t('schedule.timePicker.subnote')}
      </p>

      <div className="relative flex items-center justify-center gap-1.5 py-2">
        <div
          className="bg-accent-soft border-accent-line rounded-card pointer-events-none absolute top-1/2 left-1/2 h-11 w-[150px] -translate-x-1/2 -translate-y-1/2 border"
          aria-hidden="true"
        />
        <WheelColumn
          label={t('schedule.timePicker.hours')}
          options={hours}
          value={selHour}
          onChange={changeHour}
        />
        <div className="text-accent-ink relative pb-0.5 text-xl font-extrabold">
          :
        </div>
        <WheelColumn
          label={t('schedule.timePicker.minutes')}
          options={minutes}
          value={effectiveMin}
          onChange={setSelMin}
        />
      </div>

      <button
        type="button"
        className="bg-accent text-on-accent rounded-card mt-3 w-full cursor-pointer border-0 p-[13px] text-center text-[15px] font-[650] tabular-nums"
        onClick={() => onPick(clampToGap(selected, gap, opts))}
      >
        {t('schedule.timePicker.confirm', { time: selected })}
      </button>
    </div>
  );
}
