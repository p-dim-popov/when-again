# Schedule & Booking behavioral fixes — design spec

**Date:** 2026-08-09
**Tracks:** #17 (items 1–5) and #16 (folded in)
**Follows:** the Tailwind v4 + "Elevated & warm" restyle (PR #18), which
already resolved #17 items 6 (mobile overflow / tap targets) and 7
(month-header affordance). This cycle is the **behavioral** remainder.

## Goal

Remove the friction and dead controls found in the Epic 4 provider
schedule + booking walkthrough: navigation that steps the wrong unit, a
control that does nothing, a time picker that can't be scrolled, a client
field that won't close and demands an extra tap, and a booking draft that
can carry stale fields into a fresh appointment.

## Scope

Six changes, in one branch → one PR:

| # | Item | Nature |
|---|------|--------|
| 1 | Day arrows change **weeks**, not days | mechanical |
| 2 | Remove the dead **`more…`** control | mechanical |
| 3 | Rebuild **"other time"** as a two-column scroll-snap wheel | new component behavior |
| 4 | **Client dropdown** closes after pick / blur / Escape | mostly mechanical |
| 5 | **New client** = inline hint + auto-create on save (no required tap) | behavior change |
| 16 | Fresh booking starts empty via a **`resume`** search param | behavior change |

Out of scope: any change to the `db`/`time`/`i18n` leaves; the settings/
clients placeholder screens; the reschedule flow's overall shape (a Промени
still round-trips through the day view — see #16 rationale).

## Global Constraints

- **Modulith boundaries.** Cross-module imports go through `index.ts` only.
  `schedule` must not import `booking` (the day view hands its choice to the
  funnel through route search params — the existing pattern). The day view
  never imports the time-picker's internals beyond what `schedule/index.ts`
  already exposes.
- **Wall-clock time semantics.** Appointments store `{ dateTime:
  'YYYY-MM-DDTHH:mm', timeZone }`. The time wheel only ever selects a
  wall-clock `HH:mm`; no epoch/UTC.
- **No PII in URLs.** The `resume` signal is a boolean only. Client names,
  service, price never travel in search params — they stay in `draftStore`.
- **Base path.** No hardcoded `/when-again/`; unaffected here but keep it in
  mind for any new asset reference.
- **Styling.** Tailwind v4 utilities in JSX, token-flip dark mode, **no
  `dark:` variants**. No new per-module CSS files. Reuse the "Elevated &
  warm" tokens already in `src/app/index.css`.
- **User-facing copy.** New/changed UI strings follow Simplified Technical
  English and ship BG + EN. BG is a draft pending a native-speaker pass
  (deferred to project end) — do not block on wording.
- **Tests.** Vitest for module logic; the Playwright smoke (`e2e/`) stays
  green. Prefer `data-testid` over CSS-class coupling for any new e2e hook.

---

## 1 · Day-view arrows change weeks

**File:** `src/modules/schedule/ScheduleScreen.tsx` (the two arrow buttons,
currently `goTo(addDays(dateKey, -1))` / `+1`).

The day is already selectable by tapping the week strip, so day-granular
arrows are redundant. Change both to `±7`: jump one week, keeping the same
weekday. `goTo` sets `dateKey`; `weekOf(dateKey)` re-derives the strip, so
the strip reflects the new week automatically.

- `‹` → `goTo(addDays(dateKey, -7))`
- `›` → `goTo(addDays(dateKey, 7))`
- Update the two `aria-label`s from prev/next **day** to prev/next **week**
  (new i18n keys, BG + EN; retire the day-labelled keys if unused elsewhere).

`resume` (item #16) threads through `goTo` unchanged — the arrows inherit it.

**Test:** unit-cover that `addDays(key, 7)` keeps the weekday and lands in the
next `weekOf`. (Arrow wiring itself is covered by the day-view render.)

---

## 2 · Remove the dead `more…` control

**File:** `src/modules/schedule/ScheduleScreen.tsx`.

`handleMoreTapStub` is a literal no-op; the `more…` chip renders when a gap
yields ≥8 slot chips. The adjacent **"other time"** chip already covers "a
time not shown," so `more…` is redundant and confusing.

Remove: `handleMoreTapStub`, the `mayHaveMore` computation, the conditional
render block, and the `schedule.more` i18n keys (BG + EN). Leave
`generateSlots`' internal cap unchanged — it still bounds the chip row; the
overflow is reached through "other time," which now scrolls (item 3).

**Test:** the existing day-view render test asserts no `more…` control and
that "other time" is still present.

---

## 3 · Two-column scroll-snap time wheel

**File:** `src/modules/schedule/TimePicker.tsx` (full rebuild of the picker
body; the sheet chrome — handle, title, window label, Confirm — stays).

### Structure

Two vertical scroll columns — **hours** (left) and **minutes** (right) — a
static colon between, and a fixed highlight band across the center row.

- Each column: `scroll-snap-type: y mandatory`; each option
  `scroll-snap-align: center`; top/bottom spacer padding equal to
  `(columnHeight − rowHeight) / 2` so the first and last option can center
  under the band. Native touch-fling does the scrolling.
- The centered option is the selected one. Track selection from scroll
  position: on `scrollend` (with a debounced `scroll` fallback for browsers
  without `scrollend`), compute the nearest option index from `scrollTop`
  and set state. Programmatic selection (keyboard, minute-clamp) scrolls the
  option to center.

### Bounds and the "clash impossible" guarantee

Compute the full set of **valid start times** in `[gap.start, latestStart]`,
where `latestStart` is the existing bound (a start whose `serviceMinutes`
still fits before `gap.end ?? dayEnd`). This is the uncapped form of the
current `generateSlots` logic — extract a shared helper in
`schedule/timeBounds.ts` (or `generateSlots`' module) that both use, so the
cap lives only in the chip-row caller.

- **Hours column** = the distinct hours present in the valid-start set.
- **Minutes column** = the valid minutes **for the currently-selected
  hour** (multiples of `STEP_MINUTES`, each forming a valid start under the
  bounds).
- Scrolling the hour column re-derives the minute column. If the previously
  selected minute is not valid for the new hour, **clamp** to the nearest
  valid minute for that hour.
- Selected value is always `HH:mm` drawn from the set, so it is always a
  valid start. Confirm still emits `clampToGap(selected, gap, opts)` — a
  clash with the next appointment remains impossible by construction.
- Degenerate cases: a single valid hour → the hour column is a one-option
  (non-scrolling) list; a single valid minute behaves likewise. The wheel
  still renders and Confirm still works.

### Accessibility (baked in, not deferred)

- Each column is `role="listbox"`; each option `role="option"` with
  `aria-selected` on the centered one. Column carries an `aria-label`
  (hours / minutes).
- Roving `tabindex` (selected option `0`, others `-1`). ArrowUp/ArrowDown
  move selection and scroll the new option to center; the hour list's arrow
  keys also re-derive + clamp minutes.
- `@media (prefers-reduced-motion: reduce)` → `scroll-behavior: auto` for
  programmatic centering.

### i18n

Keep the sheet title, window label, subnote, and Confirm strings. Retire the
stepper-only keys (`hourUp/hourDown/minuteUp/minuteDown`, `stepCaption`) if
unused after the rebuild. Add column `aria-label` keys (BG + EN).

### Tests

- Unit: the valid-start/hours/minutes derivation for representative gaps
  (open-ended gap → `dayEnd`; sub-hour gap; multi-hour gap; a gap where the
  last hour forbids late minutes) and the minute-clamp on hour change.
- e2e: `data-testid="time-sheet"` stays; add a stable hook for the selected
  value if the smoke asserts the picked time. Selecting a time still lands a
  booking with that start.

---

## 4 · Client dropdown closes

**File:** `src/modules/booking/AppointmentForm.tsx`.

After `selectClient`, `clientQuery` equals the client's name, which still
self-matches, so the listbox stays open. Fix:

- **Suppress when selected:** don't show suggestions when a client is
  selected and the query still equals its name —
  `!(clientId != null && trimmedClientQuery.toLowerCase() === selectedName)`.
  (`selectedName` = the selected client's name; after `selectClient` it
  equals `clientQuery`.) Fold this into `showClientSuggestions`.
- **Escape:** `onKeyDown` Escape hides the list (a local `dismissed` flag,
  reset when the user next types).
- **Blur:** `onBlur` hides the list. Suggestion option buttons use
  `onMouseDown={e => e.preventDefault()}` so the click registers before blur
  fires — no timers.

Retyping (which calls `handleClientQueryChange`, clearing `clientId`) clears
the `dismissed` flag so suggestions return.

**Test:** unit/interaction — after selecting a suggestion the listbox is
closed (`aria-expanded=false`); Escape closes it; typing after a selection
reopens it.

---

## 5 · New client: inline hint + auto-create on save

**File:** `src/modules/booking/AppointmentForm.tsx`.

Today an unknown name offers only a **"Create «name»"** option that must be
tapped before `handleSave` (which hard-requires `clientId`) will pass.

- **Remove** the tappable create row (`showCreateClient` branch and
  `handleCreateClient`'s use from the list). The suggestion list shows
  existing matches only.
- **Inline hint:** when `trimmedClientQuery.length > 0 &&
  !hasExactClientMatch && clientId == null`, render a quiet hint under the
  field — *"will be added as a new client"* (new i18n key
  `booking.form.client.willCreate`, BG + EN). No tap required.
- **Resolve the client on save**, dropping the hard `clientId` guard.
  Order:
  1. `clientId` set (picked from the list) → use it.
  2. else `trimmedClientQuery` exactly matches an existing client
     (case-insensitive) → use that client's id (**no duplicate creation**).
  3. else `trimmedClientQuery` non-empty → `addClientMutation` create, use
     the new id.
  4. else (empty) → the existing required-field validation error.
- `handleSave` becomes async around the create; the rest of the save path
  (mutation, remember-service, navigate to saved landing) is unchanged.

Interaction with item 4: after a pick, `clientId` is set and the query
equals the name → dropdown suppressed and no hint (has `clientId`).

**Test:** unit-cover the four resolution branches; specifically that an
exact typed name (never explicitly picked) selects the existing client and
does **not** create a duplicate, and that a genuinely new name creates once.

---

## 16 · Fresh booking starts empty (`resume` search param)

**Files:** `src/app/router.tsx` (search schemas), `src/modules/schedule/
ScheduleScreen.tsx` (thread + reset choke point), `src/modules/booking/
MonthPicker.tsx` (thread), `src/modules/booking/AppointmentForm.tsx`
(`goChangeWhen`), `src/modules/booking/draftStore.ts` (no new field needed).

### Problem

The draft resets at exactly two points — the **＋ Нов час** entry
(`MonthPicker` with no `date`/`appt`) and the saved landing's **Готово**. A
fresh booking started any other way (browse → slot, or browse → month-header
→ day → slot) never hits a reset, so an abandoned booking's client/service/
price leak into it. Route-param *absence* can't distinguish "fresh
month-header jump" from "mid-flow month jump during a Промени round-trip":
both carry `date`, neither carries `appt`.

Once item 5 auto-creates a client from the field, a leaked stale name would
**silently create a booking for the wrong client** — so this is now
load-bearing, not cosmetic.

### Design — symmetric to `appt`

A booking is "being continued" only when the provider tapped **Промени**;
everything else that reaches a slot is fresh. Carry that one fact as a
boolean search param, `resume`, exactly as `appt` is already carried.

- **Schemas:** add `resume?: boolean` to `TodaySearch` (`/`) and
  `BookSearch` (`/book`). Parse: `search.resume === true || search.resume
  === 'true' ? true : undefined`. `/appointment/new` does **not** need it —
  by the time the form mounts, the slot tap has already kept-or-reset the
  draft.
- **Set it:** `goChangeWhen` in `AppointmentForm`, for a **new** booking
  (`editingId == null`), navigates with `resume: true`. Edit-mode Промени
  keeps carrying `appt`, which already means "continue this edit" — no
  `resume` needed there.
- **Thread it** (one-liners matching `...(appt ? { appt } : {})`):
  - Day view `goTo` (week arrows + day taps): carry `resume`.
  - Day view month-header nav → `/book`: carry `resume`.
  - `MonthPicker.handleSelectDay` → `/`: carry `resume`.
- **Reset choke point** — the slot tap (`goToForm`):
  - `appt` present → reschedule, navigate with `appt` (unchanged).
  - else `resume` present → keep the draft, navigate with `date`/`time`.
  - else → **`resetDraft()`**, then navigate with `date`/`time`. The form's
    mount effect re-applies `date`/`time` from the URL, so a reset-then-seed
    lands a clean draft with just the picked slot.

  ＋ Нов час keeps its existing `MonthPicker` reset (harmless and explicit);
  the slot-tap reset makes every fresh path clean regardless.

### Why the `resume` param beats an in-memory flag

A URL param is scoped to its navigation chain: after an abandon, no later
browse URL carries `resume`, so the next booking is automatically fresh. An
in-memory "resuming" boolean would stay stuck `true` after an abandon and
re-introduce the same stale-data class of bug.

### Guarantees preserved

- Mid-flow month jump (new **or** reschedule) keeps in-progress fields —
  `resume`/`appt` survive the month-header hop.
- A reschedule keeps its `appt` edit identity.
- "other time" from a fresh slot is still fresh (it flows through the same
  `goToForm` reset branch).

### Tests

- Unit: the `goToForm` branch selection — `appt` → reschedule; `resume` →
  draft preserved; neither → `resetDraft` called then date/time seeded.
- Interaction/e2e: browse → month-header → pick day → slot → **empty** form;
  form (filled) → Промени → day → slot → fields **preserved**.

---

## Testing strategy summary

- **Vitest:** wheel bounds/derivation + minute-clamp (item 3); client
  resolution-on-save four branches (item 5); `goToForm` reset branches
  (#16); `addDays ±7` weekday/`weekOf` (item 1); absence of `more…` (item 2);
  dropdown open/close transitions (item 4).
- **Playwright smoke:** unchanged flow stays green; `data-testid` hooks for
  the wheel selection and (if needed) the empty-vs-preserved form.
- All new user-facing strings land in both `bg` and `en` i18n resources.
