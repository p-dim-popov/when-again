# Epic 4: Provider mode — schedule & appointments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-first provider schedule (Днес) and a month→day→slot booking funnel — create, edit, cancel, reschedule — built on the Epic 3 data layer and Epic 2 i18n, so a provider can run a full day without the paper notebook.

**Architecture:** Modulith. New UI modules — `shell` (bottom-tab app shell + placeholders), `schedule` (Днес screen + pure slot/gap engine + queries), `booking` (month picker, appointment form, "друг час" time picker, placeholder share landing, mutations, booking-draft store) — sit on top of the existing data modules (`appointments`, `clients`, `settings`, `time`) which keep their plain async public APIs. Async reads/writes go through TanStack Query hooks that wrap those APIs; the form uses TanStack Form; transient cross-step booking state uses a TanStack Store. Routing is TanStack Router. Every user-facing string goes through i18n `t()`.

**Tech Stack:** React 19, TanStack Router (existing) + Query + Form + Store (new), IndexedDB via the existing `idb`-based data layer, Vitest + fake-indexeddb, Playwright.

**Design reference (authoritative for layout/styling):** the approved mockups committed at `docs/design/epic-4/schedule-and-booking-flow.html` (schedule screen, bottom bar, month→day→slot funnel) and `docs/design/epic-4/flexible-time.html` ("друг час" picker). Port their markup/CSS into the React components; they are the visual contract. Design work follows the `frontend-design` skill and the project UX north star (calm, low-friction, phone-first, both light/dark themes).

## Global Constraints

- **New dependencies (allowed, this epic):** `@tanstack/react-query`, `@tanstack/react-form`, `@tanstack/react-store` (+ its `@tanstack/store` core if npm requires it). Install latest at Task 1 and record the resolved versions in the commit. No other new deps. TypeScript stays `~6.0.3`.
- **No server, no network calls, no analytics.** Everything is local IndexedDB; the app works offline.
- **Modulith rules:** cross-module imports only via `modules/<name>/index.ts`; no cycles; nothing imports `src/app/`. Dependency directions this epic: `shell|schedule|booking → appointments|clients|settings|time|i18n`; `booking → schedule` (it reuses the schedule screen for the day step); `schedule` does not import `booking`. The QueryClient instance lives in `src/app` and is provided at the root; modules import `@tanstack/react-query` hooks directly (context supplies the client).
- **Time semantics:** appointments use the existing `WallClock` (`{ dateTime: 'YYYY-MM-DDTHH:mm', timeZone: IANA }`). All pickers/funnel produce `WallClock`; never store epoch/UTC. Day/gap math uses the `time` module comparators.
- **i18n:** every user-facing string via `t()`, BG + EN, each new module shipping a `strings.ts` that augments `TranslationKeys` through `declare module '../i18n'` (Epic 2 pattern). BG copy is drafted here; native-speaker review is deferred to end of project — do not block on wording.
- **Data model reuse (do not modify the merged data modules):** `appointments`: `Appointment`, `AppointmentStatus`, `addAppointment`, `updateAppointment`, `getAppointment`, `listAppointmentsOnDate`, `listAllAppointments`, `listAppointmentsByClient`. `clients`: `Client`, `addClient`, `getClient`, `listClients`, `getVisitHistory`, `updateClient`. `settings`: `Settings`, `ServicePreset`, `getSettings`, `updateSettings`. `time`: `WallClock`, `wallClockNow`, `compareWallClock`, `isBefore`. Read each module's `index.ts` before use; do not assume field names — verify.
- **Verification:** UI tasks have no DOM unit-test tooling (none in the project — do not add jsdom/testing-library); verify them with `npm run typecheck && npm run build` and Playwright e2e. Pure-logic tasks are TDD (Vitest). Keep green before every commit: `npm run lint`, `npm run format:check` (run `npm run format` when needed), `npm run typecheck`, `npm test -- --run`; for tasks that ship or change flows, also `npm run build` and `npm run test:e2e`.
- **Branch:** work continues on `epic-4-provider-schedule` (already created off `main`; holds the design spec). Do NOT push to `main` directly.
- **Commit messages:** plain conventional style, NO Claude session links and NO `Co-Authored-By` trailers (repo owner forbids session trailers).

## File Structure

```
src/app/
  queryClient.ts        # new: creates the QueryClient (staleTime Infinity; local data)
  main.tsx              # modify: wrap app in QueryClientProvider inside bootstrap
  router.tsx            # modify: routes for schedule, booking funnel, form, landing
src/modules/shell/
  AppShell.tsx          # bottom tab bar (Днес · Клиенти · ＋ · Настройки) + <Outlet/>
  Placeholder.tsx       # calm "Скоро" placeholder for Клиенти / Настройки
  strings.ts  index.ts
src/modules/schedule/
  slots.ts  slots.test.ts   # PURE: free-gap + slot computation (TDD core)
  queries.ts                # useDayAppointments(date) etc. (TanStack Query)
  ScheduleScreen.tsx        # week strip + day list + gaps/slots (ported from mockup)
  dateParam.ts  dateParam.test.ts  # PURE: date <-> 'YYYY-MM-DD' route param helpers
  strings.ts  index.ts
src/modules/booking/
  draftStore.ts             # TanStack Store: { date, time, appointmentId? }
  timeBounds.ts  timeBounds.test.ts  # PURE: bound a time to a free gap
  remembered.ts  remembered.test.ts  # PURE: remember a service preset into settings.services
  MonthPicker.tsx           # step 1 (which day)
  TimePicker.tsx            # "друг час" bounded picker (ported from flexible-time mock)
  AppointmentForm.tsx       # TanStack Form: client/service/when/duration/price
  ShareLanding.tsx          # placeholder saved screen
  mutations.ts              # useSaveAppointment / useCancelAppointment / useAddClient
  strings.ts  index.ts
e2e/
  provider-booking.spec.ts  # funnel + edit + cancel
```

---

### Task 1: Dependencies, QueryClient, and the bottom-tab app shell

**Files:**

- Modify: `package.json` (deps)
- Create: `src/app/queryClient.ts`
- Modify: `src/app/main.tsx`, `src/app/router.tsx`
- Create: `src/modules/shell/AppShell.tsx`, `src/modules/shell/Placeholder.tsx`, `src/modules/shell/strings.ts`, `src/modules/shell/index.ts`

**Interfaces:**

- Consumes: `registerStrings`, `t`, `initI18n` (i18n); existing router.
- Produces: `AppShell` (bottom tab bar + `<Outlet/>`); `Placeholder({ titleKey })`; a root route rendering `AppShell` with child routes; `QueryClientProvider` wrapping the tree.

- [ ] **Step 1: Install deps**

```bash
npm install @tanstack/react-query @tanstack/react-form @tanstack/react-store
```

Record the resolved versions (from `package.json`) in the commit body.

- [ ] **Step 2: QueryClient**

`src/app/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query';

// Local IndexedDB is the source of truth; there is no server to poll. Data is
// never "stale" until we invalidate it explicitly after a mutation.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}
```

- [ ] **Step 3: Shell strings**

`src/modules/shell/strings.ts` (BG draft + EN), augmenting `TranslationKeys` via `declare module '../i18n'`. Keys: `shell.tab.today` (Днес / Today), `shell.tab.clients` (Клиенти / Clients), `shell.tab.new` (Нов час / New), `shell.tab.settings` (Настройки / Settings), `shell.soon` (Скоро / Coming soon), `shell.placeholder.clients`, `shell.placeholder.settings`. Follow the exact shape of `src/modules/home/strings.ts` (`export const shellStrings = { en, bg }` + `satisfies Strings` + the `declare module '../i18n'` augmentation). Export `shellStrings` from `index.ts`.

- [ ] **Step 4: AppShell + Placeholder**

`src/modules/shell/AppShell.tsx` — the bottom tab bar from the mockup (`docs/design/epic-4/schedule-and-booking-flow.html`, the `.tabs` block: Днес · Клиенти · raised primary ＋ Нов час · Настройки) above a `<Outlet/>`. Port the `.tabs`/`.tab`/`.primary .fab` CSS. Tabs are router `<Link>`s: Днес → `/`, Клиенти → `/clients`, Настройки → `/settings`, and the primary ＋ → `/book`. Highlight the active tab via the router's active state. Use `t()` for labels.

`src/modules/shell/Placeholder.tsx`:

```tsx
import { t } from '../i18n';
import type { TranslationKeys } from '../i18n';

export function Placeholder({
  titleKey,
}: {
  titleKey: keyof TranslationKeys & string;
}) {
  return (
    <main
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div>
        <h1>{t(titleKey)}</h1>
        <p>{t('shell.soon')}</p>
      </div>
    </main>
  );
}
```

(Styling can be refined later; keep it calm and centered. Use design tokens consistent with the mockup if convenient.)

`index.ts` exports `AppShell`, `Placeholder`, `shellStrings`.

- [ ] **Step 5: Routing + provider wiring**

`src/app/router.tsx` — make the root route render `<AppShell/>`, with child routes: `/` (schedule — temporary: render `Placeholder titleKey="shell.tab.today"` for now; Task 3 replaces it), `/clients` (`Placeholder titleKey="shell.placeholder.clients"`), `/settings` (`Placeholder titleKey="shell.placeholder.settings"`). Keep `basepath: import.meta.env.BASE_URL` and the `Register` augmentation.

`src/app/main.tsx` — in `bootstrap()`, register `shellStrings` (both languages) alongside the existing home strings, create the QueryClient, and wrap `<RouterProvider/>` in `<QueryClientProvider client={queryClient}>`. Keep the existing try/catch language-resolution + async structure.

- [ ] **Step 6: Verify + commit**

Run: `npm run lint && npm run format:check && npm run typecheck && npm run build && npm test -- --run`
Expected: all pass; `dist/` produced. (No e2e change asserted yet; the existing smoke/i18n e2e must still build — run `npm run test:e2e` to confirm the shell renders and `when-again`/tagline still appear on `/`.)

```bash
git add package.json package-lock.json src/app src/modules/shell
git commit -m "feat: add tanstack query/form/store deps and the provider tab shell"
```

---

### Task 2: Free-gap and slot engine (PURE, TDD)

**Files:**

- Create: `src/modules/schedule/slots.ts`, `src/modules/schedule/slots.test.ts`

**Interfaces:**

- Consumes: `Appointment`, `AppointmentStatus` (appointments); `WallClock`, `compareWallClock` (time). Read `src/modules/appointments/index.ts` and `src/modules/time/index.ts` first to confirm exact shapes.
- Produces:
  - `interface FreeGap { start: string; end: string | null }` (`'HH:mm'`; `end: null` = open-ended to day window end).
  - `interface DayLayout { items: Array<{ kind: 'appt'; appt: Appointment } | { kind: 'gap'; gap: FreeGap }> }`.
  - `computeDayLayout(appts: Appointment[], opts: { dayStart: string; dayEnd: string }): DayLayout` — sorts non-cancelled appointments by start, interleaves free gaps (before first, between, after last up to `dayEnd`). Cancelled appointments are included as `appt` items but never consume gap space (they still render, de-emphasised, but the time is free).
  - `generateSlots(gap: FreeGap, opts: { stepMinutes: number; serviceMinutes: number; dayEnd: string }): string[]` — start times (`'HH:mm'`) stepping by `stepMinutes` from `gap.start`, only where a `serviceMinutes`-long appointment fits before `gap.end` (or `dayEnd` when open-ended). Caps the count (e.g. 8) and the caller shows "още…" for the remainder.

- [ ] **Step 1: Write the failing tests**

`src/modules/schedule/slots.test.ts` — cover:

- empty day → one gap `dayStart..dayEnd`.
- one appointment mid-day → gap before + gap after, correct boundaries.
- back-to-back appointments → no zero-length gap between them.
- a cancelled appointment does not block its time (its slot range appears as free).
- `generateSlots`: steps by `stepMinutes`; excludes a start where `serviceMinutes` would overrun `gap.end`; respects the cap.

Use concrete `Appointment` objects built from the real type (wall-clock `dateTime`). Example assertion:

```ts
import { describe, expect, it } from 'vitest';
import { computeDayLayout, generateSlots } from './slots';
// ...build appts with { id, clientId, service, start: { dateTime:'2026-08-22T10:00', timeZone:'Europe/Sofia' }, durationMinutes:30, status:'booked', ... }
it('splits the day around one appointment', () => {
  const layout = computeDayLayout([apptAt('10:00', 30)], {
    dayStart: '08:00',
    dayEnd: '20:00',
  });
  expect(layout.items.map(describe1)).toEqual([
    'gap 08:00-10:00',
    'appt 10:00',
    'gap 10:30-20:00',
  ]);
});
it('only offers slots that fit the service', () => {
  expect(
    generateSlots(
      { start: '10:30', end: '11:00' },
      { stepMinutes: 15, serviceMinutes: 30, dayEnd: '20:00' },
    ),
  ).toEqual([]);
  expect(
    generateSlots(
      { start: '10:00', end: '11:00' },
      { stepMinutes: 30, serviceMinutes: 30, dayEnd: '20:00' },
    ),
  ).toEqual(['10:00', '10:30']);
});
```

(Write the `apptAt`/`describe1` helpers in the test file. Verify the exact `Appointment` field names against `src/modules/appointments/appointments.ts` before writing.)

- [ ] **Step 2: Run tests, confirm they fail** — `npm test -- --run src/modules/schedule/slots.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `slots.ts`** — pure functions using minute arithmetic on `'HH:mm'` (parse to minutes, compare, format back). Do not pull in a date library. Guard against unsorted input (sort by start). Treat `status` values from `AppointmentStatus` — only the cancelled status frees its time; verify the exact literal.

- [ ] **Step 4: Run tests, confirm pass + green gate** — focused test PASS; then `npm run lint && npm run format:check && npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/schedule/slots.ts src/modules/schedule/slots.test.ts
git commit -m "feat: add free-gap and slot computation for the schedule"
```

---

### Task 3: Schedule queries + the Днес screen

**Files:**

- Create: `src/modules/schedule/dateParam.ts`, `src/modules/schedule/dateParam.test.ts`, `src/modules/schedule/queries.ts`, `src/modules/schedule/ScheduleScreen.tsx`, `src/modules/schedule/strings.ts`, `src/modules/schedule/index.ts`
- Modify: `src/app/router.tsx` (the `/` route renders `ScheduleScreen`)

**Interfaces:**

- Consumes: `computeDayLayout`, `generateSlots` (Task 2); `listAppointmentsOnDate` (appointments); `getSettings` (settings, for the remembered default duration → slot step); `wallClockNow` (time); TanStack Query; `t`.
- Produces:
  - `dateParam.ts`: `todayKey(now: Date): string` (`'YYYY-MM-DD'`), `parseDateKey(s: string): { y:number;m:number;d:number } | null`, `addDays(key: string, n: number): string`, `weekOf(key: string): string[]` (seven `'YYYY-MM-DD'`, Monday-first). PURE + TDD.
  - `queries.ts`: `useDayAppointments(dateKey: string)` → `useQuery({ queryKey: ['appointments','day',dateKey], queryFn: () => listAppointmentsOnDate(dateKey) })`. (Confirm `listAppointmentsOnDate`'s argument shape — date key vs Date — against its source and adapt.)
  - `ScheduleScreen({ dateKey }: { dateKey: string })` — reads the date from the route search param (default today), renders the week strip, the ‹ › arrows, and the day layout (appointments + gap slot rows), porting the mockup markup/CSS from `docs/design/epic-4/schedule-and-booking-flow.html` (step 2 "day view" section). Slot chips and the "друг час" chip are present; wiring the slot tap to the booking form is Task 6 (for now a slot navigates to `/appointment/new?date=<dateKey>&time=<HH:mm>` — the route lands in Task 6; until then it may no-op or link, but do not crash). Tapping an appointment navigates to `/appointment/<id>` (Task 7).

- [ ] **Step 1: `dateParam` TDD** — write `dateParam.test.ts` (today formatting with a fixed `Date`, `addDays` across month boundaries, `weekOf` Monday-first), run/fail, implement, pass.

- [ ] **Step 2: Strings** — `schedule/strings.ts`: weekday short labels, `schedule.free` (свободно / free), `schedule.more` (още… / more), `schedule.today` (днес / today), relative-day label helper keys, empty-day text. Augment `TranslationKeys`.

- [ ] **Step 3: Queries + screen** — implement `queries.ts` and `ScheduleScreen.tsx`. Compute the slot step from the last-used service duration (`getSettings().services`, most recent) falling back to 30; day window `08:00`–`20:00` (module constants, with a plain comment noting a later Settings epic may make them configurable). Use `computeDayLayout` + `generateSlots`. Show a pending state while the query loads and an empty-day state.

- [ ] **Step 4: Route** — `/` renders `<ScheduleScreen dateKey={search.date ?? todayKey(now)} />`. Add a typed search param `date?: string`. Day nav (‹ › / week strip) updates the `date` search param via router navigation.

- [ ] **Step 5: Verify** — `npm run lint && npm run format:check && npm run typecheck && npm run build`; `npm test -- --run`; `npm run test:e2e` (schedule renders today; the existing smoke test's `when-again` heading may move — update `e2e/smoke.spec.ts` only if the heading genuinely changed, and note it).

- [ ] **Step 6: Commit**

```bash
git add src/modules/schedule src/app/router.tsx e2e
git commit -m "feat: add the provider day schedule screen"
```

---

### Task 4: Booking-draft store + month picker

**Files:**

- Create: `src/modules/booking/draftStore.ts`, `src/modules/booking/MonthPicker.tsx`, `src/modules/booking/strings.ts`, `src/modules/booking/index.ts`
- Modify: `src/app/router.tsx` (`/book` route)

**Interfaces:**

- Consumes: `listAllAppointments` (to dot days that have appointments); `todayKey`, `parseDateKey`, `weekOf`/`addDays` (schedule dateParam — export the needed helpers from `schedule/index.ts`); TanStack Store; `t`.
- Produces:
  - `draftStore.ts`: a `@tanstack/store` `Store<{ dateKey: string | null; time: string | null; appointmentId: string | null }>` plus `setDraftDate`, `setDraftTime`, `resetDraft`, and a `useBookingDraft()` hook (`useStore`). This carries the in-flight selection month-picker → slot → form without prop-drilling.
  - `MonthPicker` — the calendar grid from `docs/design/epic-4/schedule-and-booking-flow.html` (step 1). A `useQuery(['appointments','all'], listAllAppointments)` supplies which day-keys have (non-cancelled) appointments → dots. Past days dimmed but selectable. Selecting a day sets `draftStore.dateKey` and navigates to `/?date=<key>` (reusing ScheduleScreen — the "day opens" step). Month nav is local state.

- [ ] **Step 1: Strings** — `booking/strings.ts`: `booking.pickDay` (Изберете ден / Choose a day), month/weekday labels (or reuse `Intl` via i18n `getActiveLanguage()` — prefer `Intl.DateTimeFormat` for month names to avoid hardcoding), `booking.free`, etc. Augment `TranslationKeys`.

- [ ] **Step 2: draftStore** — implement the store + hook. (Optional light test: set/reset transitions — a pure store test is cheap; include it.)

- [ ] **Step 3: MonthPicker** — implement, porting the calendar CSS. Compute the grid for the shown month (Monday-first), mark today, dim past, dot days present in the query result.

- [ ] **Step 4: Route** — `/book` renders `<MonthPicker/>`. The shell's primary ＋ already links to `/book` (Task 1).

- [ ] **Step 5: Verify** — typecheck + build; `npm run test:e2e` (tap ＋ → month picker shows; tap a future day → schedule for that day).

- [ ] **Step 6: Commit**

```bash
git add src/modules/booking src/app/router.tsx
git commit -m "feat: add the month picker and booking-draft store"
```

---

### Task 5: "друг час" bounded time picker (PURE bounds TDD + UI)

**Files:**

- Create: `src/modules/booking/timeBounds.ts`, `src/modules/booking/timeBounds.test.ts`, `src/modules/booking/TimePicker.tsx`

**Interfaces:**

- Produces:
  - `timeBounds.ts` (PURE): `clampToGap(time: string, gap: { start: string; end: string | null }, opts: { stepMinutes: number; serviceMinutes: number; dayEnd: string }): string` — snaps `time` to the nearest `stepMinutes` and clamps into `[gap.start, latestStart]` where `latestStart` leaves room for `serviceMinutes` before `gap.end`/`dayEnd`. `latestStartInGap(gap, opts): string`.
  - `TimePicker({ gap, serviceMinutes, value, onPick })` — the bottom-sheet wheel from `docs/design/epic-4/flexible-time.html` (`.sheet`/`.wheel`/`.selband`), bound by `timeBounds`. Default step 5 min. On confirm calls `onPick(time)`.

- [ ] **Step 1–4: TDD `timeBounds`** — failing tests (snap to step; clamp below `gap.start`; clamp above `latestStart`; open-ended gap uses `dayEnd`), confirm fail, implement, pass.

- [ ] **Step 5: TimePicker UI** — implement, porting the sheet/wheel CSS. Minute-precise within the gap; the wheel need not be a physically scrolling native control — a stepper/column selection that produces a valid bounded time is sufficient, but it MUST only allow times `clampToGap` accepts.

- [ ] **Step 6: Verify + commit** — typecheck + build; `git commit -m "feat: add the bounded друг час time picker"`.

---

### Task 6: Appointment form (TanStack Form) + remembered presets

**Files:**

- Create: `src/modules/booking/remembered.ts`, `src/modules/booking/remembered.test.ts`, `src/modules/booking/mutations.ts`, `src/modules/booking/AppointmentForm.tsx`
- Modify: `src/modules/booking/index.ts`, `src/app/router.tsx` (`/appointment/new`)

**Interfaces:**

- Consumes: `useBookingDraft`/`draftStore`; `TimePicker` (Task 5); `MonthPicker`/schedule reuse for changing the day; `listClients`, `addClient`, `getSettings`, `updateSettings`, `addAppointment` (verify signatures); `WallClock`/`wallClockNow`; TanStack Form + Query; `t`.
- Produces:
  - `remembered.ts` (PURE + TDD): `rememberService(services: ServicePreset[], entry: { name: string; durationMinutes: number; price?: number }): ServicePreset[]` — returns the list with the entry added or moved to front (dedupe by name, case-insensitive), so recent services suggest first. Does not mutate input.
  - `mutations.ts`: `useSaveAppointment()` (wraps `addAppointment`; on success invalidates `['appointments']`), `useAddClient()` (wraps `addClient`; invalidates `['clients']`). Each `useMutation` from TanStack Query.
  - `AppointmentForm` (TanStack Form): fields per the spec — Клиент (search-as-you-type over `listClients` via a query; no match → inline "Създай '<name>'" using `useAddClient`), Услуга (free text + remembered-preset suggestion row from `getSettings().services`; picking one prefills duration), Кога (from the draft store; a "Промени" control opens the day (schedule/month) + `TimePicker`), Времетраене (prefilled), Цена (optional). Submit builds a `WallClock` start from draft date+time, calls `useSaveAppointment`, then `rememberService` → `updateSettings({ services })`, then navigates to `/appointment/saved` (Task 8). Layout ported from the form section of `docs/design/epic-4/schedule-and-booking-flow.html` (step 3).

- [ ] **Step 1–4: TDD `remembered`** — failing tests (adds new; moves existing to front; case-insensitive dedupe; input not mutated), fail, implement, pass.

- [ ] **Step 2: mutations + strings** — implement `mutations.ts`; add form strings to `booking/strings.ts` (labels: Клиент/Услуга/Кога/Времетраене/Цена, "Създай …", "Запази · сподели", placeholder texts).

- [ ] **Step 3: AppointmentForm** — implement with TanStack Form. Client search uses `useQuery(['clients'], listClients)` filtered client-side. Prefill day/time from `useBookingDraft()`.

- [ ] **Step 4: Route + wire slot taps** — `/appointment/new` renders the form; make schedule slot chips (Task 3) and the `TimePicker`/друг час result set the draft (`setDraftDate`/`setDraftTime`) and navigate here.

- [ ] **Step 5: Verify** — typecheck + build; `npm run test:e2e` for create (funnel → form → save is asserted fully in Task 10, but smoke it here).

- [ ] **Step 6: Commit** — `git commit -m "feat: add the new appointment form with remembered services"`.

---

### Task 7: Edit, cancel, reschedule

**Files:**

- Modify: `src/modules/booking/AppointmentForm.tsx`, `src/modules/booking/mutations.ts`, `src/modules/booking/index.ts`, `src/app/router.tsx` (`/appointment/$id`), `src/modules/schedule/ScheduleScreen.tsx` (tap → edit)

**Interfaces:**

- Consumes: `getAppointment`, `updateAppointment` (verify), `AppointmentStatus`.
- Produces: the form in edit mode (preloaded via `useQuery(['appointment',id], () => getAppointment(id))`), `useUpdateAppointment()` and `useCancelAppointment()` (sets status to the cancelled literal via `updateAppointment`; invalidates `['appointments']`). Reschedule = editing the Кога row and saving. A Cancel action on the edit form. All paths navigate to `/appointment/saved`.

- [ ] **Step 1: Mutations** — add `useUpdateAppointment`, `useCancelAppointment`.
- [ ] **Step 2: Form edit mode** — `/appointment/$id` loads the appointment into the same form; show Cancel + Reschedule (reschedule is just changing Кога). Save uses update when `id` present, add otherwise.
- [ ] **Step 3: Schedule wiring** — tapping an appointment row navigates to `/appointment/<id>`.
- [ ] **Step 4: Verify + commit** — typecheck + build + smoke e2e; `git commit -m "feat: add edit, cancel, and reschedule"`.

---

### Task 8: Placeholder share landing

**Files:**

- Create: `src/modules/booking/ShareLanding.tsx`
- Modify: `src/modules/booking/index.ts`, `src/modules/booking/strings.ts`, `src/app/router.tsx` (`/appointment/saved`)

**Interfaces:**

- Consumes: the last saved appointment (read from the draft store's `appointmentId`, or a query by id); `t`.
- Produces: `ShareLanding` — a calm confirmation: title `booking.saved` (Записан час / Appointment saved), the summary (client · service · day · time), a **disabled** Сподели button captioned `booking.shareSoon` (QR/връзка идват скоро — Epic 6), and a **Готово** button back to the day (`/?date=<key>`). No payload/QR here.

- [ ] **Step 1: Strings** — `booking.saved`, `booking.shareSoon`, `booking.done`, summary labels.
- [ ] **Step 2: Screen + route** — implement; save/cancel/reschedule already navigate here (Tasks 6–7).
- [ ] **Step 3: Verify + commit** — typecheck + build; `git commit -m "feat: add placeholder share landing after save"`.

---

### Task 9: End-to-end booking flow (Playwright)

**Files:**

- Create: `e2e/provider-booking.spec.ts`

**Interfaces:** consumes the running preview build; asserts the epic acceptance.

- [ ] **Step 1: Write the e2e** — a Playwright spec covering, on `/when-again/`:
  1. **Book ahead:** tap ＋ Нов час → month picker shows → pick a future day → the day's schedule shows → tap a free slot → the form opens with that day+time → fill client (inline create) + service → Запази → the placeholder landing shows the summary. Then Готово → the day shows the new appointment.
  2. **друг час:** open a gap's друг час → pick an off-grid minute → form shows it.
  3. **Edit + cancel:** tap the appointment → change the time (reschedule) → save → landing; then tap it again → Cancel → it renders de-emphasised on the day.
     Assert on visible Bulgarian text and roles; keep selectors resilient. Reuse the pattern in `e2e/i18n.spec.ts`.

- [ ] **Step 2: Run** — `npm run test:e2e` → all specs pass (new + existing smoke/i18n).
- [ ] **Step 3: Commit** — `git commit -m "test: add e2e for the provider booking flow"`.

---

## Notes for the implementer

- **Verify data-layer signatures first.** Before Tasks 2–8, read the relevant `src/modules/<data>/index.ts` and its implementation for exact function arguments/returns and the exact `AppointmentStatus`/`Appointment` field names. The interfaces above name the functions but the argument shapes (e.g. does `listAppointmentsOnDate` take a `'YYYY-MM-DD'` string or a `Date`?) must be confirmed, not assumed — adapt the query wrappers accordingly and note any surprise as DONE_WITH_CONCERNS.
- **Styling is not a placeholder.** Port the CSS/markup from the two committed mockups in `docs/design/epic-4/`; they are the approved visual contract (calm, phone-first, light+dark tokens). Keep the token system consistent across shell/schedule/booking rather than re-inventing per screen.
- **Store vs router.** The schedule _date_ is a route search param (deep-linkable, back-button friendly). The TanStack Store holds only the transient booking _draft_ (date/time/appointmentId in flight). Do not duplicate the date in both as the source of truth — the route param wins for the schedule; the draft is set when entering the form.
- **i18n from day one.** No hardcoded user-facing strings; every new module ships `strings.ts` and augments `TranslationKeys`. BG copy is a draft.
- **Deferred (tracked):** QR/payload/share (#6), Клиенти screen (#5), Настройки + mode switch (Settings/#7), configurable working hours & slot step, `.ics` (#8).
