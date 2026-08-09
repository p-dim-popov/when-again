import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { AppShell, Placeholder, SettingsScreen } from '../modules/shell';
import { ScheduleScreen, todayKey } from '../modules/schedule';
import { AppointmentForm, MonthPicker, ShareLanding } from '../modules/booking';

interface TodaySearch {
  date?: string;
  // Carried through the reschedule detour: when the day view was reached via
  // the form's "Промени" in edit mode, `appt` is the id being edited so the
  // next slot tap forwards it back to the form (keeping the round trip an
  // edit rather than a new booking).
  appt?: string;
  // Carried through a NEW-booking "Промени" round trip (#16): tells the form
  // this day view visit is a continuation of an in-progress booking, not a
  // fresh entry, so the draft (client/service/price) must survive. Absent on
  // every other route into the day view (browse, month-header jump), so an
  // abandoned booking's fields never leak into an unrelated fresh one.
  resume?: boolean;
}

interface NewAppointmentSearch {
  date?: string;
  time?: string;
  // The appointment id being edited (absent ⇒ new booking). See
  // `AppointmentForm`'s mount logic.
  appt?: string;
  // See `TodaySearch.resume` (#16) — forwarded through to the form so it can
  // decide whether to reset the draft on entry.
  resume?: boolean;
}

const rootRoute = createRootRoute({
  component: AppShell,
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): TodaySearch => ({
    date: typeof search.date === 'string' ? search.date : undefined,
    appt: typeof search.appt === 'string' ? search.appt : undefined,
    resume:
      search.resume === true || search.resume === 'true' ? true : undefined,
  }),
  component: TodayRoute,
});

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

const clientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/clients',
  component: () => <Placeholder titleKey="shell.placeholder.clients" />,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  // Temporary: Epic 7 ships the real Settings screen; for now this keeps the
  // БГ/EN/Auto language toggle reachable (see modules/shell/SettingsScreen).
  component: SettingsScreen,
});

interface BookSearch {
  date?: string;
  // Carried when the month picker was opened from the day view mid-flow
  // (reschedule detour): forwarded back to `/` on day-select so the
  // round trip stays an edit rather than becoming a new booking.
  appt?: string;
  // See `TodaySearch.resume` (#16) — forwarded back to `/` on day-select so a
  // new-booking "Промени" round trip keeps the draft instead of resetting it.
  resume?: boolean;
}

const bookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/book',
  validateSearch: (search: Record<string, unknown>): BookSearch => ({
    date: typeof search.date === 'string' ? search.date : undefined,
    appt: typeof search.appt === 'string' ? search.appt : undefined,
    resume:
      search.resume === true || search.resume === 'true' ? true : undefined,
  }),
  component: BookRoute,
});

function BookRoute() {
  const { date, appt, resume } = bookRoute.useSearch();
  return <MonthPicker date={date} appt={appt} resume={resume} />;
}

// The day view (schedule) navigates here on a quick-slot or "друг час" pick,
// passing the choice as search params so `schedule` never has to import
// `booking`. `AppointmentForm` is draft-backed (see
// `modules/booking/draftStore.ts`); it seeds the draft with these search
// params on mount and its "Промени" control navigates back to `/` so the
// provider can re-pick a time, then returns here.
const newAppointmentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/appointment/new',
  validateSearch: (search: Record<string, unknown>): NewAppointmentSearch => ({
    date: typeof search.date === 'string' ? search.date : undefined,
    time: typeof search.time === 'string' ? search.time : undefined,
    appt: typeof search.appt === 'string' ? search.appt : undefined,
    resume:
      search.resume === true || search.resume === 'true' ? true : undefined,
  }),
  component: NewAppointmentRoute,
});

function NewAppointmentRoute() {
  const { date, time, appt, resume } = newAppointmentRoute.useSearch();
  return (
    <AppointmentForm date={date} time={time} appt={appt} resume={resume} />
  );
}

// Save, cancel, and reschedule (Tasks 6b/7) all navigate here after
// `patchDraft({ appointmentId })`; `ShareLanding` reads that id, shows a
// calm confirmation, and is the funnel's reset point (its "Готово" calls
// `resetDraft()`). No payload/QR here — that's Epic 6.
const appointmentSavedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/appointment/saved',
  component: ShareLanding,
});

const routeTree = rootRoute.addChildren([
  todayRoute,
  clientsRoute,
  settingsRoute,
  bookRoute,
  newAppointmentRoute,
  appointmentSavedRoute,
]);

export const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
