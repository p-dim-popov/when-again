import { useEffect, useId, useMemo, useRef, useState } from 'react';
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

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// One scrollable column of the wheel. Focusable listbox; options are
// clickable, arrow-key navigable, AND scroll/fling driven — dragging the
// column to settle a different option centered under the highlight band
// reports that option through `onChange`, same as a click would.
//
// Two effects keep the DOM scroll position and the `value` prop converged
// without fighting each other. Both work from MEASURED geometry
// (getBoundingClientRect), never a hardcoded row height, so they stay correct
// when the root font-size scales the rem-based rows (e.g. a phone with large
// system text — a fixed 44px assumption left the selected number stranded
// outside the highlight band):
//  - the sync effect scrolls the selected option's measured centre to the
//    container's measured centre whenever the selected index changes (click,
//    arrow key, or a hour-change re-clamp) — a no-op when it is already
//    centred (e.g. right after the settle handler reported that same index),
//    so it can never re-trigger the settle handler in a loop.
//  - the settle effect listens for the scroll gesture to finish (native
//    `scrollend`, with a debounced `scroll` fallback for browsers that don't
//    support it) and reports whichever option is nearest the container centre
//    via `onChange`.
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
  const containerRef = useRef<HTMLDivElement>(null);
  const index = Math.max(0, options.indexOf(value));
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  function move(delta: number) {
    const next =
      options[Math.min(Math.max(index + delta, 0), options.length - 1)];
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

  // Keep the DOM scrolled to the selected option. Runs on mount and whenever
  // `index` changes for any reason (click, arrow key, hour-change re-clamp,
  // or the settle handler below reporting a user's scroll gesture).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const opt = el.querySelectorAll('[role="option"]')[index] as
      HTMLElement | undefined;
    if (!opt) return;
    const cRect = el.getBoundingClientRect();
    const oRect = opt.getBoundingClientRect();
    const delta = oRect.top + oRect.height / 2 - (cRect.top + cRect.height / 2);
    if (Math.abs(delta) < 1) return;
    el.scrollTo({
      top: el.scrollTop + delta,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, [index, options]);

  // Report the option that ends up centered once a scroll/fling settles.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const supportsScrollEnd = 'onscrollend' in window;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    function settle() {
      const node = containerRef.current;
      if (!node || options.length === 0) return;
      const rect = node.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const optEls = node.querySelectorAll('[role="option"]');
      let settledIndex = 0;
      let bestDist = Infinity;
      optEls.forEach((optEl, i) => {
        const r = optEl.getBoundingClientRect();
        const dist = Math.abs(r.top + r.height / 2 - center);
        if (dist < bestDist) {
          bestDist = dist;
          settledIndex = i;
        }
      });
      const next = options[settledIndex];
      if (next && next !== value) onChange(next);
    }

    function handleScroll() {
      // `scrollend` covers settling natively where supported; the debounced
      // fallback below only kicks in for browsers without it, so the two
      // paths never double-report.
      if (supportsScrollEnd) return;
      clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(settle, 100);
    }

    el.addEventListener('scroll', handleScroll, { passive: true });
    el.addEventListener('scrollend', settle);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('scrollend', settle);
      clearTimeout(fallbackTimer);
    };
  }, [options, value, onChange]);

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      aria-activedescendant={optionId(index)}
      onKeyDown={handleKeyDown}
      className="h-[8.25rem] w-16 snap-y snap-mandatory [scrollbar-width:none] overflow-y-auto py-11 outline-none [&::-webkit-scrollbar]:hidden"
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
            tabIndex={-1}
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
      className="bg-surface shadow-sheet absolute inset-x-0 bottom-0 z-[3] rounded-t-[22px] px-4 pt-2.5 pb-[calc(1rem+env(safe-area-inset-bottom))]"
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

      <div className="flex justify-center py-2">
        {/* The wheel shrinks to fit its columns (inline-flex). The highlight
            band is `inset-x-0` of that wrapper, so it always spans the two
            columns whatever their width — the columns are rem-sized and widen
            with the root font, and a fixed-px band width left the selected
            numbers stranded outside it on large-font phones. */}
        <div className="relative isolate inline-flex items-center gap-1.5">
          <div
            className="bg-accent-soft border-accent-line rounded-card pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-11 -translate-y-1/2 border"
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
