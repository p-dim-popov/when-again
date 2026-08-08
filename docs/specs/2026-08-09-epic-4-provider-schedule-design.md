# Epic 4 — Provider mode: schedule & appointments: design

Status: approved 2026-08-09. Epic issue: #4.

## Purpose

Give a provider the first real UI: a phone-first schedule they can run a full
day from, and a booking flow to create, edit, cancel, and reschedule
appointments — without the paper notebook. Built on the finished data layer
(Epic 3) and i18n (Epic 2).

The guiding goal is low friction (see the project's UX north star): calm,
obvious, and always the same structure, so a provider who would otherwise stay
on paper does not bounce.

## Scope

In scope:

- The **Днес** (schedule) screen — agenda day view with a week strip.
- The **booking funnel** — month picker → day → slot → new/edit form.
- **Flexible time** — quick slots plus a precise "друг час" picker.
- **Edit / cancel / reschedule** on the same form.
- A **placeholder share landing** after save.
- The **bottom-tab app shell** with Днес functional and Клиенти / Настройки
  as lightweight placeholders.
- Data binding via TanStack Query / Form / Store on the existing modules.
- All strings through i18n (`t()`), BG + EN.

Out of scope (deferred, with their home reserved here):

- **QR code, payload encoding, share link** — Epic 6 (Handoff). This epic
  ends on a placeholder "saved" screen where that will live.
- **Клиенти screen** (client list, client page, visit history) — Epic 5.
- **Настройки screen** and the **provider ↔ client mode switch** — ship when
  Settings is built (with client mode, Epic 7). This epic only leaves the
  Настройки tab as the switch's future home.
- **Calendar .ics** — Epic 8.

Acceptance (from issue #4): a provider can run a full day from the app without
the paper notebook — see the day, book into free time (today or weeks out),
and edit/cancel/reschedule.

## App shell & navigation

A bottom tab bar with three destinations and one primary action:

- **Днес** — the schedule (default). Fully built this epic.
- **Клиенти** — placeholder this epic (calm empty state, e.g. "Скоро"); Epic 5.
- **＋ Нов час** — the primary action, raised and accent-filled. Opens the
  booking funnel (below). It is an action, not a destination.
- **Настройки** — placeholder this epic; the mode switch's future home.

Routing is TanStack Router. The provider shell is the app's root for now
(`mode` is assumed provider; the mode switch that would change this is
deferred). The existing home route is replaced by the Днес schedule.

## Schedule screen (Днес)

Agenda-style day list with a **week strip** on top (seven days, current day
highlighted). Change day by the strip, by ‹ › arrows, or by horizontal swipe.

- **Appointments** render as blocks in time order, each with a left **time
  rail** showing start and (faint) end, the client name, and the service ·
  duration. Tapping an appointment opens the edit form.
- **Free gaps** between (and around) appointments render as a row of tappable
  **quick slot chips** plus a **◷ друг час** chip (see Flexible time).
- Cancelled appointments are visually de-emphasised, not removed (the day is a
  truthful record).

**Slot generation.** For each free gap the screen offers quick chips stepping
by a default interval, bounded so a chip never overlaps the next appointment.
The interval defaults to the most recent service's duration, falling back to
30 minutes. The bookable day window defaults to **08:00–20:00** for chip
generation only (there is no working-hours setting yet — a later Settings epic
may make it configurable); "друг час" is not limited to this window beyond the
free gap itself.

## Booking funnel

Booking is one funnel, always the same structure. Each step answers one plain
question:

1. **Кога? (which day)** — ＋ Нов час opens a **month picker** (calendar grid,
   month navigation). Days that already have appointments show a dot. Any day
   is selectable; the past is dimmed but allowed (back-filling a record).
2. **В колко часа? (which time)** — the chosen day opens in the **ordinary Днес
   schedule screen** (not a separate picker — the same component), where the
   provider taps a free slot or "друг час".
3. **Кой и какво? (who & what)** — the **new/edit form** opens with the day and
   time already filled; the provider adds client and service and saves.

Near-term bookings skip step 1: on today's (or any visible day's) schedule,
tapping a slot goes straight to step 3. Same gesture whether reading a day or
booking into it.

## Flexible time ("друг час")

Quick slot chips cover the common case in one tap. After them, a **◷ друг час**
chip opens a **minute-precise time picker bounded to the free gap**, so an odd
time (e.g. 11:15) is easy and a clash with the next appointment is impossible.
Default step 5 minutes (configurable later). This is the **same picker** the
form's "Промени" (change time) control uses — one way to pick a time, two doors
to it.

## New / edit appointment form

Fields:

- **Клиент** — search-as-you-type over existing clients (`listClients`);
  no match offers inline create ("Създай '<name>'" → `addClient`). Duplicate
  names are allowed (per spec); the provider tells them apart later by phone or
  notes (Epic 5).
- **Услуга** — free text with a **remembered-presets** suggestion row. On save,
  a service name not already in `settings.services` is stored there (with its
  duration) so it suggests next time. Picking a preset prefills its duration.
- **Кога** — the day + time from the funnel, shown as an editable row
  ("Промени" opens the shared time/day picker). Fully re-selectable, so any
  date/month is reachable from here too.
- **Времетраене** — prefilled from the service, editable.
- **Цена** — optional.

Save (**Запази · сподели**) writes via `addAppointment` (or `updateAppointment`
when editing) and lands on the placeholder share screen.

## Edit / cancel / reschedule

Tapping an appointment opens the same form pre-loaded:

- **Save** applies changes (`updateAppointment`).
- **Reschedule** is changing the "Кога" row (day and/or time) and saving.
- **Cancel** sets the appointment's status to cancelled
  (`AppointmentStatus`), keeping it as a de-emphasised record.

All three end on the placeholder share landing, so re-share is the natural last
step once Epic 6 fills it in.

## Placeholder share landing

After any save/cancel/reschedule, a minimal confirmation: the appointment
summary (client · service · day · time) and a stubbed **Сподели** action
labelled as coming soon, plus **Готово** back to the day. Epic 6 replaces this
screen with the real QR code, payload, and share sheet — this epic only
establishes the landing so the flow terminates correctly.

## Data & tech

New dependencies (a deliberate commitment to the TanStack family, on top of the
existing TanStack Router):

- **TanStack Query** — async reads from IndexedDB. Query functions wrap the
  existing data-layer functions (`listAppointmentsOnDate`, `listClients`,
  `getVisitHistory`, etc.); mutations wrap `addAppointment` / `updateAppointment`
  / `addClient` and invalidate the affected queries so the day view refreshes
  after a booking or edit. (Its server-cache features are unused; it is used
  purely as async-state management with invalidation.)
- **TanStack Form** — the new/edit appointment form (validation, field state).
- **TanStack Store** — client-side UI state that isn't server data (e.g. the
  selected day, transient booking-funnel state).

These live in the app/composition layer and per-module UI; the data modules
keep their plain async public APIs unchanged. Modulith rules hold: UI imports
data modules via their `index.ts`; nothing imports `src/app/`.

**Time.** Appointments use the existing `WallClock` model (local wall-clock +
IANA timezone name); the funnel and pickers produce `WallClock` values. Never
store epoch/UTC for appointment starts. Day/gap math uses the `time` module's
comparators.

**i18n.** Every user-facing string goes through `t()`, in BG and EN, via a
`strings.ts` in each new module (per the Epic 2 pattern). BG copy is drafted in
implementation; native-speaker review is deferred to end of project.

## Testing & craft

- **Unit** (Vitest + fake-indexeddb): the pure logic — free-gap/slot
  computation and bounds, service-preset remembering, query/mutation wiring
  where testable without a DOM.
- **e2e** (Playwright): the booking funnel end to end — ＋ Нов час → month
  picker → pick a day → pick a slot (and a "друг час" time) → fill the form →
  save → placeholder landing; plus edit and cancel.
- **Design:** the `frontend-design` skill applied throughout — phone-first,
  low-friction, calm, both light and dark themes. The approved mockups are the
  visual reference (schedule, month→day→slot funnel, друг час picker).

## Open items / notes

- **Bookable day window** (08:00–20:00) and the **slot step** default are
  provisional; a future Settings epic may expose them.
- **Working hours / availability** beyond the default window are not modelled
  this epic.
- The **placeholder tabs** (Клиенти, Настройки) are intentionally minimal;
  Epics 5 and 7 replace them.
