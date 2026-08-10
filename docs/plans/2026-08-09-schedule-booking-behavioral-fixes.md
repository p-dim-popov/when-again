# Schedule & Booking behavioral fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the behavioral remainder of #17 (items 1–5) plus #16: week-jumping arrows, remove a dead control, a scrollable two-column time wheel, a client field that closes and auto-creates on save, and a booking draft that starts fresh through every entry path.

**Architecture:** React + TanStack Router SPA, modulith. The day view (`schedule`) hands choices to the booking funnel (`booking`) through **route search params only** — `schedule` never imports `booking`. Draft state lives in `booking/draftStore`. The new "fresh vs continue" signal (`resume`) travels as a boolean search param, exactly like the existing `appt`.

**Tech Stack:** TypeScript strict, Tailwind v4 (utilities in JSX, token-flip dark mode), Vitest (pure logic), Playwright (e2e / DOM behavior).

## Global Constraints

- **Modulith:** cross-module imports via `index.ts` only. `schedule` must **not** import `booking` (keep the graph acyclic). The #16 draft reset therefore happens in `booking` (the form), never in `schedule`.
- **No PII in URLs:** `resume` is a boolean only. Client name / service / price stay in `draftStore`.
- **Time semantics:** wall-clock `HH:mm` only; no epoch/UTC.
- **Styling:** Tailwind v4 utilities in JSX, **no `dark:` variants**, no new per-module CSS files; reuse the "Elevated & warm" tokens in `src/app/index.css`.
- **Vitest is pure-logic only** (`src/**/*.test.ts`, no jsdom): unit-test extracted pure functions; cover DOM behavior in `e2e/`.
- **i18n:** every user-facing string ships **both** `en` and `bg`, in the module's `strings.ts` — update the `en` object, the `bg` object, **and** the `declare module '../i18n'` `TranslationKeys` block together. BG is a draft (native pass deferred); do not block on wording. STE for user-facing copy.
- **Commits:** no Claude session link; `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` is fine.
- **Every task:** `npm test` (Vitest) and `npm run typecheck` must pass; `npm run lint` clean. Run `npm run test:e2e` for tasks that change a DOM flow (Tasks 3, 4, 5, 6).

## File Structure

- `src/modules/schedule/ScheduleScreen.tsx` — arrows (T1), dead-control removal (T1), `resume` threading + `goToForm` forwarding (T6).
- `src/modules/schedule/strings.ts` — retire `schedule.more`, rename nav labels to week (T1); retire stepper-only picker keys, add wheel column labels (T3, T4).
- `src/modules/schedule/timeBounds.ts` — new pure helpers `validStartTimes`, `wheelColumns`, `nearestMinute` (T2).
- `src/modules/schedule/timeBounds.test.ts` — tests for the above (T2).
- `src/modules/schedule/TimePicker.tsx` — full picker-body rebuild to a two-column wheel (T4).
- `src/modules/booking/AppointmentForm.tsx` — dropdown close (T4b→T5), inline hint + auto-create (T5), synchronous fresh reset + `goChangeWhen` resume (T6).
- `src/modules/booking/resolveClient.ts` (new) + `resolveClient.test.ts` — client resolution on save (T5).
- `src/modules/booking/freshStart.ts` (new) + `freshStart.test.ts` — `shouldResetDraft` (T6).
- `src/modules/booking/strings.ts` — remove `booking.form.client.create`, add `booking.form.client.willCreate` (T5).
- `src/app/router.tsx` — add `resume` to `/`, `/book`, `/appointment/new` search schemas (T6).
- `src/modules/booking/MonthPicker.tsx` — thread `resume` through `handleSelectDay` (T6).
- `e2e/provider-booking.spec.ts` — rewrite "другчас" for the wheel (T4), drop the Create-option click + assert dropdown close (T5), add #16 fresh-vs-preserve tests (T6).

---

## Task 1: Day-view arrows jump weeks; remove the dead "more…"

**Files:**
- Modify: `src/modules/schedule/ScheduleScreen.tsx`
- Modify: `src/modules/schedule/strings.ts`
- Modify: `src/modules/schedule/dateParam.test.ts` (add week-jump assertion)
- Modify: `src/modules/schedule/strings.test.ts` is unaffected (parity holds); no change expected.

**Interfaces:**
- Consumes: existing `addDays`, `weekOf` from `schedule/dateParam`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test** — append to `src/modules/schedule/dateParam.test.ts`:

```ts
import { addDays, weekOf } from './dateParam';

describe('week jump (day-view arrows)', () => {
  it('addDays(key, ±7) keeps the weekday and lands in the adjacent week', () => {
    const key = '2026-08-12'; // a Wednesday
    const next = addDays(key, 7);
    const prev = addDays(key, -7);
    expect(next).toBe('2026-08-19');
    expect(prev).toBe('2026-08-05');
    // same weekday index within its own week
    expect(weekOf(next).indexOf(next)).toBe(weekOf(key).indexOf(key));
    expect(weekOf(prev).indexOf(prev)).toBe(weekOf(key).indexOf(key));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**
Run: `npm test -- dateParam`
Expected: FAIL (the new `describe` runs against existing `addDays`/`weekOf`; it should actually PASS since `addDays` already supports ±7 — if it PASSES, that is fine, it locks the behavior the arrows rely on). If it fails, fix the assertion to match `addDays`/`weekOf`'s real output, not the code.

> Note: this test characterizes an existing helper, so it may pass immediately. That is acceptable — its job is to guard the week-jump semantics the arrows now depend on.

- [ ] **Step 3: Change the arrows to ±7** in `ScheduleScreen.tsx` (the two app-bar arrow buttons, currently lines ~299–334):

```tsx
<button
  type="button"
  className="rounded-sm2 border-line bg-surface text-muted inline-flex size-11 flex-none cursor-pointer items-center justify-center border text-lg"
  aria-label={t('schedule.nav.prevWeek')}
  onClick={() => goTo(addDays(dateKey, -7))}
>
  ‹
</button>
```

and the trailing arrow:

```tsx
<button
  type="button"
  className="rounded-sm2 border-line bg-surface text-muted inline-flex size-11 flex-none cursor-pointer items-center justify-center border text-lg"
  aria-label={t('schedule.nav.nextWeek')}
  onClick={() => goTo(addDays(dateKey, 7))}
>
  ›
</button>
```

- [ ] **Step 4: Remove the dead "more…" control** in `ScheduleScreen.tsx`:
  - Delete `handleMoreTapStub` (the no-op function near line 71).
  - In `GapRow`, delete the `const mayHaveMore = slots.length >= 8;` line and its explanatory comment.
  - Delete the entire `{mayHaveMore && ( … )}` button block (lines ~169–177).

- [ ] **Step 5: Update strings** in `src/modules/schedule/strings.ts`:
  - Remove `'schedule.more'` from `en`, from `bg`, and from the `declare module` `TranslationKeys` block.
  - Rename the nav keys: replace `'schedule.nav.prevDay'`/`'schedule.nav.nextDay'` with `'schedule.nav.prevWeek'`/`'schedule.nav.nextWeek'` in `en`, `bg`, and `TranslationKeys`:

```ts
// en
'schedule.nav.prevWeek': 'Previous week',
'schedule.nav.nextWeek': 'Next week',
// bg
'schedule.nav.prevWeek': 'Предишна седмица',
'schedule.nav.nextWeek': 'Следваща седмица',
```

- [ ] **Step 6: Run the suite + typecheck + lint**
Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS. TypeScript will flag any missed reference to the removed keys (`schedule.more`, `schedule.nav.prevDay/nextDay`) — fix them.

- [ ] **Step 7: Commit**

```bash
git add src/modules/schedule/
git commit -m "feat(schedule): week-jump arrows, remove dead more control (#17-1,2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Pure bounds helpers for the time wheel

**Files:**
- Modify: `src/modules/schedule/timeBounds.ts`
- Modify: `src/modules/schedule/timeBounds.test.ts`

**Interfaces:**
- Consumes: existing `toMinutes`, `toHHMM` in the same module.
- Produces (used by Task 4's `TimePicker`):
  - `validStartTimes(gap, { stepMinutes, serviceMinutes, dayEnd }): string[]`
  - `wheelColumns(times: string[]): { hours: string[]; minutesByHour: Map<string, string[]> }`
  - `nearestMinute(minutes: string[], target: string): string`

- [ ] **Step 1: Write the failing tests** — append to `src/modules/schedule/timeBounds.test.ts`:

```ts
import { validStartTimes, wheelColumns, nearestMinute } from './timeBounds';

describe('validStartTimes', () => {
  const opts = { stepMinutes: 5, serviceMinutes: 30, dayEnd: '20:00' };

  it('lists grid-aligned starts that fit before a closed boundary', () => {
    // gap 09:00–10:00, 30-min service → last fit 09:30
    expect(validStartTimes({ start: '09:00', end: '10:00' }, opts)).toEqual([
      '09:00', '09:05', '09:10', '09:15', '09:20', '09:25', '09:30',
    ]);
  });

  it('resolves an open-ended gap against dayEnd', () => {
    const times = validStartTimes({ start: '19:00', end: null }, opts);
    expect(times[0]).toBe('19:00');
    expect(times[times.length - 1]).toBe('19:30'); // last fit before 20:00
  });

  it('returns [] when the service cannot fit', () => {
    expect(validStartTimes({ start: '09:45', end: '10:00' }, opts)).toEqual([]);
  });

  it('spans hours, so the last hour offers only its fitting minutes', () => {
    // gap 09:40–11:00 → last fit 10:30; hour 10 stops at :30
    const times = validStartTimes({ start: '09:40', end: '11:00' }, opts);
    expect(times[0]).toBe('09:40');
    expect(times).toContain('10:30');
    expect(times).not.toContain('10:35');
  });
});

describe('wheelColumns', () => {
  it('splits into distinct hours and per-hour minutes', () => {
    const { hours, minutesByHour } = wheelColumns([
      '09:40', '09:45', '10:00', '10:05',
    ]);
    expect(hours).toEqual(['09', '10']);
    expect(minutesByHour.get('09')).toEqual(['40', '45']);
    expect(minutesByHour.get('10')).toEqual(['00', '05']);
  });
});

describe('nearestMinute', () => {
  it('finds the closest valid minute, ties to the lower', () => {
    expect(nearestMinute(['00', '05', '10'], '07')).toBe('05');
    expect(nearestMinute(['00', '10'], '05')).toBe('00'); // tie → lower
    expect(nearestMinute(['30', '35'], '05')).toBe('30'); // clamp up
  });
});
```

- [ ] **Step 2: Run to verify failure**
Run: `npm test -- timeBounds`
Expected: FAIL with "validStartTimes is not a function" (and the others).

- [ ] **Step 3: Implement the helpers** — append to `src/modules/schedule/timeBounds.ts`:

```ts
/**
 * All valid appointment start times inside a gap, on the step grid, uncapped
 * (the wheel scrolls the full set; `slots.generateSlots` keeps the capped chip
 * row). A start is included iff it is a multiple of `stepMinutes` from
 * midnight, at or after `gap.start`, and leaves room for `serviceMinutes`
 * before the boundary (`gap.end`, or `dayEnd` when open-ended). Grid-aligned
 * from midnight (unlike `generateSlots`, which steps from `gap.start`) so the
 * wheel's minute column reads cleanly (:00/:05/…); gaps start grid-aligned in
 * practice (day start plus durations that are multiples of the step). Returns
 * `[]` when nothing fits.
 */
export function validStartTimes(
  gap: Gap,
  opts: { stepMinutes: number; serviceMinutes: number; dayEnd: string },
): string[] {
  const { stepMinutes, serviceMinutes, dayEnd } = opts;
  const startMin = toMinutes(gap.start);
  const boundaryMin = gap.end === null ? toMinutes(dayEnd) : toMinutes(gap.end);
  const latestMin = boundaryMin - serviceMinutes;
  const firstMin = Math.ceil(startMin / stepMinutes) * stepMinutes;
  const out: string[] = [];
  for (let t = firstMin; t <= latestMin; t += stepMinutes) out.push(toHHMM(t));
  return out;
}

/**
 * Splits valid start times into the wheel's two columns: distinct hours (in
 * ascending order) and, per hour, its valid minutes (ascending).
 */
export function wheelColumns(times: string[]): {
  hours: string[];
  minutesByHour: Map<string, string[]>;
} {
  const hours: string[] = [];
  const minutesByHour = new Map<string, string[]>();
  for (const time of times) {
    const hh = time.slice(0, 2);
    const mm = time.slice(3, 5);
    let mins = minutesByHour.get(hh);
    if (!mins) {
      mins = [];
      minutesByHour.set(hh, mins);
      hours.push(hh);
    }
    mins.push(mm);
  }
  return { hours, minutesByHour };
}

/**
 * The valid minute in `minutes` closest to `target` ('mm'); on a tie the lower
 * minute wins. `minutes` must be non-empty (a valid hour always has ≥1 minute).
 */
export function nearestMinute(minutes: string[], target: string): string {
  const t = Number(target);
  return minutes.reduce((best, m) =>
    Math.abs(Number(m) - t) < Math.abs(Number(best) - t) ? m : best,
  );
}
```

- [ ] **Step 4: Run to verify pass**
Run: `npm test -- timeBounds && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/schedule/timeBounds.ts src/modules/schedule/timeBounds.test.ts
git commit -m "feat(schedule): pure bounds helpers for the time wheel (#17-3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Rebuild the time picker as a two-column scroll-snap wheel

**Files:**
- Rewrite the picker body: `src/modules/schedule/TimePicker.tsx`
- Modify: `src/modules/schedule/strings.ts` (retire stepper-only keys, add column labels)
- Rewrite the "другчас" e2e: `e2e/provider-booking.spec.ts`

**Interfaces:**
- Consumes: `validStartTimes`, `wheelColumns`, `nearestMinute` (Task 2); existing `clampToGap`; `DAY_END`.
- Produces: same `onPick(time)` contract; keeps `data-testid="time-sheet"`.

**Design notes (must hold):**
- Two columns are `role="listbox"` (hours, minutes) with `role="option"` children; the centered option is `aria-selected`. Container is focusable; arrow keys move selection; `aria-activedescendant` points at the selected option's id.
- Options are also **clickable** (tap a visible option to select it) — this is the deterministic e2e hook and a usability affordance.
- Scrolling the hour column re-derives the minute column; if the current minute is invalid for the new hour, clamp via `nearestMinute`.
- Every rendered option is a valid start ⇒ Confirm emits `clampToGap(selected)` and a clash stays impossible by construction.
- Guarantee a confirmable value even for a too-small gap: fall back to `[clampToGap(gap.start)]` when `validStartTimes` is empty.
- `prefers-reduced-motion` → no smooth programmatic scroll.

- [ ] **Step 1: Add/retire strings** in `src/modules/schedule/strings.ts`:
  - Remove `schedule.timePicker.hourUp/hourDown/minuteUp/minuteDown` and `schedule.timePicker.stepCaption` from `en`, `bg`, and `TranslationKeys`.
  - Add column labels (en / bg) and keep title/window/subnote/confirm:

```ts
// en
'schedule.timePicker.hours': 'Hours',
'schedule.timePicker.minutes': 'Minutes',
// bg
'schedule.timePicker.hours': 'Часове',
'schedule.timePicker.minutes': 'Минути',
```
  (add both to `TranslationKeys` too).

- [ ] **Step 2: Rewrite `TimePicker.tsx`** with the wheel. Full file:

```tsx
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
```

- [ ] **Step 3: Rewrite the "другчас" e2e** in `e2e/provider-booking.spec.ts` — replace the stepper interaction (the test titled *"другчас: the day view's inline time sheet carries an off-grid time to the form"*, currently lines ~110–131) with wheel option clicks:

```ts
test("другчас: the day view's inline time sheet carries an off-grid time to the form", async ({
  page,
}) => {
  await pickFutureDay(page);

  await page.getByRole('button', { name: 'other time' }).click();
  await expect(page.getByTestId('time-sheet')).toBeVisible();

  // The wheel opens on 08:00 (day start). Pick the :05 minute option to nudge
  // one step off the 30-minute quick-slot grid, then confirm.
  await page
    .getByRole('listbox', { name: 'Minutes' })
    .getByRole('option', { name: '05', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Choose · 08:05' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Choose · 08:05' }).click();

  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await expect(page.getByText('08:05')).toBeVisible();
});
```

- [ ] **Step 4: Run unit + typecheck + lint**
Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS (TypeScript flags any leftover reference to the removed stepper keys).

- [ ] **Step 5: Run e2e**
Run: `npm run test:e2e -- provider-booking`
Expected: PASS (all three tests, including the rewritten другчас).

- [ ] **Step 6: Commit**

```bash
git add src/modules/schedule/TimePicker.tsx src/modules/schedule/strings.ts e2e/provider-booking.spec.ts
git commit -m "feat(schedule): two-column scroll-snap time wheel (#17-3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Client dropdown closes after pick / blur / Escape

**Files:**
- Modify: `src/modules/booking/AppointmentForm.tsx`
- Modify: `e2e/provider-booking.spec.ts` (add a close-behavior assertion)

**Interfaces:**
- Consumes: existing `clients` query, `clientId`, `clientQuery`, `selectClient`, `handleClientQueryChange`.
- Produces: nothing for later tasks (Task 5 edits the same component after this).

- [ ] **Step 1: Add dismissal state + selected-name suppression** in `AppointmentForm.tsx`.
  - Add near the other client state (after `const [clientId, …]`):

```tsx
const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
```
  - Derive the selected client's name and fold both suppressors into `showClientSuggestions`:

```tsx
const selectedName =
  clientId != null
    ? ((clients ?? []).find((c) => c.id === clientId)?.name ?? '')
    : '';
const querySelectsClient =
  clientId != null &&
  selectedName.toLowerCase() === trimmedClientQuery.toLowerCase();
const showClientSuggestions =
  trimmedClientQuery.length > 0 &&
  !suggestionsDismissed &&
  !querySelectsClient &&
  (clientSuggestions.length > 0 || showCreateClient);
```

- [ ] **Step 2: Reopen on typing** — in `handleClientQueryChange`, clear the dismissal:

```tsx
function handleClientQueryChange(value: string) {
  setClientQuery(value);
  setSuggestionsDismissed(false);
  setClientId(null);
  patchDraft({ clientId: null, clientName: null });
}
```

- [ ] **Step 3: Close on Escape and blur** — on the client `<input>` add handlers:

```tsx
onKeyDown={(e) => {
  if (e.key === 'Escape') setSuggestionsDismissed(true);
}}
onBlur={() => setSuggestionsDismissed(true)}
```

- [ ] **Step 4: Keep the pick from being eaten by blur** — on each suggestion option `<button>` (the client suggestions and, until Task 5, the create option) add:

```tsx
onMouseDown={(e) => e.preventDefault()}
```
  so the option's `onClick` fires before the input's `onBlur` hides the list.

- [ ] **Step 5: Add an e2e close assertion.** In `e2e/provider-booking.spec.ts`, add a focused test (it books one client, then starts a second booking and picks the existing client from the list, asserting the listbox closes):

```ts
test('client suggestion list closes after picking an existing client', async ({
  page,
}) => {
  const clientName = 'Maria Dimitrova';
  await bookAppointment(page, { clientName, service: 'Color' });

  // Start a second booking, type the same name → the existing client appears.
  await pickFutureDay(page);
  await firstFreeSlot(page).click();
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();

  const client = page.locator('#apptForm-client');
  await client.fill(clientName);
  await expect(client).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('option', { name: clientName, exact: true }).click();

  // Picked → field holds the name and the listbox is closed.
  await expect(client).toHaveValue(clientName);
  await expect(client).toHaveAttribute('aria-expanded', 'false');
});
```

> Note: this test depends on picking an existing client from the suggestion list, which still works whether or not Task 5 has landed. If Task 5 lands first, `bookAppointment` no longer clicks a "Create" option — that is fine; this test never relies on it.

- [ ] **Step 6: Run unit + typecheck + lint, then e2e**
Run: `npm test && npm run typecheck && npm run lint`
Then: `npm run test:e2e -- provider-booking`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/booking/AppointmentForm.tsx e2e/provider-booking.spec.ts
git commit -m "fix(booking): close client suggestions on pick, blur, Escape (#17-4)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: New client = inline hint + auto-create on save

**Files:**
- Create: `src/modules/booking/resolveClient.ts`, `src/modules/booking/resolveClient.test.ts`
- Modify: `src/modules/booking/AppointmentForm.tsx`
- Modify: `src/modules/booking/strings.ts`
- Modify: `e2e/provider-booking.spec.ts` (drop the Create-option click in `bookAppointment`)

**Interfaces:**
- Consumes: `addClientMutation` (existing), `clients` query, `clientId`, `trimmedClientQuery`.
- Produces: `resolveClientId(...)` pure helper.

- [ ] **Step 1: Write the failing test** — `src/modules/booking/resolveClient.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { resolveClientId } from './resolveClient';

const clients = [
  { id: 'c1', name: 'Ivan Petrov' },
  { id: 'c2', name: 'Maria Georgieva' },
];

describe('resolveClientId', () => {
  it('uses an explicitly selected clientId as-is', async () => {
    const createClient = vi.fn();
    expect(
      await resolveClientId({ clientId: 'c2', name: 'whatever', clients, createClient }),
    ).toBe('c2');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('matches an existing name case-insensitively without creating a duplicate', async () => {
    const createClient = vi.fn();
    expect(
      await resolveClientId({ clientId: null, name: 'ivan petrov', clients, createClient }),
    ).toBe('c1');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('creates a new client when the name is unknown', async () => {
    const createClient = vi.fn(async (name: string) => ({ id: 'new', name }));
    expect(
      await resolveClientId({ clientId: null, name: 'New Person', clients, createClient }),
    ).toBe('new');
    expect(createClient).toHaveBeenCalledWith('New Person');
  });

  it('returns null for an empty name', async () => {
    const createClient = vi.fn();
    expect(
      await resolveClientId({ clientId: null, name: '', clients, createClient }),
    ).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**
Run: `npm test -- resolveClient`
Expected: FAIL ("resolveClientId is not a function").

- [ ] **Step 3: Implement** `src/modules/booking/resolveClient.ts`:

```ts
/**
 * Resolves the client id to save, dropping the old hard requirement that a
 * client be explicitly picked first (#17-5). Order:
 *   1. an explicitly selected `clientId` wins;
 *   2. else an existing client whose name matches (case-insensitive) — never
 *      create a duplicate;
 *   3. else create a client from the typed name;
 *   4. else (empty name) → null, so the caller shows the required-field error.
 */
export async function resolveClientId(params: {
  clientId: string | null;
  name: string; // already trimmed
  clients: { id: string; name: string }[];
  createClient: (name: string) => Promise<{ id: string }>;
}): Promise<string | null> {
  const { clientId, name, clients, createClient } = params;
  if (clientId) return clientId;
  if (!name) return null;
  const existing = clients.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return existing.id;
  const created = await createClient(name);
  return created.id;
}
```

- [ ] **Step 4: Run to verify pass**
Run: `npm test -- resolveClient`
Expected: PASS.

- [ ] **Step 5: Wire it into the form.** In `AppointmentForm.tsx`:
  - Remove the create-option UI: delete the `{showCreateClient && ( … )}` block inside the listbox, and delete the now-unused `handleCreateClient` function. Keep `showCreateClient` **only** if still referenced by `showClientSuggestions`; since the create row is gone, simplify `showClientSuggestions` to depend on `clientSuggestions.length > 0` (drop `|| showCreateClient`) and delete the `showCreateClient` const.
  - Add the inline hint below the client field wrapper (after the suggestions block), shown when the name is new and nothing is selected:

```tsx
{trimmedClientQuery.length > 0 && !hasExactClientMatch && clientId == null && (
  <p className="text-faint mt-[5px] text-[11.5px]">
    {t('booking.form.client.willCreate')}
  </p>
)}
```
  - Replace the `!clientId` guard in `handleSave`. New guard (client no longer required up front, but a name is):

```tsx
async function handleSave(value: ServiceFormValues) {
  const trimmedService = value.service.trim();
  if (
    !trimmedClientQuery ||
    !trimmedService ||
    !draft.dateKey ||
    !draft.time ||
    !value.durationMinutes
  ) {
    setSaveError(t('booking.form.error.required'));
    return;
  }
  setSaveError(null);

  const resolvedClientId = await resolveClientId({
    clientId,
    name: trimmedClientQuery,
    clients: clients ?? [],
    createClient: (name) => addClientMutation.mutateAsync({ name }),
  });
  if (!resolvedClientId) {
    setSaveError(t('booking.form.error.required'));
    return;
  }
  // …existing save body, using `resolvedClientId` everywhere the code used
  // `clientId` (the WallClock build, the update vs. create branches)…
}
```
  Update the two appointment objects in `handleSave` to use `resolvedClientId` instead of `clientId`.
  - Add the import: `import { resolveClientId } from './resolveClient';`.

- [ ] **Step 6: Strings** in `src/modules/booking/strings.ts`:
  - Remove `'booking.form.client.create'` from `en`, `bg`, and `TranslationKeys`.
  - Add the hint (en / bg + `TranslationKeys`):

```ts
// en
'booking.form.client.willCreate': 'New client — will be added when you save.',
// bg
'booking.form.client.willCreate': 'Нов клиент — ще бъде добавен при запис.',
```

- [ ] **Step 7: Update the e2e helper.** In `e2e/provider-booking.spec.ts`, `bookAppointment` must no longer click the removed create option. Replace:

```ts
await page.locator('#apptForm-client').fill(clientName);
await page.getByRole('option', { name: `Create "${clientName}"` }).click();
```
with just:

```ts
// New name → inline hint; the client is auto-created on save (no tap needed).
await page.locator('#apptForm-client').fill(clientName);
await expect(
  page.getByText('New client — will be added when you save.'),
).toBeVisible();
```

- [ ] **Step 8: Run unit + typecheck + lint, then e2e**
Run: `npm test && npm run typecheck && npm run lint`
Then: `npm run test:e2e -- provider-booking`
Expected: PASS (all provider-booking tests, including the reused `bookAppointment`).

- [ ] **Step 9: Commit**

```bash
git add src/modules/booking/resolveClient.ts src/modules/booking/resolveClient.test.ts src/modules/booking/AppointmentForm.tsx src/modules/booking/strings.ts e2e/provider-booking.spec.ts
git commit -m "feat(booking): auto-create client on save with inline hint (#17-5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Fresh booking starts empty via the `resume` search param (#16)

**Files:**
- Create: `src/modules/booking/freshStart.ts`, `src/modules/booking/freshStart.test.ts`
- Modify: `src/app/router.tsx`
- Modify: `src/modules/schedule/ScheduleScreen.tsx`
- Modify: `src/modules/booking/MonthPicker.tsx`
- Modify: `src/modules/booking/AppointmentForm.tsx`
- Modify: `e2e/provider-booking.spec.ts`

**Interfaces:**
- Consumes: existing search-param threading (`appt`), `resetDraft`, `draftStore`.
- Produces: `shouldResetDraft({ appt, resume })` pure helper; `resume?: boolean` on the `/`, `/book`, `/appointment/new` search schemas.

- [ ] **Step 1: Write the failing test** — `src/modules/booking/freshStart.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shouldResetDraft } from './freshStart';

describe('shouldResetDraft', () => {
  it('resets only a truly fresh entry (no appt, no resume)', () => {
    expect(shouldResetDraft({})).toBe(true);
    expect(shouldResetDraft({ appt: 'a1' })).toBe(false); // edit/reschedule
    expect(shouldResetDraft({ resume: true })).toBe(false); // Промени round-trip
    expect(shouldResetDraft({ appt: 'a1', resume: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**
Run: `npm test -- freshStart`
Expected: FAIL ("shouldResetDraft is not a function").

- [ ] **Step 3: Implement** `src/modules/booking/freshStart.ts`:

```ts
/**
 * Whether the appointment form should wipe the draft on entry (#16). A booking
 * is "being continued" only when the provider tapped Промени (`resume`) or is
 * editing an existing appointment (`appt`); everything else that reaches the
 * form is a fresh booking and must not inherit an abandoned booking's fields.
 * The signal travels as a search param so it cannot linger past an abandon.
 */
export function shouldResetDraft(params: {
  appt?: string;
  resume?: boolean;
}): boolean {
  return !params.appt && !params.resume;
}
```

- [ ] **Step 4: Run to verify pass**
Run: `npm test -- freshStart`
Expected: PASS.

- [ ] **Step 5: Add `resume` to the search schemas** in `src/app/router.tsx`. For each of `TodaySearch` (`/`), `BookSearch` (`/book`), and `NewAppointmentSearch` (`/appointment/new`): add `resume?: boolean` to the interface and to `validateSearch`:

```ts
resume:
  search.resume === true || search.resume === 'true' ? true : undefined,
```
  and pass it to the component in each route's render function, e.g.:

```tsx
function TodayRoute() {
  const { date, appt, resume } = todayRoute.useSearch();
  return (
    <ScheduleScreen
      dateKey={date ?? todayKey(new Date())}
      appt={appt}
      resume={resume}
    />
  );
}
```
  Do the same for `BookRoute` (→ `MonthPicker`) and `NewAppointmentRoute` (→ `AppointmentForm`).

- [ ] **Step 6: Thread `resume` in `ScheduleScreen.tsx`.**
  - Add `resume` to the component props: `{ dateKey, appt, resume }: { dateKey: string; appt?: string; resume?: boolean }`.
  - Forward it in `goTo`, `openMonthPicker`, and `goToForm` (matching the `appt` spread):

```tsx
function goTo(newDateKey: string) {
  void navigate({
    to: '/',
    search: {
      date: newDateKey,
      ...(appt ? { appt } : {}),
      ...(resume ? { resume: true } : {}),
    },
  });
}

function openMonthPicker() {
  void navigate({
    to: '/book',
    search: {
      date: dateKey,
      ...(appt ? { appt } : {}),
      ...(resume ? { resume: true } : {}),
    },
  });
}

function goToForm(time: string) {
  setOtherTimeGap(null);
  void navigate({
    to: '/appointment/new',
    search: {
      date: dateKey,
      time,
      ...(appt ? { appt } : {}),
      ...(resume ? { resume: true } : {}),
    },
  });
}
```
  (`openAppointment` for tapping an existing appointment stays `{ appt: id }` only — an edit needs no `resume`.)

- [ ] **Step 7: Thread `resume` in `MonthPicker.tsx`.**
  - Add `resume` to props: `{ date, appt, resume }: { date?: string; appt?: string; resume?: boolean }`.
  - Forward it in `handleSelectDay`:

```tsx
function handleSelectDay(dateKey: string) {
  setDraftDate(dateKey);
  void navigate({
    to: '/',
    search: {
      date: dateKey,
      ...(appt ? { appt } : {}),
      ...(resume ? { resume: true } : {}),
    },
  });
}
```
  (The mount `resetDraft` condition stays `!date && !appt` — the ＋ entry — unchanged.)

- [ ] **Step 8: Reset in the form, synchronously, before the draft snapshot** in `AppointmentForm.tsx`.
  - Add `resume` to props: `{ date, time, appt, resume }` with `resume?: boolean`.
  - Import: `import { shouldResetDraft } from './freshStart';` and ensure `resetDraft` is imported from `./draftStore`.
  - As the **first hook in the component body**, before `const [initialDraft] = useState(() => draftStore.state)`:

```tsx
// #16: a truly fresh entry (no appt, no resume) starts from a clean draft, so
// an abandoned booking's client/service/price cannot leak in. Runs once,
// synchronously, in a useState initializer — before the initialDraft snapshot
// below — so the cleared draft is what seeds the form. date/time are re-applied
// from the URL by the mount effect further down.
useState(() => {
  if (shouldResetDraft({ appt, resume })) resetDraft();
  return null;
});
```
  - In `goChangeWhen`, tag a **new-booking** Промени with `resume` (edit keeps `appt`):

```tsx
function goChangeWhen() {
  void navigate({
    to: '/',
    search: {
      date: draft.dateKey ?? undefined,
      ...(editingId ? { appt: editingId } : { resume: true }),
    },
  });
}
```

- [ ] **Step 9: Add e2e — fresh vs. preserved.** In `e2e/provider-booking.spec.ts` add two tests:

```ts
test('#16: a fresh booking via the month header starts empty after an abandon', async ({
  page,
}) => {
  // Abandon a booking mid-fill: reach the form, type a client, then leave via
  // the bottom nav without saving — the draft now holds a stale name.
  await pickFutureDay(page);
  await firstFreeSlot(page).click();
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await page.locator('#apptForm-client').fill('Stale Person');
  await page.getByRole('link', { name: 'Schedule', exact: true }).click();

  // Start a new booking through the day-view month header (not ＋).
  await page.getByTestId('day-appbar').getByRole('button').nth(1).click(); // month header
  await expect(
    page.getByRole('heading', { name: 'Choose a day' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('button', { name: '20', exact: true }).click();
  await firstFreeSlot(page).click();

  // The form is fresh — no stale name.
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await expect(page.locator('#apptForm-client')).toHaveValue('');
});

test('#16: a new-booking Промени round-trip preserves typed fields', async ({
  page,
}) => {
  await pickFutureDay(page);
  await firstFreeSlot(page).click();
  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await page.locator('#apptForm-client').fill('Petar Kolev');
  await page.locator('#apptForm-service').fill('Shave');

  // Change (Промени) → day view → pick another slot → back on the form.
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await expect(page.getByTestId('day-appbar')).toBeVisible();
  await firstFreeSlot(page).click();

  await expect(
    page.getByRole('heading', { name: 'New appointment' }),
  ).toBeVisible();
  await expect(page.locator('#apptForm-client')).toHaveValue('Petar Kolev');
  await expect(page.locator('#apptForm-service')).toHaveValue('Shave');
});
```

> Implementer note: verify the bottom-nav link label ("Schedule") and the month-header button selector against the current `AppShell`/`ScheduleScreen` render; adjust the selector (e.g. use the app-bar heading role) if the accessible name differs. The behavioral assertions (empty vs. preserved) are the point — keep those exact.

- [ ] **Step 10: Run unit + typecheck + lint, then the full e2e**
Run: `npm test && npm run typecheck && npm run lint`
Then: `npm run test:e2e`
Expected: PASS — including the existing reschedule test (edit-mode `appt` preserve path) and the two new #16 tests.

- [ ] **Step 11: Commit**

```bash
git add src/modules/booking/freshStart.ts src/modules/booking/freshStart.test.ts src/app/router.tsx src/modules/schedule/ScheduleScreen.tsx src/modules/booking/MonthPicker.tsx src/modules/booking/AppointmentForm.tsx e2e/provider-booking.spec.ts
git commit -m "fix(booking): keep a fresh booking empty via resume param (#16)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (author checklist — completed)

- **Spec coverage:** #17-1 (T1 arrows), #17-2 (T1 more-removal), #17-3 (T2 bounds + T3 wheel), #17-4 (T4 dropdown close), #17-5 (T5 auto-create), #16 (T6 resume). All spec sections map to a task.
- **Placeholder scan:** every code step carries real code; e2e selector caveats are flagged as implementer notes, not TBDs.
- **Type consistency:** `resume?: boolean` is added uniformly to the three routes and the three components; `resolveClientId`/`shouldResetDraft` signatures match their call sites; `validStartTimes`/`wheelColumns`/`nearestMinute` names match between Task 2 (produce) and Task 3 (consume).
- **Cross-module rule:** the #16 reset lives in `booking` (the form), never in `schedule`; `schedule` only forwards the `resume` param.
```
